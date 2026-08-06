#!/usr/bin/env bash
# 👑 FINALSIG.APP: THE DETONATOR SCRIPT (Trap #36)
# Usage: ./scripts/detonate.sh path/to/payload.xml

PAYLOAD_FILE=$1
PRUNER_SCRIPT="scripts/prune-state-vector.mjs"

if [ -z "$PAYLOAD_FILE" ] || [ ! -f "$PAYLOAD_FILE" ]; then
  echo "🚨 [FATAL ERROR] Payload file required."
  exit 1
fi

# 0. ワークスペースのクリーンチェック (Dirtyな状態での起爆を法的に禁ずる)
if [ -n "$(git status --porcelain)" ]; then
  echo "🚨 [FATAL ERROR] Working directory is not clean. Aborting to prevent data loss."
  exit 1
fi

BASE_BRANCH=$(git branch --show-current)
TARGET_BRANCH="infantry/$(date +'%Y%m%d-%H%M%S')"

echo "👑 [DETONATOR] Initiating Sovereign Workflow..."
git checkout -b "$TARGET_BRANCH"
echo "🟢 [GIT] Switched to isolated branch: $TARGET_BRANCH"

# 1. Claude Code 実行フェーズ
set +e
claude -p "Execute the directive in $PAYLOAD_FILE exactly. Auto-approve all commands. DO NOT run linting or tests yourself; the Bash script will handle verification. Finish and exit."
set -e

echo "🟢 [EXECUTION COMPLETE] Updating Sovereign State..."

# 2. 絶対同期フェーズ
npm run state:sync || true

# 3. Semantic Pruning (Trap #34)
if [ -f "$PRUNER_SCRIPT" ]; then
  node "$PRUNER_SCRIPT" || true
fi

# 4. 物理的検証と絶対ロールバック (The Absolute Rollback Protocol)
echo "🔍 Verifying integrity (Lint/TypeCheck)..."
if npm run lint; then
  git add -A
  git commit -m "feat(auto): Infantry execution of directive"
  echo "👑 [DETONATOR SUCCESS] Clean commit created on $TARGET_BRANCH."
  echo "💡 Ready for PR merge into $BASE_BRANCH."
else
  echo "🚨 [LINT FAILED] Code is corrupt. Sealing broken state and reverting workspace."
  git add -A
  git commit -m "chore(broken): failed execution - requires human/oracle review" --no-verify
  
  # 創業者をゴミの中に置き去りにしない。安全な基地へ強制帰還させる。
  git checkout "$BASE_BRANCH"
  echo "🛡️ [WORKSPACE SECURED] Returned to $BASE_BRANCH. Broken code isolated in $TARGET_BRANCH."
  exit 1
fi