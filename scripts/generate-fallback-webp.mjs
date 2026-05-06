/**
 * generate-fallback-webp.mjs — Puppeteer + ffmpeg で HeroDemo を実機キャプチャし、
 * 軽量アニメーション WebP（無限ループ）を生成するパイプライン。
 *
 * 仕様書 §6 C「フォールバック WebP（必須）」のための自動生成スクリプト。
 *
 * 前提:
 *   - dev サーバが http://localhost:3000/__hero-demo で HeroDemo 単体を表示できること
 *     （Next.js なら `app/__hero-demo/page.tsx`、Vite なら同等のルートを 1 枚用意）
 *   - ffmpeg が PATH 上に存在すること（libwebp が有効なビルド）
 *   - puppeteer が devDependencies に入っていること
 *
 * 使い方:
 *   pnpm dev &
 *   node scripts/generate-fallback-webp.mjs \
 *     --url http://localhost:3000/__hero-demo \
 *     --out public/hero/hero-demo.webp \
 *     --width 1280 --height 720 --fps 30 --duration 4.2
 *
 * ビルド時に走らせる場合:
 *   "scripts": {
 *     "build:fallback": "node scripts/generate-fallback-webp.mjs"
 *   }
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const URL = arg("--url", "http://localhost:3000/__hero-demo");
const OUT = resolve(arg("--out", "public/hero/hero-demo.webp"));
const WIDTH = parseInt(arg("--width", "1280"), 10);
const HEIGHT = parseInt(arg("--height", "720"), 10);
const FPS = parseInt(arg("--fps", "30"), 10);
const DUR = parseFloat(arg("--duration", "4.2")); // タイムライン Total と一致
const TMP = resolve(__dirname, ".webp-frames");

// ── 1. フレームを Puppeteer でスクリーンキャプチャ ──────────────
async function capture() {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: "networkidle0" });
  // 初回 LCP / フォント読み込みを安定化
  await page.evaluate(() => document.fonts?.ready);

  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });

  const totalFrames = Math.round(DUR * FPS);
  // 等間隔で待機しながらキャプチャ。`page.screenshot` は同期的に並べる。
  const start = Date.now();
  for (let i = 0; i < totalFrames; i++) {
    const target = start + (i * 1000) / FPS;
    const wait = target - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const idx = String(i).padStart(4, "0");
    await page.screenshot({
      path: `${TMP}/frame-${idx}.png`,
      omitBackground: true,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    if (i % 10 === 0) process.stdout.write(`  frame ${i + 1}/${totalFrames}\r`);
  }
  await browser.close();
  console.log(`\n  ✓ captured ${totalFrames} frames`);
}

// ── 2. ffmpeg で WebP に集約（libwebp_anim） ────────────────────
function encode() {
  mkdirSync(dirname(OUT), { recursive: true });
  const args = [
    "-y",
    "-framerate", String(FPS),
    "-i", `${TMP}/frame-%04d.png`,
    "-vcodec", "libwebp_anim",
    "-lossless", "0",
    "-q:v", "78",                  // 仕様書 §6: 最高品質寄り
    "-loop", "0",                  // 無限ループ
    "-preset", "picture",
    "-an",
    "-vsync", "0",
    "-pix_fmt", "yuva420p",
    OUT,
  ];
  const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg failed");
  console.log(`  ✓ wrote ${OUT}`);
}

(async () => {
  console.log(`[hero-demo] capturing ${URL} @ ${WIDTH}x${HEIGHT} ${FPS}fps for ${DUR}s`);
  await capture();
  console.log(`[hero-demo] encoding to animated WebP`);
  encode();
  rmSync(TMP, { recursive: true, force: true });
  console.log(`[hero-demo] done.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
