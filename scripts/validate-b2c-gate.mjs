// filepath: scripts/validate-b2c-gate.mjs
import { execSync } from 'child_process';

const B2B_RESTRICTED_PATHS = [
  /(^|\/)enterprise\.finalsig\.app\//,
  /(^|\/)api\/mcp\//,
  /(^|\/)api\/enterprise\//,
  /(^|\/)api\/webhooks\/saml/,
  /(^|\/)sdk\//
];

try {
  // --deleted を追加し、削除行為による教義違反も絶対に検知する
  const statusOutput = execSync('git ls-files --others --modified --deleted --exclude-standard', { encoding: 'utf-8' });
  
  if (!statusOutput.trim()) {
    console.log('👑 [B2C GATE] No changes detected.');
    process.exit(0);
  }

  const modifiedFiles = statusOutput.split('\n').filter(Boolean);

  for (const file of modifiedFiles) {
    for (const regex of B2B_RESTRICTED_PATHS) {
      if (regex.test(file)) {
        console.error(`🚨 [B2C GATE REJECT] Infantry attempted to modify/delete a B2B restricted path: ${file}`);
        console.error(`🔒 B2C Vanguard Doctrine: No B2B code shall be touched until Phase 5.5 clears.`);
        process.exit(1);
      }
    }
  }

  console.log('👑 [B2C GATE] No doctrinal violations detected in workspace.');
  process.exit(0);
} catch (err) {
  console.error('🚨 [B2C GATE FATAL ERROR]', err.message);
  process.exit(1);
}