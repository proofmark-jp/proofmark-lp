/**
 * api/send-contact.ts — Phase Contact Final
 *
 * Edge Runtime で動作する堅牢な CS API。提供されたドラフトの
 * 「Ticket Deflection / 文脈自動収集 / Edge fetch」設計はそのまま温存し、
 * 以下を世界基準まで引き上げ:
 *
 *   ✓ Upstash Ratelimit (1 IP / 5 min / 5 req) — create.ts と同じ作法
 *   ✓ ペイロードサイズ guard (32 KB) — Edge メモリリーク防止
 *   ✓ 並列 fan-out (Resend dev / Resend user / Discord / Supabase)
 *   ✓ 永続化失敗でも他チャンネルは継続 (CS が必ずどこかに届く)
 *   ✓ 5 分以内・同 email・同 subject の重複は **soft suppress** (再送 spam 防止)
 *   ✓ 構造化ログ (Sentry / Logflare 取り込み前提)
 *   ✓ 型安全 — `any` 完全廃止、`unknown` から narrowing
 *
 * 仕様:
 *   - POST /api/send-contact
 *   - Body: { category, subject, message, email, errorCode?, plan?, metadata?, website? }
 *   - Response 200: { ok: true, ticketId: 'PM-XXXXX-XXXX' }
 *   - Response 4xx/5xx: { error: string }
 *
 * Required ENV:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - RESEND_API_KEY
 *   - DISCORD_CONTACT_WEBHOOK_URL (任意)
 *   - KV_REST_API_URL, KV_REST_API_TOKEN (任意 — 無ければ rate limit 自動 bypass)
 *   - CONTACT_FROM_ADDRESS, CONTACT_TO_ADDRESS (任意)
 */

export const config = { runtime: 'edge' };

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/* ─────────────── Types ─────────────── */

interface ContactMetadata {
  userAgent?: string;
  currentUrl?: string;
  referrer?: string;
  planTier?: string;
  isAuthenticated?: boolean;
}

interface ContactPayload {
  category: string;
  subject: string;
  message: string;
  email: string;
  errorCode?: string;
  plan?: string;
  metadata?: ContactMetadata;
  /** Honeypot — bots only */
  website?: string;
}

type Priority = 'high' | 'normal';

interface PersistResult {
  ok: boolean;
  id: string | null;
  reason?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  account: 'アカウント・ログイン',
  certificate: '証明書・発行',
  billing: '料金・プラン',
  'evidence-pack': 'Evidence Pack',
  api: 'API / 開発者向け',
  feature: '機能リクエスト',
  bug: 'バグ報告',
  disclosure_request: '特商法に基づく運営者情報の開示請求',
  other: 'その他',
};

const HIGH_PRIORITY_PLANS = new Set(['studio', 'business', 'enterprise', 'creator']);
const MAX_PAYLOAD_BYTES = 32 * 1024; // 32 KB
const SUBJECT_MAX = 200;
const MESSAGE_MAX = 5000;
const ERR_CODE_MAX = 20;
const PLAN_MAX = 30;
const EMAIL_MAX = 254; // RFC 5321
const META_FIELD_MAX = 500;
const DEDUPE_TTL_SECONDS = 5 * 60; // 5 分

/* ─────────────── Validation ─────────────── */

class ClientError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function clampString(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t.length === 0) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function parsePayload(body: unknown): ContactPayload {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ClientError('Invalid request body');
  }
  const b = body as Record<string, unknown>;

  // Honeypot — 静かに弾く (200 を返さないが、"Spam detected" は server log のみで通知)
  const honey = asString(b.website).trim();
  if (honey.length > 0) {
    throw new ClientError('Spam detected');
  }

  const category = asString(b.category).trim();
  const subject = asString(b.subject).trim();
  const message = asString(b.message).trim();
  const email = asString(b.email).trim().toLowerCase();

  if (!category || !(category in CATEGORY_LABELS)) {
    throw new ClientError('Invalid category');
  }
  if (!subject) throw new ClientError('subject is required');
  if (subject.length > SUBJECT_MAX)
    throw new ClientError(`subject must be ≤ ${SUBJECT_MAX} chars`);
  if (!message) throw new ClientError('message is required');
  if (message.length > MESSAGE_MAX)
    throw new ClientError(`message must be ≤ ${MESSAGE_MAX} chars`);
  if (!email || email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ClientError('Valid email is required');
  }

  const errorCode = clampString(b.errorCode, ERR_CODE_MAX);
  const plan = clampString(b.plan, PLAN_MAX);

  let metadata: ContactMetadata | undefined;
  if (b.metadata && typeof b.metadata === 'object' && !Array.isArray(b.metadata)) {
    const m = b.metadata as Record<string, unknown>;
    metadata = {
      userAgent: clampString(m.userAgent, META_FIELD_MAX),
      currentUrl: clampString(m.currentUrl, META_FIELD_MAX),
      referrer: clampString(m.referrer, META_FIELD_MAX),
      planTier: clampString(m.planTier, PLAN_MAX),
      isAuthenticated: typeof m.isAuthenticated === 'boolean' ? m.isAuthenticated : undefined,
    };
  }

  return { category, subject, message, email, errorCode, plan, metadata };
}

/* ─────────────── Helpers ─────────────── */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

function generateTicketId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(8, '0');
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `PM-${ts}-${rand}`;
}

function resolvePriority(payload: ContactPayload): Priority {
  const planTier = (payload.plan ?? payload.metadata?.planTier ?? 'free').toLowerCase();
  if (HIGH_PRIORITY_PLANS.has(planTier)) return 'high';
  // バグ報告 + ログイン済み + エラーコード付きは緊急扱い
  if (
    payload.category === 'bug' &&
    payload.metadata?.isAuthenticated === true &&
    Boolean(payload.errorCode)
  ) {
    return 'high';
  }
  return 'normal';
}

function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

/* ─────────────── Rate Limit (Upstash) ─────────────── */

async function checkRateLimit(ip: string): Promise<{ ok: true } | { ok: false; retry: number }> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return { ok: true }; // fail-open
  try {
    const redis = new Redis({ url, token });
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '5 m'),
      analytics: true,
      prefix: 'pm-contact',
    });
    const r = await limiter.limit(`ratelimit_contact_${ip}`);
    if (r.success) return { ok: true };
    return { ok: false, retry: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
  } catch (e) {
    console.error(JSON.stringify({ event: 'contact.ratelimit_error', message: String(e) }));
    return { ok: true };
  }
}

/* ─────────────── Soft De-duplication ─────────────── */

async function shouldSuppressDuplicate(
  email: string,
  subject: string,
): Promise<string | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const redis = new Redis({ url, token });
    const fp = await sha256Hex(`${email}::${subject.toLowerCase()}`);
    const key = `pm-contact-dup:${fp}`;
    const existing = await redis.get<string>(key);
    if (typeof existing === 'string' && existing.length > 0) return existing;
    return null;
  } catch (e) {
    console.error(JSON.stringify({ event: 'contact.dedupe_error', message: String(e) }));
    return null;
  }
}

async function recordDuplicate(
  email: string,
  subject: string,
  ticketId: string,
): Promise<void> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  try {
    const redis = new Redis({ url, token });
    const fp = await sha256Hex(`${email}::${subject.toLowerCase()}`);
    await redis.set(`pm-contact-dup:${fp}`, ticketId, { ex: DEDUPE_TTL_SECONDS });
  } catch {
    /* noop */
  }
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ─────────────── Resend (Developer Notification) ─────────────── */

async function sendDeveloperEmail(
  payload: ContactPayload,
  priority: Priority,
  ticketId: string,
  ip: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.CONTACT_FROM_ADDRESS ?? 'ProofMark <noreply@proofmark.jp>';
  const to = process.env.CONTACT_TO_ADDRESS ?? 'support@proofmark.jp';
  const categoryLabel = CATEGORY_LABELS[payload.category] ?? payload.category;
  const priorityTag = priority === 'high' ? '🔴 HIGH' : '🟣 NORMAL';
  const subjectLine = `[${priorityTag}] ${categoryLabel} — ${payload.subject}`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f7;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;">
  <div style="background:#0D0B24;color:#F0EFF8;padding:24px;border-radius:16px 16px 0 0;">
    <h2 style="margin:0;font-size:18px;">📩 ProofMark Contact — <span style="color:${priority === 'high' ? '#FF6B6B' : '#A8A0D8'
    };">${priorityTag}</span></h2>
    <p style="margin:4px 0 0;font-size:12px;color:#A8A0D8;">Ticket ID: ${escapeHtml(ticketId)}</p>
  </div>
  <div style="padding:24px;border:1px solid #e2e2e2;border-top:none;border-radius:0 0 16px 16px;background:#fff;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#666;width:120px;">カテゴリ</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(
      categoryLabel,
    )}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">件名</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(
      payload.subject,
    )}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(
      payload.email,
    )}" style="color:#6C3EF4;">${escapeHtml(payload.email)}</a></td></tr>

    ${payload.errorCode
      ? `<tr><td style="padding:6px 0;color:#666;">エラーコード</td><td style="padding:6px 0;font-family:monospace;color:#FF6B6B;">${escapeHtml(
        payload.errorCode,
      )}</td></tr>`
      : ''
    }
    
    </table>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#333;">${escapeHtml(
      payload.message,
    )}</div>
  </div>
</div></body></html>`;

  try {
    const r = await fetchWithTimeout(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: payload.email,
          subject: subjectLine,
          html,
        }),
      },
      8000,
    );
    return r.ok;
  } catch {
    return false;
  }
}

/* ─────────────── Resend (Auto-Reply to User) ─────────────── */

async function sendAutoReply(payload: ContactPayload, ticketId: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.CONTACT_FROM_ADDRESS ?? 'ProofMark <noreply@proofmark.jp>';
  const categoryLabel = CATEGORY_LABELS[payload.category] ?? payload.category;

  /* ── 特商法開示請求の場合のみ、運営者情報を自動返信に差し込む ── */
  const disclosureBlock =
    payload.category === 'disclosure_request'
      ? `<div style="background:#f0eefc;border:1px solid #d4cff0;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6C3EF4;">特定商取引法に基づく運営者情報</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#666;width:100px;">販売業者</td><td style="padding:4px 0;font-weight:600;">ProofMark（運営者：小栗 慎也）</td></tr>
        <tr><td style="padding:4px 0;color:#666;">所在地</td><td style="padding:4px 0;">〒XXX-XXXX 東京都[区市町村名][番地以降]</td></tr>
        <tr><td style="padding:4px 0;color:#666;">電話番号</td><td style="padding:4px 0;">050-XXXX-XXXX</td></tr>
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:#888;line-height:1.6;">※本情報は特定商取引法に基づく開示請求への対応として自動送付しております。<br/>※記録保持のため、お電話での対応は行っておりません。ご用件はこのメールへの返信にてお願いいたします。</p>
    </div>`
      : '';

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f7;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;max-width:560px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#0D0B24,#1C1A38);padding:32px;border-radius:16px 16px 0 0;text-align:center;">
    <img src="https://proofmark.jp/logo-white.png" alt="ProofMark" style="height: 32px; width: auto; margin: 0 auto; display: block;" />
    <p style="margin:8px 0 0;font-size:13px;color:#A8A0D8;">お問い合わせを受け付けました</p>
  </div>
  <div style="padding:28px;border:1px solid #e2e2e2;border-top:none;border-radius:0 0 16px 16px;background:#fff;">
    <p style="font-size:14px;color:#333;line-height:1.8;">
      この度は ProofMark へお問い合わせいただき、ありがとうございます。<br/>
      以下の内容で受け付けいたしました。いただいた内容はすべて開発チームが確認し、<strong>返信が必要な内容につきましては順次ご連絡</strong>いたします。<br/>
      <span style="font-size:12px;color:#666;">※内容（機能要望やご意見など）によっては、個別のご返信を差し上げられない場合がございます。予めご了承ください。</span>
    </p>
    <div style="background:#f8f7fc;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #e8e6f0;">
      <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;">チケット ID</p>
      <p style="margin:0;font-size:14px;font-weight:700;font-family:monospace;color:#6C3EF4;">${escapeHtml(
    ticketId,
  )}</p>
    </div>
    <table style="width:100%;font-size:13px;border-collapse:collapse;">
      <tr><td style="padding:4px 0;color:#888;width:120px;">カテゴリ</td><td style="padding:4px 0;">${escapeHtml(
    categoryLabel,
  )}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">件名</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(
    payload.subject,
  )}</td></tr>
    </table>
    ${disclosureBlock}
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
    <p style="font-size:12px;color:#999;line-height:1.6;">
      ※ このメールは自動送信されています。<br/>
      ※ お急ぎの場合は、チケット ID を添えて再度ご連絡ください。<br/>
      ※ よくある質問: <a href="https://proofmark.jp/contact" style="color:#6C3EF4;">https://proofmark.jp/contact</a>
    </p>
  </div>
</div></body></html>`;

  try {
    const r = await fetchWithTimeout(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [payload.email],
          subject: `[ProofMark] お問い合わせを受け付けました (${ticketId})`,
          html,
        }),
      },
      8000,
    );
    return r.ok;
  } catch {
    return false;
  }
}

/* ─────────────── Discord Webhook ─────────────── */

async function sendDiscordNotification(
  payload: ContactPayload,
  priority: Priority,
  ticketId: string,
  ip: string,
): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_CONTACT_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const categoryLabel = CATEGORY_LABELS[payload.category] ?? payload.category;
  const color = priority === 'high' ? 0xff4d4d : 0x6c3ef4;
  const planLabel = payload.plan ?? payload.metadata?.planTier ?? 'free';

  const fields = [
    { name: 'Email', value: `\`${payload.email}\``, inline: true },
    { name: 'Ticket', value: `\`${ticketId}\``, inline: true },
    { name: 'IP', value: `\`${ip}\``, inline: true },
    { name: 'Auth', value: payload.metadata?.isAuthenticated ? '✅ Yes' : '❌ No', inline: true },
  ];

  if (payload.metadata?.currentUrl) {
    fields.push({ name: 'URL', value: `\`${payload.metadata.currentUrl}\``, inline: false });
  }
  if (payload.metadata?.userAgent) {
    fields.push({ name: 'UA', value: `\`${payload.metadata.userAgent}\``, inline: false });
  }

  const embed = {
    title: `📩 ${categoryLabel}`,
    description: [
      `**件名:** ${payload.subject.slice(0, 200)}`,
      `**プラン:** ${planLabel}`,
      payload.errorCode ? `**エラーコード:** \`${payload.errorCode}\`` : null,
      '',
      payload.message.slice(0, 800) + (payload.message.length > 800 ? '…' : ''),
    ]
      .filter(Boolean)
      .join('\n'),
    color,
    fields,
    footer: { text: `Priority: ${priority.toUpperCase()} · ProofMark CS` },
    timestamp: new Date().toISOString(),
  };

  const body: Record<string, unknown> = {
    embeds: [embed],
    allowed_mentions: { parse: priority === 'high' ? ['everyone'] : [] },
  };
  if (priority === 'high') {
    body.content = '@here 🔴 **有料プランユーザーからのお問い合わせ**';
  }

  try {
    const r = await fetchWithTimeout(
      webhookUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      6000,
    );
    return r.ok;
  } catch {
    return false;
  }
}

/* ─────────────── Supabase Persistence ─────────────── */

async function persistToSupabase(
  payload: ContactPayload,
  priority: Priority,
  ticketId: string,
  ip: string,
): Promise<PersistResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, id: null, reason: 'env_missing' };

  const row = {
    id: ticketId,
    topic: payload.category,
    name: payload.email.split('@')[0]?.slice(0, 80) ?? null,
    email: payload.email,
    company: null,
    subject: payload.subject,
    message: payload.message,
    ip,
    user_agent: payload.metadata?.userAgent ?? null,
    error_code: payload.errorCode ?? null,
    plan_tier: (payload.plan ?? payload.metadata?.planTier ?? 'free').toLowerCase(),
    priority,
    metadata: payload.metadata ?? null,
  };

  try {
    const r = await fetchWithTimeout(
      `${url}/rest/v1/contact_submissions`,
      {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(row),
      },
      5000,
    );

    if (r.ok) {
      const data = (await r.json().catch(() => [])) as Array<{ id?: string }>;
      return { ok: true, id: data[0]?.id ?? ticketId };
    }
    const text = await r.text().catch(() => '');
    return { ok: false, id: null, reason: `db_${r.status}:${text.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, id: null, reason: e instanceof Error ? e.message : 'fetch_error' };
  }
}

/* ─────────────── Handler ─────────────── */

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const ip = getClientIp(request);

  /* ── Payload size guard ── */
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_PAYLOAD_BYTES) {
    return jsonResponse(413, { error: 'Payload too large' });
  }

  /* ── Rate limit ── */
  const rl = await checkRateLimit(ip);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a few minutes.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': String(rl.retry),
        },
      },
    );
  }

  /* ── Parse + validate ── */
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_PAYLOAD_BYTES) {
      return jsonResponse(413, { error: 'Payload too large' });
    }
    raw = JSON.parse(text);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  let payload: ContactPayload;
  try {
    payload = parsePayload(raw);
  } catch (err) {
    if (err instanceof ClientError) {
      // Honeypot は user に成功と見せかけて静かに drop
      if (err.message === 'Spam detected') {
        console.warn(JSON.stringify({ event: 'contact.spam_blocked', ip }));
        return jsonResponse(200, {
          ok: true,
          ticketId: 'PM-IGNORED-' + Date.now().toString(36).toUpperCase(),
        });
      }
      return jsonResponse(err.status, { error: err.message });
    }
    return jsonResponse(400, { error: 'Validation failed' });
  }

  /* ── Soft de-dup ── */
  const dupTicket = await shouldSuppressDuplicate(payload.email, payload.subject);
  if (dupTicket) {
    console.info(
      JSON.stringify({ event: 'contact.duplicate_suppressed', dupTicket, email: payload.email }),
    );
    return jsonResponse(200, { ok: true, ticketId: dupTicket });
  }

  /* ── Priority & ticket ── */
  const priority = resolvePriority(payload);
  const ticketId = generateTicketId();

  /* ── Fan-out (DB → email → autoreply → discord) ── */
  const [dbResult, devMailResult, replyResult, discordResult] = await Promise.allSettled([
    persistToSupabase(payload, priority, ticketId, ip),
    sendDeveloperEmail(payload, priority, ticketId, ip),
    sendAutoReply(payload, ticketId),
    sendDiscordNotification(payload, priority, ticketId, ip),
  ]);

  /* ── Persist dedupe key (best effort) ── */
  void recordDuplicate(payload.email, payload.subject, ticketId);

  /* ── Structured log ── */
  const dbValue = dbResult.status === 'fulfilled' ? dbResult.value : null;
  const log = {
    event: 'contact.received',
    ticketId,
    priority,
    category: payload.category,
    email: payload.email,
    plan: payload.plan ?? payload.metadata?.planTier ?? 'free',
    isAuth: payload.metadata?.isAuthenticated === true,
    persistedId: dbValue?.ok ? dbValue.id : null,
    persistReason: dbValue?.ok ? null : dbValue?.reason ?? 'unknown',
    devMail: devMailResult.status === 'fulfilled' && devMailResult.value,
    autoReply: replyResult.status === 'fulfilled' && replyResult.value,
    discord: discordResult.status === 'fulfilled' && discordResult.value,
    ip,
  };
  console.info(JSON.stringify(log));

  /* ── Critical-failure guard ──
   *   DB / DevMail / Discord すべて落ちた場合のみ 502 を返す。
   *   どれか 1 つでも届いていれば、CS は受信可能なので 200 を返す。
   */
  const anyDelivered =
    log.persistedId !== null || log.devMail || log.discord || log.autoReply;
  if (!anyDelivered) {
    return jsonResponse(502, {
      error: 'All notification channels failed. Please email support@proofmark.jp directly.',
    });
  }

  return jsonResponse(200, { ok: true, ticketId });
}
