/**
 * lib/crypto/hashWorker.ts — The Merkle Forge
 *
 * - OWASP準拠: PBKDF2 600,000 Iterations
 * - Merkle Chain: 前のファイルのハッシュを次のファイルに巻き込んで連鎖させる
 * - Web Worker駆動でメインスレッド（UI）のフリーズを完全回避
 */

const PBKDF2_ITERATIONS = 600000; // 🚨 ハッカーを絶望させる 60万回の壁
const SALT_SIZE = 16;
const CHUNK_SIZE = 1024 * 1024 * 5; // 5MB chunks

self.onmessage = async (e: MessageEvent) => {
  const { files, password } = e.data;
  
  try {
    // 1. マスターキー（Vault Key）の生成
    let vaultKey = null;
    let salt = null;
    if (password) {
      salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
      const keyMaterial = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
      );
      vaultKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
      );
    }

    const results = [];
    let prevHashHex = "0000000000000000000000000000000000000000000000000000000000000000"; // Genesis Root

    // 2. Merkle Chain 構築 (直列処理で連鎖を編み込む)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      
      // 前のハッシュと現在のファイルを結合して新しいハッシュを作る (Chain of Evidence)
      const encoder = new TextEncoder();
      const prevHashBytes = encoder.encode(prevHashHex);
      const combined = new Uint8Array(prevHashBytes.length + buffer.byteLength);
      combined.set(prevHashBytes, 0);
      combined.set(new Uint8Array(buffer), prevHashBytes.length);

      const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      prevHashHex = hashHex; // 次のチェーンへ引き継ぐ

      results.push({
        index: i,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        sha256: hashHex,
        // ※ 実際の暗号化（AES-GCM）はこの後UI側または別ステップで行うための準備
      });

      // UIにプログレスを通知
      self.postMessage({ type: 'progress', index: i, total: files.length, sha256: hashHex });
    }

    self.postMessage({ type: 'complete', results, salt, vaultKey });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err.message });
  }
};