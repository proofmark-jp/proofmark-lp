#!/bin/bash
# ProofMark Brand & Legal Safety Linter

echo "🔍 Scanning for disallowed words (Brand & Legal Safety)..."

# 弾くべきNGワードのリスト（正規表現で | を使って区切ります）
# ※「改ざん不可能」はNG、「改ざんを検知可能」はOK
# ※「法的に担保」はNG、「客観的証拠能力」はOK
DISALLOWED_WORDS="法的に担保|法的に証明|法的効力を|絶対に安全|100%安全|特許取得済み|改ざん不可能"

# 検索対象のディレクトリ（src配下を指定）
SEARCH_DIRS="client/src api"

# grep で検索を実行
# -E : 拡張正規表現を使用
# -r : ディレクトリを再帰的に検索
# -n : 行番号を表示
# --exclude-dir: node_modules等を無視
# --exclude: このスクリプト自体を検索対象から外す
MATCHES=$(grep -Ern --exclude-dir=node_modules --exclude-dir=.git --exclude="lint-disallowed-words.sh" "$DISALLOWED_WORDS" $SEARCH_DIRS)

if [ -n "$MATCHES" ]; then
  echo "❌ [ERROR] 致命的なリーガル/ブランドリスクワードが検出されました！"
  echo "以下のファイルと行を確認し、過剰断定表現を修正してください："
  echo "---------------------------------------------------"
  echo "$MATCHES"
  echo "---------------------------------------------------"
  echo "💡 ヒント: 「改ざん不可能」→「改ざんが検知可能」、「法的に担保」→「客観的証拠能力を確保」に修正してください。"
  exit 1 # 異常終了（CIをここでFailさせる）
else
  echo "✅ No disallowed words found. Brand safety check passed."
  exit 0 # 正常終了
fi