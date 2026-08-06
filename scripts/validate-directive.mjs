// filepath: scripts/validate-directive.mjs
import fs from 'fs';

const payloadPath = process.argv[2];

if (!payloadPath || !fs.existsSync(payloadPath)) {
  console.error('🚨 [VALIDATOR FATAL] Payload file not provided or missing.');
  process.exit(1);
}

const rawContent = fs.readFileSync(payloadPath, 'utf-8');

// 1. 純粋なXMLペイロードの抽出 (非貪欲マッチ [\s\S]*? を使用)
const xmlMatch = rawContent.match(/<sovereign_directive[\s\S]*?<\/sovereign_directive>/);

if (!xmlMatch) {
  console.error('🚨 [VALIDATOR REJECT] Missing <sovereign_directive> root tags. Invalid Brain output.');
  process.exit(1);
}

const pureXmlPayload = xmlMatch[0];

// 2. Trap #35: Brain(Gemini)の生コード記述禁止チェック
// 公式ドキュメント(scout_ground_truth)は生コードを含んで良いため、検査対象から除外する
const textToAudit = pureXmlPayload.replace(/<scout_ground_truth>[\s\S]*?<\/scout_ground_truth>/g, '');

const codeBlockRegex = /```(ts|tsx|js|jsx|sql|python|bash|sh|php|go|rust|java|c|cpp)/i;
if (codeBlockRegex.test(textToAudit)) {
  console.error('🚨 [VALIDATOR REJECT: TRAP #35] The Brain generated raw code blocks outside Ground Truth. Delegation protocol violated.');
  process.exit(1);
}

// 3. 浄化されたXMLで上書き
fs.writeFileSync(payloadPath, pureXmlPayload, 'utf-8');

console.log('👑 [VALIDATOR] Payload purified and integrity verified. Safe for Infantry execution.');
process.exit(0);