// filepath: scripts/prune-state-vector.mjs
import fs from 'fs';
import path from 'path';

const TARGET_FILE = path.join(process.cwd(), '.sovereign', 'STATE_VECTOR_Z1.txt');

try {
  if (!fs.existsSync(TARGET_FILE)) {
    console.error('🚨 STATE_VECTOR_Z1.txt not found. Synchronization failed.');
    process.exit(1);
  }

  let content = fs.readFileSync(TARGET_FILE, 'utf-8');

  // 1. 複数行SQLデータのセマンティック圧縮 (ASTを維持し、データのみ破壊)
  content = content.replace(/INSERT INTO[^;]+;/gi, '\n/* [TRUNCATED] INSERT data removed */\n');
  content = content.replace(/COPY[^;]+;/gi, '\n/* [TRUNCATED] COPY data removed */\n');

  // 2. CSIを即死させる巨大SVG/Base64の無力化
  content = content.replace(/d="[a-zA-Z0-9\s,\.-]{100,}"/g, 'd="[TRUNCATED_SVG]"');
  content = content.replace(/data:image\/[a-zA-Z]*;base64,[a-zA-Z0-9+/=]{100,}/g, 'data:image/[TRUNCATED_BASE64]');

  // 3. 空白行の正規化
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(TARGET_FILE, content, 'utf-8');
  console.log('👑 [PRUNER] STATE_VECTOR_Z1.txt pruned (Core semantic targets only).');
} catch (err) {
  console.error('🚨 [PRUNER FATAL ERROR]', err);
  process.exit(1);
}