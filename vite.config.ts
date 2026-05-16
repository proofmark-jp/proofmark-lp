import { jsxLocPlugin } from '@builder.io/vite-plugin-jsx-loc';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { vitePluginManusRuntime } from 'vite-plugin-manus-runtime';

// =============================================================================
//  Manus Debug Collector (既存のまま、変更なし)
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, '.manus-logs');
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);

type LogSource = 'browserConsole' | 'networkRequests' | 'sessionReplay';

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number): void {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) return;
    const lines = fs.readFileSync(logPath, 'utf-8').split('\n');
    const keptLines: string[] = [];
    let keptBytes = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, 'utf-8');
      if (keptBytes + lineBytes > TRIM_TARGET_BYTES) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join('\n'), 'utf-8');
  } catch {
    /* ignore */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]): void {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join('\n')}\n`, 'utf-8');
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

function vitePluginManusDebugCollector(): Plugin {
  return {
    name: 'manus-debug-collector',
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === 'production') return html;
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { src: '/__manus__/debug-collector.js', defer: true },
            injectTo: 'head',
          },
        ],
      };
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__manus__/logs', (req, res, next) => {
        if (req.method !== 'POST') return next();

        const handlePayload = (payload: {
          consoleLogs?: unknown[];
          networkRequests?: unknown[];
          sessionEvents?: unknown[];
        }): void => {
          if (payload.consoleLogs?.length) writeToLogFile('browserConsole', payload.consoleLogs);
          if (payload.networkRequests?.length) writeToLogFile('networkRequests', payload.networkRequests);
          if (payload.sessionEvents?.length) writeToLogFile('sessionReplay', payload.sessionEvents);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === 'object') {
          try {
            handlePayload(reqBody as Parameters<typeof handlePayload>[0]);
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            handlePayload(JSON.parse(body));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// =============================================================================
//  Manual Chunks — Vendor の論理分割
// =============================================================================
//
//  方針:
//   1. ルーター/Reactコアは初期 critical bundle に残す (Suspense 動作に必須)
//   2. framer-motion / lucide-react は LP 中で多用するが、ルート遅延の対象
//      コンポーネントが import しているので副次的に chunk 化させる
//   3. supabase / @supabase は認証必須のためログイン後に主に使う → 別チャンク
//   4. 暗号系 (hash-wasm, c2pa, openpgp 等) は Dropzone 経由なので別チャンク
//   5. icon ライブラリ (lucide-react) も体積が大きい → 単独 chunk
//   6. 解析系 (recharts / d3) があれば admin 専用 chunk
//
//  注意:
//   - manualChunks 関数は「同じ module を 2 つの chunk に入れない」必要がある
//   - 戻り値が undefined のモジュールは Rollup の自動分割に任せる
//
// =============================================================================

type ChunkName =
  | 'vendor-react'
  | 'vendor-router'
  | 'vendor-motion'
  | 'vendor-icons'
  | 'vendor-supabase'
  | 'vendor-crypto'
  | 'vendor-charts'
  | 'vendor-ui';

function pickVendorChunk(id: string): ChunkName | undefined {
  if (!id.includes('node_modules')) return undefined;

  // React core (critical) — Suspense fallback を出すために最初に到着させる
  if (
    id.includes('/node_modules/react/') ||
    id.includes('/node_modules/react-dom/') ||
    id.includes('/node_modules/scheduler/') ||
    id.includes('/node_modules/react-helmet-async/')
  ) {
    return 'vendor-react';
  }

  // Routing — wouter は小さいが React と密結合
  if (id.includes('/node_modules/wouter')) {
    return 'vendor-router';
  }

  // Motion (LP/HeroDemo 専用、admin では呼ばれない)
  if (
    id.includes('/node_modules/framer-motion') ||
    id.includes('/node_modules/motion/') ||
    id.includes('/node_modules/popmotion')
  ) {
    return 'vendor-motion';
  }

  // Icons (lucide-react は ESM tree-shake が効くが nominal で chunk 化)
  if (id.includes('/node_modules/lucide-react')) {
    return 'vendor-icons';
  }

  // Supabase / GoTrue / Realtime (認証必須・ログイン後の主役)
  if (
    id.includes('/node_modules/@supabase/') ||
    id.includes('/node_modules/postgrest-js') ||
    id.includes('/node_modules/realtime-js')
  ) {
    return 'vendor-supabase';
  }

  // Crypto (hash-wasm / c2pa-js / openpgp 等)
  if (
    id.includes('/node_modules/hash-wasm') ||
    id.includes('/node_modules/c2pa') ||
    id.includes('/node_modules/@contentauth') ||
    id.includes('/node_modules/openpgp') ||
    id.includes('/node_modules/asn1js') ||
    id.includes('/node_modules/pkijs')
  ) {
    return 'vendor-crypto';
  }

  // 分析系 (admin で必要、LP では未使用)
  if (
    id.includes('/node_modules/recharts') ||
    id.includes('/node_modules/d3-') ||
    id.includes('/node_modules/victory')
  ) {
    return 'vendor-charts';
  }

  // shadcn/Radix UI primitives (Dialog/Tooltip 等)
  if (
    id.includes('/node_modules/@radix-ui/') ||
    id.includes('/node_modules/sonner') ||
    id.includes('/node_modules/cmdk') ||
    id.includes('/node_modules/vaul')
  ) {
    return 'vendor-ui';
  }

  return undefined;
}

// =============================================================================
//  defineConfig
// =============================================================================

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  vitePluginManusRuntime(),
  vitePluginManusDebugCollector(),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, 'client'),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    // 警告閾値は厳しく。これを 3000kB のままにすると分割不備に気付けない
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: pickVendorChunk,
        // ハッシュ付与で長期キャッシュを効かせる
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  // hash-wasm は wasm を fetch するため pre-bundle 対象から外す
  optimizeDeps: {
    exclude: ['hash-wasm'],
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    allowedHosts: [
      '.manuspre.computer',
      '.manus.computer',
      '.manus-asia.computer',
      '.manuscomputer.ai',
      '.manusvm.computer',
      'localhost',
      '127.0.0.1',
    ],
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
});
