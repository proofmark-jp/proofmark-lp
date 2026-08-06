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

  // 1. ツリー構造のノイズ除去
  content = content.replace(/^.*node_modules.*\n/gm, '');
  content = content.replace(/^.*\.next.*\n/gm, '');
  content = content.replace(/^.*\.git.*\n/gm, '');

  // 2. SQLのセマンティック圧縮 (OOMを回避する安全な正規表現)
  // [^;]+ を使用し、セミコロンまでの最長一致を高速に処理する
  content = content.replace(/INSERT INTO[^;]+;/gi, '\n/* [TRUNCATED] INSERT data removed */\n');
  content = content.replace(/COPY[^;]+;/gi, '\n/* [TRUNCATED] COPY data removed */\n');

  // 3. 長大なSVGやBase64の無力化
  content = content.replace(/d="[a-zA-Z0-9\s,\.-]{100,}"/g, 'd="[TRUNCATED_SVG]"');
  content = content.replace(/data:image\/[a-zA-Z]*;base64,[a-zA-Z0-9+/=]{100,}/g, 'data:image/[TRUNCATED_BASE64]');

  // 4. 空白行の正規化
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(TARGET_FILE, content, 'utf-8');
  console.log('👑 [PRUNER] STATE_VECTOR.txt semantically pruned. CPU/Memory safe.');
} catch (err) {
  console.error('🚨 [PRUNER FATAL ERROR]', err);
  process.exit(1);
}