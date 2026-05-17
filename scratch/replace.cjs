const fs = require('fs');

// og-vault.ts
let og = fs.readFileSync('api/og-vault.ts', 'utf8');
og = og.replace(/export const config = \{ runtime: 'nodejs' \};/g, "export const config = { runtime: 'nodejs', maxDuration: 60 };");
og = og.replace(/font-weight:\s*600/g, 'font-weight: 500');
og = og.replace(/font-weight:\s*700/g, 'font-weight: 800');
fs.writeFileSync('api/og-vault.ts', og);

// watermark.ts
let wm = fs.readFileSync('api/watermark.ts', 'utf8');
wm = wm.replace(/export const config = \{ runtime: 'nodejs' \};/g, "export const config = { runtime: 'nodejs', maxDuration: 60 };");
wm = wm.replace(/<span style="display:flex;">🛡<\/span>\n\s*/g, '');
wm = wm.replace(/font-weight:\s*700/g, 'font-weight: 800');
wm = wm.replace(/res\.setHeader\('Content-Type', 'image\/png'\);/g, "res.setHeader('Content-Type', 'image/png');\n        res.setHeader('Access-Control-Allow-Origin', '*');");
fs.writeFileSync('api/watermark.ts', wm);

console.log("Replacements done");
