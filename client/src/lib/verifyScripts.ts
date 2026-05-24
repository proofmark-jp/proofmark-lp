/**
 * verifyScripts.ts
 * ─────────────────────────────────────────────────────────────
 *  ZIP に同梱する独立検証スクリプト群。
 *  サーバを必要としない・OpenSSL のみで完結する設計を維持する。
 * ─────────────────────────────────────────────────────────────
 */

export const generateVerifySh = (
  expectedHash: string,
  fileName: string,
): string => `#!/bin/bash
# ============================================
#  ProofMark 存在証明 検証スクリプト (Shell)
#  対応OS: macOS, Linux, WSL
# ============================================
# 使い方: bash verify.sh "${fileName}"
# ============================================

FILE="\$1"
EXPECTED_HASH="${expectedHash}"

if [ -z "\$FILE" ]; then
  echo "使い方: bash verify.sh <検証するファイルのパス>"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   ProofMark Evidence Pack 検証      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Step 1: SHA-256 ──────────────────────────
echo "[1/2] SHA-256 ハッシュを検証しています..."
COMPUTED=\$(shasum -a 256 "\$FILE" 2>/dev/null | awk '{print \$1}')
if [ -z "\$COMPUTED" ]; then
  COMPUTED=\$(sha256sum "\$FILE" 2>/dev/null | awk '{print \$1}')
fi

if [ "\$COMPUTED" = "\$EXPECTED_HASH" ]; then
  echo "  ✅ SHA-256 一致確認"
  echo "     \$COMPUTED"
else
  echo "  ❌ SHA-256 不一致 — ファイルが改変されている可能性があります"
  echo "  期待値: \$EXPECTED_HASH"
  echo "  実測値: \$COMPUTED"
  exit 1
fi

echo ""

# ── Step 2: RFC3161 タイムスタンプ ───────────
echo "[2/2] RFC3161 タイムスタンプを検証しています..."
SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
TSR_FILE="\$SCRIPT_DIR/TIMESTAMP.tsr"

if [ ! -f "\$TSR_FILE" ]; then
  echo "  ⚠️  TIMESTAMP.tsr が見つかりません"
  exit 1
fi

openssl ts -verify -in "\$TSR_FILE" -data "\$FILE" \\
  -CAfile /etc/ssl/certs/ca-certificates.crt 2>&1 | \\
  grep -E "Verification|Error|OK"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   検証完了                          ║"
echo "╚══════════════════════════════════════╝"
echo ""
`;

export const generateVerifyPy = (
  expectedHash: string,
  fileName: string,
): string => `#!/usr/bin/env python3
"""
ProofMark 存在証明 検証スクリプト (Python)
使い方: python3 verify.py "${fileName}"
"""
import hashlib
import subprocess
import sys
import os

EXPECTED_HASH = "${expectedHash}"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def verify_sha256(filepath: str) -> bool:
    print("[1/2] SHA-256 ハッシュを検証しています...")
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            sha256.update(chunk)
    computed = sha256.hexdigest()
    if computed == EXPECTED_HASH:
        print(f"  ✅ SHA-256 一致確認")
        print(f"     {computed}")
        return True
    else:
        print(f"  ❌ 不一致 — ファイルが改変されている可能性があります")
        print(f"  期待値: {EXPECTED_HASH}")
        print(f"  実測値: {computed}")
        return False

def verify_timestamp(filepath: str) -> None:
    print("\\n[2/2] RFC3161 タイムスタンプを検証しています...")
    tsr_path = os.path.join(SCRIPT_DIR, "TIMESTAMP.tsr")
    if not os.path.exists(tsr_path):
        print("  ⚠️  TIMESTAMP.tsr が見つかりません")
        return
    try:
        result = subprocess.run(
            ["openssl", "ts", "-verify", "-in", tsr_path, "-data", filepath,
             "-CAfile", "/etc/ssl/certs/ca-certificates.crt"],
            capture_output=True, text=True
        )
        output = result.stdout + result.stderr
        if "Verification: OK" in output:
            print("  ✅ RFC3161 タイムスタンプ検証成功")
        else:
            print(f"  ℹ️  {output.strip()}")
    except FileNotFoundError:
        print("  ℹ️  OpenSSLが見つかりません。手動で検証してください。")

if __name__ == '__main__':
    filepath = sys.argv[1] if len(sys.argv) > 1 else "${fileName}"
    print()
    print("╔══════════════════════════════════════╗")
    print("║   ProofMark Evidence Pack 検証      ║")
    print("╚══════════════════════════════════════╝")
    print()
    if verify_sha256(filepath):
        verify_timestamp(filepath)
    print()
    print("╔══════════════════════════════════════╗")
    print("║   検証完了                          ║")
    print("╚══════════════════════════════════════╝")
    print()
`;

export const generateHowToVerify = (
  verificationUrl: string,
  certificateId: string,
): string => `ProofMark Evidence Pack — 検証ガイド
=====================================

このZIPファイルには、あなたの制作物の存在証明に必要な
すべてのファイルが含まれています。

同梱ファイル:
  ① Certificate_of_Authenticity.pdf  証明書（印刷・提出用）
  ② Cover_Letter.pdf                 クライアント向け説明書
  ③ TIMESTAMP.tsr                    RFC3161 タイムスタンプトークン（生データ）
  ④ verify.sh                        検証スクリプト（Mac/Linux/WSL）
  ⑤ verify.py                        検証スクリプト（Python）
  ⑥ HOW_TO_VERIFY.txt               本ファイル

検証方法 A: ブラウザ（最も簡単）
  ${verificationUrl}
  上記URLにアクセスし、原本ファイルをドラッグ＆ドロップしてください。

検証方法 B: ターミナル（Mac/Linux）
  bash verify.sh <原本ファイルのパス>

検証方法 C: Python
  python3 verify.py <原本ファイルのパス>

検証方法 D: OpenSSL（上級者向け・完全独立検証）
  openssl ts -verify -in TIMESTAMP.tsr -data <原本ファイル> \\
    -CAfile /etc/ssl/certs/ca-certificates.crt

Certificate ID: ${certificateId}
Issued by: ProofMark.jp | RFC3161 | SHA-256 | Zero-Knowledge
`;
