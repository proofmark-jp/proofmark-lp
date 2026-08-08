#!/usr/bin/env bash
# 👑 FINALSIG.APP: THE DETONATOR SCRIPT (Self-Healing & Autopsy Build)

PAYLOAD_FILE=$1
MODEL_OPTION=$2
PRUNER_SCRIPT="scripts/prune-state-vector.mjs"
ERROR_LOG=".sovereign_error.log"

if [ -z "$PAYLOAD_FILE" ] || [ ! -f "$PAYLOAD_FILE" ]; then
  echo "🚨 [FATAL ERROR] Payload file missing." ; exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "🚨 [FATAL ERROR] Working directory not clean. Aborting." ; exit 1
fi

PAYLOAD_BASENAME=$(basename "$PAYLOAD_FILE")
TARGET_MODEL="sonnet"
MAX_TURNS=7

if [ "$MODEL_OPTION" == "--opus" ]; then TARGET_MODEL="opus"; MAX_TURNS=10; fi
if [ "$MODEL_OPTION" == "--fable" ]; then TARGET_MODEL="fable"; MAX_TURNS=15; fi

# ---------------------------------------------------------
# [検死・絶対消滅プロトコル] 失敗時に証拠を残しつつ、WSは一瞬で復元
# ---------------------------------------------------------
abort_and_clean() {
  local REASON=$1
  echo -e "\n🚨 [ABORT] Detonation failed: $REASON"
  
  echo "📝 Extracting Autopsy Report to $ERROR_LOG..."
  echo "=== AUTOPSY REPORT: $REASON ===" > "$ERROR_LOG"
  echo "Timestamp: $(date)" >> "$ERROR_LOG"
  
  # 変更があればDiffを記録、なければ直近の状態を記録
  if [ -n "$(git status --porcelain)" ]; then
    git diff >> "$ERROR_LOG" 2>&1
    git diff --cached >> "$ERROR_LOG" 2>&1
  else
    echo "No file changes detected before crash." >> "$ERROR_LOG"
  fi
  
  echo "Executing absolute rollback (git reset --hard)..."
  git reset --hard HEAD > /dev/null 2>&1
  # ペイロードファイルと検死レポートだけは保護してクリーンアップ
  git clean -fd -e "$PAYLOAD_BASENAME" -e "$ERROR_LOG" > /dev/null 2>&1
  
  echo "🛡️ [WORKSPACE SECURED] All partial changes annihilated. Error log saved to $ERROR_LOG."
  exit 1
}
trap 'abort_and_clean "Interrupted by OS/User"' SIGINT SIGTERM

echo "👑 [DETONATOR] Initiating Sovereign Workflow..."

# [関所1] Bashネイティブなペイロード検証
if ! grep -q "<sovereign_directive>" "$PAYLOAD_FILE"; then
  echo "🚨 [FATAL ERROR] Missing <sovereign_directive> tags."
  exit 1
fi

# [実行] Claude Code (The Autonomous Infantry)
echo "🚀 Detonating [$TARGET_MODEL] (Max Turns: $MAX_TURNS)..."
set +e
# 破壊的行動は禁じつつ、Lint等による自己修復は促すプロンプト
claude -p "Execute the directive in $PAYLOAD_FILE exactly. Auto-approve commands. You may run lint/tests to fix errors before exiting." --model "$TARGET_MODEL" --max-turns "$MAX_TURNS"
CLAUDE_EXIT_CODE=$?
set -e

if [ $CLAUDE_EXIT_CODE -ne 0 ]; then
  abort_and_clean "Claude Code CLI Crashed (Exit Code: $CLAUDE_EXIT_CODE)"
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "⚠️ [DETONATOR SUCCESS] No changes made by Infantry."
  exit 0
fi

# [同期] STATE_VECTOR 更新 & Pruning
echo "🟢 [EXECUTION COMPLETE] Updating Sovereign State..."
npm run state:sync > /dev/null 2>&1 || true
if [ -f "$PRUNER_SCRIPT" ]; then
  node "$PRUNER_SCRIPT" > /dev/null 2>&1 || true
fi

# [物理的検証]
echo "🔍 Verifying integrity..."
# Lintでエラーが出た場合はログを一時ファイルに吐き、それを検死レポートに含める
if ! npm run lint > .lint_temp.log 2>&1; then
  cat .lint_temp.log >> "$ERROR_LOG"
  rm -f .lint_temp.log
  abort_and_clean "Linting Failed after Claude execution"
fi
rm -f .lint_temp.log

# [関所2] BashネイティブなB2C Vanguard Doctrine 監視
git add -A
if git diff --cached --name-only | grep -qE "(enterprise\.finalsig\.app|api/mcp|api/enterprise|api/webhooks/saml|sdk)/"; then
  abort_and_clean "B2C Vanguard Doctrine Violated (B2B paths modified)"
fi

git commit -m "feat(auto): Infantry execution of sovereign directive"
echo "👑 [DETONATOR SUCCESS] Clean commit created. Pipeline complete."
# 成功時は過去のエラーログを掃除
rm -f "$ERROR_LOG"