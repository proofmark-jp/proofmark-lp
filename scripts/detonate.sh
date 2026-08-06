#!/usr/bin/env bash
# 👑 FINALSIG.APP: THE DETONATOR SCRIPT (Trap #36) - SINGULARITY BUILD

PAYLOAD_FILE=$1
PRUNER_SCRIPT="scripts/prune-state-vector.mjs"

if [ -z "$PAYLOAD_FILE" ] || [ ! -f "$PAYLOAD_FILE" ]; then
  echo "🚨 [FATAL ERROR] Payload file required."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "🚨 [FATAL ERROR] Working directory is not clean. Aborting."
  exit 1
fi

BASE_BRANCH=$(git branch --show-current)
TARGET_BRANCH="infantry/$(date +'%Y%m%d-%H%M%S')"

# ---------------------------------------------------------
# [絶対消滅プロトコル] シグナル割り込み時のハードリセット
# ---------------------------------------------------------
cleanup_on_interrupt() {
  echo -e "\n🚨 [INTERRUPT] Script killed. Executing absolute annihilation of partial state..."
  git reset --hard HEAD
  git clean -fd
  git checkout "$BASE_BRANCH" || true
  git branch -D "$TARGET_BRANCH" || true
  echo "🛡️ [WORKSPACE SECURED] All partial changes destroyed. Returned to $BASE_BRANCH."
  exit 1
}
trap cleanup_on_interrupt SIGINT SIGTERM

echo "👑 [DETONATOR] Initiating Sovereign Workflow..."
git checkout -b "$TARGET_BRANCH"

# [関所1] ペイロード浄化・検閲
echo "🔍 Validating Payload..."
if ! node scripts/validate-directive.mjs "$PAYLOAD_FILE"; then
  echo "🚨 [FATAL ERROR] Payload validation failed."
  git checkout "$BASE_BRANCH"
  git branch -d "$TARGET_BRANCH"
  trap - SIGINT SIGTERM
  exit 1
fi

# [実行] Claude Code (The Infantry) 起爆
set +e
claude -p "Execute the directive in $PAYLOAD_FILE exactly. Auto-approve all commands. DO NOT run linting or tests yourself; the Bash script will handle verification. Finish and exit."
CLAUDE_EXIT_CODE=$?
set -e

# [関所1.5] ゾンビ実行トラップの物理的遮断
if [ $CLAUDE_EXIT_CODE -ne 0 ]; then
  echo "🚨 [CLAUDE CRASHED] The Infantry terminated abnormally (Exit Code: $CLAUDE_EXIT_CODE)."
  echo "Sealing broken state for forensic analysis..."
  git add -A
  git commit -m "chore(broken): claude code crashed" --no-verify || true
  git checkout "$BASE_BRANCH"
  git clean -fd # Untrackedファイルの残留を防ぐ
  trap - SIGINT SIGTERM
  exit 1
fi

# [同期] STATE_VECTOR 更新 & Pruning
echo "🟢 [EXECUTION COMPLETE] Updating Sovereign State..."
npm run state:sync || true
if [ -f "$PRUNER_SCRIPT" ]; then
  node "$PRUNER_SCRIPT" || true
fi

# ---------------------------------------------------------
# [生還プロトコル] No-Op 判定とブランチ消却
# ---------------------------------------------------------
if [ -z "$(git status --porcelain)" ]; then
  echo "⚠️ [DETONATOR SUCCESS] No code changes were made. Purging empty branch."
  git checkout "$BASE_BRANCH"
  git branch -d "$TARGET_BRANCH"
  trap - SIGINT SIGTERM
  exit 0
fi

# [関所2] 物理的検証 (Linter) と教義監視 (B2C Gate)
echo "🔍 Verifying integrity (Lint/TypeCheck)..."
if npm run lint; then
  echo "🔍 Auditing B2C Vanguard Doctrine..."
  if node scripts/validate-b2c-gate.mjs; then
    git add -A
    git commit -m "feat(auto): Infantry execution of directive"
    echo "👑 [DETONATOR SUCCESS] Clean commit created on $TARGET_BRANCH."
    trap - SIGINT SIGTERM
    exit 0
  else
    echo "🚨 [B2C GATE FAILED] Infantry violated B2C Vanguard Doctrine."
  fi
else
  echo "🚨 [LINT FAILED] Code is corrupt."
fi

# ---------------------------------------------------------
# エラー時の封印と帰還 (Untracked Phantomの破壊)
# ---------------------------------------------------------
git add -A
git commit -m "chore(broken): failed execution or doctrine violation" --no-verify || true
git checkout "$BASE_BRANCH"
git clean -fd # 隔離ブランチで作られたUntrackedファイルをmainに残さない
trap - SIGINT SIGTERM
exit 1