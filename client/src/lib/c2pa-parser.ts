// client/src/lib/c2pa-parser.ts
/**
 * C2PA Manifest Parser (Lightweight Heuristic Edition)
 * ────────────────────────────────────────────────────────────────
 * DB から取得した `c2pa_manifest` (JSON もしくは文字列) を
 * Widget 用の軽量シグナル `WidgetC2paSignal` に安全変換する。
 *
 * 設計方針:
 *  - 厳格な C2PA SDK は持ち込まない (Bundle Size 防衛)
 *  - パースエラーで絶対にクラッシュしない (try/catch + null-safe)
 *  - 文字列ヒューリスティックは「含むだけで黒」ではなく
 *    JSON 全文を string 化してから case-insensitive にスキャン
 */

export type WidgetC2paSignal = {
  signatureValid: boolean;
  isAiGenerated: boolean;
  isHumanEdited: boolean;
  generatorName?: string;
  editorName?: string;
};

/* ─── ヒューリスティック辞書 ─── */
const AI_KEYWORDS: Array<{ key: RegExp; label: string }> = [
  { key: /midjourney/i, label: 'Midjourney' },
  { key: /dall[\s\-]?e/i, label: 'DALL·E' },
  { key: /stable[\s\-]?diffusion/i, label: 'Stable Diffusion' },
  { key: /firefly/i, label: 'Adobe Firefly' },
  { key: /nano[\s\-]?banana/i, label: 'Nano Banana' },
  { key: /gemini/i, label: 'Gemini' },
  { key: /sora/i, label: 'Sora' },
  { key: /\bai[\s\-]?generated\b/i, label: 'AI Generated' },
  { key: /\bgenerative[\s\-]?ai\b/i, label: 'Generative AI' },
];

const HUMAN_EDITOR_KEYWORDS: Array<{ key: RegExp; label: string }> = [
  { key: /photoshop/i, label: 'Photoshop' },
  { key: /lightroom/i, label: 'Lightroom' },
  { key: /clip[\s\-]?studio/i, label: 'CLIP STUDIO' },
  { key: /procreate/i, label: 'Procreate' },
  { key: /affinity/i, label: 'Affinity' },
  { key: /capture[\s\-]?one/i, label: 'Capture One' },
  { key: /\bgimp\b/i, label: 'GIMP' },
  { key: /krita/i, label: 'Krita' },
];

function safeStringify(input: unknown): string {
  try {
    if (input == null) return '';
    if (typeof input === 'string') return input;
    return JSON.stringify(input);
  } catch {
    return '';
  }
}

function detectFirst(
  haystack: string,
  dict: Array<{ key: RegExp; label: string }>,
): string | undefined {
  for (const entry of dict) {
    if (entry.key.test(haystack)) return entry.label;
  }
  return undefined;
}

/**
 * c2pa_manifest を安全にパースして WidgetC2paSignal を返す。
 * 入力が null / undefined / 不正 JSON でも例外を投げず、
 * すべての signal が false の中立な結果を返す。
 */
export function parseC2paManifest(raw: unknown): WidgetC2paSignal {
  const neutral: WidgetC2paSignal = {
    signatureValid: false,
    isAiGenerated: false,
    isHumanEdited: false,
  };

  if (raw == null) return neutral;

  let manifest: unknown = raw;

  // 文字列で来た場合は JSON.parse を試す (失敗しても続行)
  if (typeof raw === 'string') {
    try {
      manifest = JSON.parse(raw);
    } catch {
      manifest = raw; // 生文字列のまま heuristic を試す
    }
  }

  try {
    const blob = safeStringify(manifest);
    if (!blob) return neutral;

    // 1) Signature validity
    //    マニフェスト内に signature 系のキー or "valid":true を含むなら true
    const signatureValid =
      /"signature"\s*:/i.test(blob) ||
      /"validation_status"\s*:\s*"valid"/i.test(blob) ||
      /"valid"\s*:\s*true/i.test(blob);

    // 2) AI Generated
    const aiHit = detectFirst(blob, AI_KEYWORDS);
    const isAiGenerated = !!aiHit;

    // 3) Human Edited
    const humanHit = detectFirst(blob, HUMAN_EDITOR_KEYWORDS);
    const isHumanEdited = !!humanHit;

    // 4) generator / editor name 推定 (claim_generator 優先)
    let generatorName: string | undefined;
    let editorName: string | undefined;

    if (manifest && typeof manifest === 'object') {
      const m = manifest as Record<string, any>;
      const claim =
        m.claim_generator ??
        m.claimGenerator ??
        m?.manifest?.claim_generator ??
        m?.active_manifest?.claim_generator;
      if (typeof claim === 'string' && claim.length > 0) {
        if (isAiGenerated) generatorName = aiHit ?? claim;
        else if (isHumanEdited) editorName = humanHit ?? claim;
      }
    }

    if (!generatorName && isAiGenerated) generatorName = aiHit;
    if (!editorName && isHumanEdited) editorName = humanHit;

    return {
      signatureValid,
      isAiGenerated,
      isHumanEdited,
      generatorName,
      editorName,
    };
  } catch {
    return neutral;
  }
}
