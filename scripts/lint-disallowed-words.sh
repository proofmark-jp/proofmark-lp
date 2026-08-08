#!/usr/bin/env bash
# ─────────────────────────────────────────────
# FinalSig.app — Brand Safety & Disallowed Words Linter
# ─────────────────────────────────────────────
# 信頼商品としてユーザーに見せるコピーに残ってはいけない過剰断定、
# および旧ブランド名（ProofMark）の残滓を検出する絶対防衛線。
#
# - .ts / .tsx の JSX/文字列リテラルに残った場合のみ検出する
# - コメント行 (// で始まる行 / * で始まる行) は除外
# - "lint-disallow" マーカーがある行は除外（例示用コメント）

set -e

ROOT="${1:-src}"

# B2C Vanguard Doctrine / Cryptographic Brutalism
# 旧ブランド名 / 法的断定 / 過剰約束 / 裏取りなしの断定
DISALLOWED_PATTERN='[Pp]roof[Mm]ark|PROOFMARK|先取権|必ず勝てる|裁判で勝てる|絶対に守る|改ざん不可能|定期監査済み|完全準拠|100%安全|100%ありません|反論不可能なレベル|採用実績が極めて高い|揺るぎない事実を刻み'

echo "🔍 Scanning ${ROOT}/ for brand safety violations and disallowed phrases..."

HITS=$(
  grep -rEn "$DISALLOWED_PATTERN" "$ROOT" \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=_backup 2>/dev/null \
  | grep -vE '^\s*//' \
  | grep -vE ':\s*\*' \
  | grep -vE 'lint-disallow' \
  || true
)

if [ -n "$HITS" ]; then
  echo "$HITS"
  echo ""
  echo "❌ [FATAL] Brand safety violation or legacy phrase(s) detected."
  echo "   Refactor to neutral phrasing per Cryptographic Brutalism."
  echo "   Ensure NO remnants of the legacy brand exist."
  exit 1
fi

echo "✅ Brand safety verified. No legacy or disallowed phrases found."
exit 0