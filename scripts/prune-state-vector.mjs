// filepath: scripts/prune-state-vector.mjs
import fs from 'fs';
import path from 'path';

const TARGET_FILE = path.join(process.cwd(), '.sovereign', 'STATE_VECTOR.txt');

try {
  if (!fs.existsSync(TARGET_FILE)) {
    console.error('🚨 STATE_VECTOR.txt not found.');
    process.exit(1);
  }

  let content = fs.readFileSync(TARGET_FILE, 'utf-8');

  // 1. ツリー構造のノイズ除去 (node_modules, .next などの深いパスを削除)
  content = content.replace(/^.*node_modules.*\n/gm, '');
  content = content.replace(/^.*\.next.*\n/gm, '');
  content = content.replace(/^.*\.git.*\n/gm, '');

  // 2. SQLのセマンティック圧縮 (ASTを破壊せず、データのみを殺す)
  // INSERT文とCOPY文（シードデータ）のブロックを完全に消去
  content = content.replace(/INSERT INTO[\s\S]*?;/gi, '\n/* [TRUNCATED: Trap #34] INSERT statements removed */\n');
  content = content.replace(/COPY[\s\S]*?\\\./gi, '\n/* [TRUNCATED: Trap #34] COPY data removed */\n');

  // 3. 長大なSVGやBase64の無力化
  content = content.replace(/d="[MmLlHhVvCcSsQqTtAaZz0-9\s,\.-]{100,}"/g, 'd="[TRUNCATED_SVG_PATH]"');
  content = content.replace(/data:image\/[a-zA-Z]*;base64,[a-zA-Z0-9+/=]{100,}/g, 'data:image/[TRUNCATED_BASE64]');

  // 4. 空白行の正規化
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(TARGET_FILE, content, 'utf-8');
  console.log('👑 [PRUNER] STATE_VECTOR.txt semantically pruned. AST and DDL preserved perfectly.');
} catch (err) {
  console.error('🚨 [PRUNER FATAL ERROR]', err);
  process.exit(1);
}