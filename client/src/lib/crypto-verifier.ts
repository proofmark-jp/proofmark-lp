/**
 * lib/crypto-verifier.ts
 * ──────────────────────────────────────────────────────────────────
 *  ProofMark — Zero-Knowledge Verifier (browser, no network)
 *
 *  - Web Crypto API: SHA-256 chunked digest
 *  - pkijs + asn1js: RFC3161 TSR parse / signature verify / chain verify
 *  - JSZip: in-memory archive read with zip-slip protection
 *
 *  すべての処理はブラウザメモリ内で完結。サーバへ 1 バイトも送出しない。
 * ──────────────────────────────────────────────────────────────────
 */

import JSZip from 'jszip';
import * as asn1js from 'asn1js';
import {
  CertificateChainValidationEngine,
  ContentInfo,
  SignedData,
  Certificate as PkijsCertificate,
  TimeStampResp,
  TSTInfo,
  setEngine,
  CryptoEngine,
} from 'pkijs';

import type {
  LoadedEvidencePack,
  ParsedTimestamp,
  VerificationFailureReason,
} from '@/types/verifier';

/* ─────────────────────────────────────────────
 *  pkijs engine — Web Crypto を明示的に注入
 *  (Node 環境向け default を使うと subtle が undefined になる)
 * ───────────────────────────────────────────── */

let engineReady = false;
function ensurePkijsEngine(): void {
  if (engineReady) return;
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) {
    throw new VerifierError('BROWSER_UNSUPPORTED', 'Web Crypto API not available');
  }
  setEngine(
    'ProofMarkWebCrypto',
    new CryptoEngine({
      name: 'ProofMarkWebCrypto',
      crypto: globalThis.crypto,
      subtle,
    }),
  );
  engineReady = true;
}

/* ─────────────────────────────────────────────
 *  Errors
 * ───────────────────────────────────────────── */

export class VerifierError extends Error {
  constructor(
    public reason: VerificationFailureReason,
    message: string,
    public detail?: string,
  ) {
    super(message);
    this.name = 'VerifierError';
  }
}

/* ─────────────────────────────────────────────
 *  1. ZIP open + whitelist file extraction
 * ───────────────────────────────────────────── */

const ALLOWED_TOP_LEVEL_FILES: ReadonlyArray<string> = [
  'timestamp.tsr',
  'timestamp.MISSING.txt',
  'hash.txt',
  'metadata.json',
  'CLIENT_LETTER.txt',
  'Certificate_of_Authenticity.pdf',
  'verify.py',
  'verify.sh',
  'freetsa-tsa.crt',
  'freetsa-ca.crt',
  'tsa.crt',
  'ca.crt',
  'c2pa.json',
  'chain.json',
  'copyright_notice.pdf',
];

/** zip-slip / 隠しエントリを徹底排除する */
function normalizeAndAcceptEntry(name: string): string | null {
  // バックスラッシュは Windows 経由の冗長系。一括で禁止。
  if (name.includes('\\')) return null;
  // 絶対パス禁止
  if (name.startsWith('/')) return null;
  // .. を含むパスは即時拒否
  if (name.split('/').some((seg) => seg === '..' || seg === '.')) return null;
  // .DS_Store / __MACOSX / .git 等は無視
  if (name.startsWith('__MACOSX/') || name.includes('/.')) return null;

  // 受理対象は:
  //   - original/ 直下 (1 階層のみ)
  //   - トップレベルのホワイトリスト
  const parts = name.split('/').filter(Boolean);
  if (parts.length === 1) {
    return ALLOWED_TOP_LEVEL_FILES.includes(parts[0]) ? name : null;
  }
  if (parts.length === 2 && parts[0] === 'original' && parts[1].length > 0) {
    return name;
  }
  return null;
}

export async function loadEvidencePack(archive: File): Promise<LoadedEvidencePack> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(archive);
  } catch (err) {
    throw new VerifierError('INVALID_ZIP', 'ZIPアーカイブを展開できませんでした', (err as Error).message);
  }

  let originalFile: { name: string; bytes: ArrayBuffer } | null = null;
  let tsrBytes: ArrayBuffer | null = null;
  let tsaCert: ArrayBuffer | null = null;
  let caCert: ArrayBuffer | null = null;
  let hashTxt: string | null = null;
  let hasC2pa = false;
  let hasChain = false;
  let timestampMissingSentinel = false;

  for (const [rawName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const accepted = normalizeAndAcceptEntry(rawName);
    if (accepted === null) {
      // 不正パス検出は早期失敗 (ZIP slip)
      if (rawName.includes('..') || rawName.startsWith('/') || rawName.startsWith('\\')) {
        throw new VerifierError('ZIP_SLIP_DETECTED', 'ZIPに不正な相対パスが含まれています', rawName);
      }
      continue;
    }

    if (accepted.startsWith('original/')) {
      // original 配下は 1 ファイルだけ採用 (複数あった場合は最初を採用)
      if (!originalFile) {
        const buf = await entry.async('arraybuffer');
        originalFile = { name: accepted.slice('original/'.length), bytes: buf };
      }
      continue;
    }

    switch (accepted) {
      case 'timestamp.tsr':
        tsrBytes = await entry.async('arraybuffer');
        break;
      case 'timestamp.MISSING.txt':
        timestampMissingSentinel = true;
        break;
      case 'hash.txt':
        hashTxt = await entry.async('string');
        break;
      case 'freetsa-tsa.crt':
      case 'tsa.crt':
        tsaCert = await entry.async('arraybuffer');
        break;
      case 'freetsa-ca.crt':
      case 'ca.crt':
        caCert = await entry.async('arraybuffer');
        break;
      case 'c2pa.json':
        hasC2pa = true;
        break;
      case 'chain.json':
        hasChain = true;
        break;
      default:
        // metadata.json 等は今回の検証では使わない
        break;
    }
  }

  if (timestampMissingSentinel) {
    throw new VerifierError(
      'TIMESTAMP_EXPLICITLY_MISSING',
      'このパックにはタイムスタンプが意図的に同梱されていません',
      'timestamp.MISSING.txt が検出されました',
    );
  }
  if (!tsrBytes) {
    throw new VerifierError('MISSING_TIMESTAMP', 'timestamp.tsr が見つかりません');
  }
  if (!tsaCert) {
    throw new VerifierError('MISSING_TSA_CERT', 'TSA 公開鍵証明書 (freetsa-tsa.crt) が見つかりません');
  }
  if (!caCert) {
    throw new VerifierError('MISSING_CA_CERT', 'CA 公開鍵証明書 (freetsa-ca.crt) が見つかりません');
  }

  return {
    archiveName: archive.name,
    originalFile: originalFile ?? { name: '(absent)', bytes: new ArrayBuffer(0) },
    tsrBytes,
    tsaCertDerOrPem: tsaCert,
    caCertDerOrPem: caCert,
    hashTxt,
    hasC2paJson: hasC2pa,
    hasChainJson: hasChain,
    timestampMissingSentinel: false,
  };
}

/* ─────────────────────────────────────────────
 *  2. SHA-256 (chunked, async)
 * ───────────────────────────────────────────── */

const HASH_CHUNK = 4 * 1024 * 1024; // 4MB

export async function computeSha256(
  bytes: ArrayBuffer,
  onProgress?: (progress: number) => void,
): Promise<string> {
  ensurePkijsEngine();
  const subtle = globalThis.crypto.subtle;

  // 8MB 未満は一発で
  if (bytes.byteLength <= HASH_CHUNK * 2) {
    onProgress?.(0.05);
    const digest = await subtle.digest('SHA-256', bytes);
    onProgress?.(1);
    return bufferToHex(digest);
  }

  // 大きい場合は incremental が subtle で不可能なので、UI を凍らせないように
  // チャンク単位で yield しつつ「全体ダイジェスト」を一度だけ実行
  const total = bytes.byteLength;
  const view = new Uint8Array(bytes);
  // 進捗演出 (実 hash 計算は subtle が裏で並列化する)
  let processed = 0;
  while (processed < total) {
    processed = Math.min(total, processed + HASH_CHUNK);
    onProgress?.(processed / total * 0.85);
    // microtask yield
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  const digest = await subtle.digest('SHA-256', view);
  onProgress?.(1);
  return bufferToHex(digest);
}

/* ─────────────────────────────────────────────
 *  3. RFC3161 TSR — parse + verify signature + verify chain
 * ───────────────────────────────────────────── */

const OID_SHA256 = '2.16.840.1.101.3.4.2.1';
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_TST_INFO = '1.2.840.113549.1.9.16.1.4';

export async function verifyTimestamp(
  tsrBytes: ArrayBuffer,
  tsaCertBytes: ArrayBuffer,
  caCertBytes: ArrayBuffer,
  expectedSha256Hex: string,
  onProgress?: (progress: number) => void,
): Promise<ParsedTimestamp> {
  ensurePkijsEngine();
  onProgress?.(0.05);

  /* ── 3-1. tsr (TimeStampResp) を asn1js でパース ── */
  const tsrNormalized = toPlainArrayBuffer(tsrBytes);
  const asn = asn1js.fromBER(tsrNormalized);
  if (asn.offset === -1) {
    throw new VerifierError('TSR_PARSE_FAILED', 'timestamp.tsr の ASN.1 構造が破損しています');
  }

  let tsResp: TimeStampResp;
  try {
    tsResp = new TimeStampResp({ schema: asn.result });
  } catch (err) {
    throw new VerifierError(
      'TSR_PARSE_FAILED',
      'TimeStampResp の解釈に失敗しました',
      (err as Error).message,
    );
  }

  /* ── 3-2. status (PKIStatusInfo) が "granted" 系か ── */
  const statusValue =
    typeof tsResp.status.status === 'number'
      ? tsResp.status.status
      : tsResp.status.status.valueBlock.valueDec;
  // 0 = granted, 1 = grantedWithMods, それ以外は失敗
  if (statusValue !== 0 && statusValue !== 1) {
    throw new VerifierError(
      'TSR_STATUS_REJECTED',
      'TSA がタイムスタンプ要求を拒否しました',
      `PKIStatus=${statusValue}`,
    );
  }
  if (!tsResp.timeStampToken) {
    throw new VerifierError('TSR_PARSE_FAILED', 'timeStampToken が空です');
  }

  /* ── 3-3. timeStampToken は CMS ContentInfo (SignedData) ── */
  const contentInfo = tsResp.timeStampToken;
  if (contentInfo.contentType !== OID_SIGNED_DATA) {
    throw new VerifierError(
      'TSR_PARSE_FAILED',
      `timeStampToken の contentType が想定外: ${contentInfo.contentType}`,
    );
  }

  let signedData: SignedData;
  try {
    signedData = new SignedData({ schema: contentInfo.content });
  } catch (err) {
    throw new VerifierError(
      'TSR_PARSE_FAILED',
      'SignedData の解釈に失敗しました',
      (err as Error).message,
    );
  }

  /* ── 3-4. encapContentInfo.eContent から TSTInfo を取り出す ── */
  const eContent = signedData.encapContentInfo.eContent;
  if (!eContent) {
    throw new VerifierError('TSR_PARSE_FAILED', 'eContent (TSTInfo) が同梱されていません');
  }
  // eContent は OctetString — valueBlock を結合して plain buffer に
  const tstBuffer = octetStringToBuffer(eContent);
  const tstAsn = asn1js.fromBER(tstBuffer);
  if (tstAsn.offset === -1) {
    throw new VerifierError('TSR_PARSE_FAILED', 'TSTInfo の ASN.1 構造が破損しています');
  }
  let tstInfo: TSTInfo;
  try {
    tstInfo = new TSTInfo({ schema: tstAsn.result });
  } catch (err) {
    throw new VerifierError(
      'TSR_PARSE_FAILED',
      'TSTInfo の解釈に失敗しました',
      (err as Error).message,
    );
  }

  /* ── 3-5. ハッシュアルゴリズム / messageImprint の検証 ── */
  const algoOid = tstInfo.messageImprint.hashAlgorithm.algorithmId;
  if (algoOid !== OID_SHA256) {
    throw new VerifierError(
      'TSR_UNSUPPORTED_HASH_ALGORITHM',
      `非対応のハッシュアルゴリズムです: ${algoOid}`,
      'ProofMark は SHA-256 のみ受け入れます',
    );
  }

  const tsrHashHex = bufferToHex(
    octetStringToBuffer(tstInfo.messageImprint.hashedMessage),
  );

  if (tsrHashHex.toLowerCase() !== expectedSha256Hex.toLowerCase()) {
    throw new VerifierError(
      'HASH_MISMATCH_LOCAL_VS_TSR',
      'ローカルで計算したハッシュとタイムスタンプ内のハッシュが一致しません',
      `local=${expectedSha256Hex} tsr=${tsrHashHex}`,
    );
  }
  onProgress?.(0.35);

  /* ── 3-6. 証明書 (TSA / CA) のパース ── */
  const tsaCert = parseCertificate(tsaCertBytes);
  const caCert = parseCertificate(caCertBytes);

  /* ── 3-7. SignedData の署名検証 ── */
  // ── A. eContent を平坦 OCTET STRING へ再構築 ─────────────
  try {
    const flatOctet = new asn1js.OctetString({ valueHex: tstBuffer });
    signedData.encapContentInfo.eContent = flatOctet;
  } catch (err) {
    console.warn('[verifyTimestamp] eContent normalize skipped', err);
  }

  // ── B. signer の証明書候補を明示 ──────────────────────────
  signedData.certificates = [...(signedData.certificates ?? []), tsaCert];

  // ── C. extendedMode + data を両渡しで pkijs に判定させる ──
  let signatureValid = false;
  try {
    const verifyResult = await signedData.verify({
      signer: 0,
      trustedCerts: [caCert, tsaCert],
      data: tsstBufferLike(tstBuffer),
      checkChain: false,
      extendedMode: true,
    } as Parameters<typeof signedData.verify>[0]);

    if (typeof verifyResult === 'boolean') {
      signatureValid = verifyResult;
    } else if (verifyResult && typeof verifyResult === 'object' && 'signatureVerified' in verifyResult) {
      signatureValid = Boolean((verifyResult as { signatureVerified?: boolean }).signatureVerified);
    } else {
      signatureValid = false;
    }
  } catch (err) {
    const msg = (err as Error)?.message ?? '';
    if (msg.includes('Missed detached data')) {
      throw new VerifierError(
        'INVALID_TSA_SIGNATURE',
        'TSA署名の eContent が検出できません (detached 互換モードで失敗)',
        msg,
      );
    }
    throw new VerifierError(
      'INVALID_TSA_SIGNATURE',
      'TSA署名の検証に失敗しました',
      msg,
    );
  }

  if (!signatureValid) {
    throw new VerifierError(
      'INVALID_TSA_SIGNATURE',
      'TSA署名が暗号学的に正当ではありません',
    );
  }
  onProgress?.(0.65);

  /* ── 3-8. TSA 証明書チェーン検証 ── */
  const chainEngine = new CertificateChainValidationEngine({
    trustedCerts: [caCert],
    certs: [tsaCert],
    checkDate: tstInfo.genTime, // ← TSA 発行時点で有効だったかを検査
  });
  let chainValid = false;
  try {
    const chainResult = await chainEngine.verify();
    chainValid = chainResult.result;
    if (!chainValid) {
      throw new VerifierError(
        'TSA_CERT_NOT_TRUSTED',
        'TSA証明書が信頼できる CA に紐付いていません',
        chainResult.resultMessage,
      );
    }
  } catch (err) {
    if (err instanceof VerifierError) throw err;
    throw new VerifierError(
      'TSA_CERT_NOT_TRUSTED',
      'TSA証明書チェーンの検証に失敗しました',
      (err as Error).message,
    );
  }
  onProgress?.(0.85);

  /* ── 3-9. genTime が TSA cert の有効期限内か (二重チェック) ── */
  const notBefore = tsaCert.notBefore.value;
  const notAfter = tsaCert.notAfter.value;
  if (tstInfo.genTime < notBefore || tstInfo.genTime > notAfter) {
    throw new VerifierError(
      'TSA_CERT_EXPIRED_AT_GENTIME',
      'TSA証明書が、タイムスタンプ発行時点で有効期間外です',
      `genTime=${tstInfo.genTime.toISOString()} validity=${notBefore.toISOString()}..${notAfter.toISOString()}`,
    );
  }

  onProgress?.(1);

  return {
    hashHex: tsrHashHex,
    hashAlgorithmOid: algoOid,
    genTime: tstInfo.genTime,
    tsaSubject: dnToHumanString(tsaCert.subject),
    tsaSerialHex: bufferToHex(tsaCert.serialNumber.valueBlock.valueHexView),
    tsrSerialHex: bufferToHex(tstInfo.serialNumber.valueBlock.valueHexView),
    signatureValid: true,
    chainValid: true,
  };
}

/* ─────────────────────────────────────────────
 *  4. hash.txt と再計算ハッシュの照合
 *
 *  hash.txt は POSIX sha256sum 形式：
 *      "<hex>  <filename>\n"
 *  または ProofMark v1 形式（同等）。
 * ───────────────────────────────────────────── */

export function extractHashFromHashTxt(
  hashTxt: string,
  expectedFileName: string,
): string {
  const trimmed = hashTxt.trim();
  if (!trimmed) {
    throw new VerifierError('HASH_TXT_MALFORMED', 'hash.txt が空です');
  }

  // 1 行目だけ採用 (複数行ある場合はファイル名一致行を優先)
  const lines = trimmed.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/);
    if (!m) continue;
    const [, hex, name] = m;
    if (name === expectedFileName || name.endsWith(expectedFileName)) {
      return hex.toLowerCase();
    }
  }

  // ファイル名一致がなかった場合は最初の hex を採用 (寛容モード)
  const first = lines.find((l) => /^[0-9a-fA-F]{64}\b/.test(l));
  if (!first) {
    throw new VerifierError('HASH_TXT_MALFORMED', 'hash.txt から SHA-256 を抽出できません');
  }
  return first.slice(0, 64).toLowerCase();
}

/* ─────────────────────────────────────────────
 *  Internals — pkijs / asn1js helpers
 * ───────────────────────────────────────────── */

function parseCertificate(input: ArrayBuffer): PkijsCertificate {
  const der = isPem(input) ? pemToDer(input) : toPlainArrayBuffer(input);
  const asn = asn1js.fromBER(der);
  if (asn.offset === -1) {
    throw new VerifierError('TSR_PARSE_FAILED', '証明書の ASN.1 構造が破損しています');
  }
  try {
    return new PkijsCertificate({ schema: asn.result });
  } catch (err) {
    throw new VerifierError(
      'TSR_PARSE_FAILED',
      '証明書のパースに失敗しました',
      (err as Error).message,
    );
  }
}

function isPem(buf: ArrayBuffer): boolean {
  // 先頭 64 byte ぐらいを ASCII として覗き、"-----BEGIN" があれば PEM とみなす
  const head = new Uint8Array(buf, 0, Math.min(64, buf.byteLength));
  const txt = new TextDecoder('utf-8', { fatal: false }).decode(head);
  return txt.includes('-----BEGIN');
}

function pemToDer(buf: ArrayBuffer): ArrayBuffer {
  const text = new TextDecoder().decode(buf);
  const cleaned = text
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/[\s\r\n]+/g, '');
  const binStr = atob(cleaned);
  const out = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) out[i] = binStr.charCodeAt(i);
  return out.buffer;
}

/** SAB を絶対に避け、常に新しい ArrayBuffer を返す */
function toPlainArrayBuffer(buf: ArrayBuffer): ArrayBuffer {
  if (buf instanceof ArrayBuffer && Object.getPrototypeOf(buf) === ArrayBuffer.prototype) {
    return buf;
  }
  const copy = new Uint8Array(buf.byteLength);
  copy.set(new Uint8Array(buf as ArrayBuffer));
  return copy.buffer;
}

/** asn1js OctetString は valueBlock.valueHex を複数持つ場合がある — 安全に集約する */
function octetStringToBuffer(node: unknown): ArrayBuffer {
  // pkijs/asn1js 双方で .valueBlock.valueHexView (Uint8Array) を露出している
  // 加えて、構造化された OCTET STRING の場合は valueBlock.value (children) を結合する
  const anyNode = node as {
    valueBlock?: {
      valueHexView?: Uint8Array;
      valueHex?: ArrayBuffer;
      value?: Array<{ valueBlock?: { valueHexView?: Uint8Array } }>;
    };
  };

  const direct = anyNode.valueBlock?.valueHexView;
  if (direct && direct.byteLength > 0) {
    const copy = new Uint8Array(direct.byteLength);
    copy.set(direct);
    return copy.buffer;
  }

  const children = anyNode.valueBlock?.value ?? [];
  if (children.length > 0) {
    const parts = children
      .map((c) => c.valueBlock?.valueHexView)
      .filter((v): v is Uint8Array => Boolean(v && v.byteLength));
    const total = parts.reduce((s, p) => s + p.byteLength, 0);
    const merged = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      merged.set(p, off);
      off += p.byteLength;
    }
    return merged.buffer;
  }

  const legacy = anyNode.valueBlock?.valueHex;
  if (legacy && legacy.byteLength > 0) return legacy.slice(0);

  return new ArrayBuffer(0);
}

function bufferToHex(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < u8.length; i++) {
    out += u8[i].toString(16).padStart(2, '0');
  }
  return out;
}

function dnToHumanString(dn: PkijsCertificate['subject']): string {
  // RDN を "CN=..., O=..." の形に
  // typeAndValues.value は printable string などの ASN.1 オブジェクト
  const parts: string[] = [];
  for (const tv of dn.typesAndValues) {
    const oid = tv.type;
    const valueStr = (tv.value as { valueBlock?: { value?: string } }).valueBlock?.value ?? '';
    const label = OID_TO_LABEL[oid] ?? oid;
    parts.push(`${label}=${valueStr}`);
  }
  return parts.join(', ');
}

const OID_TO_LABEL: Record<string, string> = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '1.2.840.113549.1.9.1': 'EMAIL',
};

/**
 * pkijs.SignedData.verify の `data` 引数は
 * 「ArrayBuffer | ArrayBuffer[] | Uint8Array」のいずれかを受け付ける。
 * 単一 ArrayBuffer を 1 要素配列に包んで両対応にするためのヘルパー。
 */
function tsstBufferLike(buf: ArrayBuffer): ArrayBuffer {
  return buf.slice(0);
}
