#!/usr/bin/env bash
# ─────────────────────────────────────────────
# ProofMark Phase 11.A — Disallowed Words Linter
# ─────────────────────────────────────────────
# 信頼商品としてユーザーに見せるコピーに残ってはいけない過剰断定を検出する。
#
# - .ts / .tsx の JSX/文字列リテラルに残った場合のみ検出する
# - コメント行 (// で始まる行 / * で始まる行) は除外
# - "lint-disallow" マーカーがある行は除外（例示用コメント）
#
# Usage:
#   bash docs/lint-disallowed-words.sh        # src/ をチェック
#   bash docs/lint-disallowed-words.sh src/   # 引数指定可
#
# CI 統合例:
#   - name: Honesty Lint
#     run: bash docs/lint-disallowed-words.sh src/

set -e

ROOT="${1:-src}"

# Phase 11.A SSOT: TrustCenter §1 のトーンを上限とする
# 法的断定 / 過剰約束 / 裏取りなしの断定
DISALLOWED_PATTERN='先取権|必ず勝てる|裁判で勝てる|絶対に守る|改ざん不可能|定期監査済み|完全準拠|100%安全|100%ありません|反論不可能なレベル|採用実績が極めて高い|揺るぎない事実を刻み込み|絶対的証拠'

echo "🔍 Scanning ${ROOT}/ for disallowed phrases (excluding comments/examples)..."

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
  echo "❌ Disallowed phrase(s) detected in non-comment code/strings."
  echo "   Refactor to neutral phrasing per docs/HONESTY_DOWNGRADE_MAP.md"
  echo "   SSOT トーン上限: TrustCenter.tsx §1 (脅威モデル)"
  exit 1
fi

echo "✅ No disallowed phrases found in user-visible strings."
exit 0
