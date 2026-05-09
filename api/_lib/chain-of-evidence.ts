/**
 * api/_lib/chain-of-evidence.ts — Phase 12.4
 *
 * cert_audit_logs テーブルから、特定 certificate_id に紐づく全監査ログを
 * 時系列で取得し、改ざん検知 RPC (fn_verify_audit_chain) の結果を
 * boolean として同梱した「chain_of_evidence.json」用の JSON Buffer を作る。
 *
 * 設計:
 *   1. SELECT は **必要列のみ** に絞り、軽量な JSON にする (大規模監査でも
 *      数百行 / 数十KB 程度を想定)。
 *   2. fn_verify_audit_chain は SECURITY DEFINER 関数なので、admin client
 *      から RPC で呼ぶ。失敗しても chain_ok=null として続行 (ZIP は壊さない)。
 *   3. 戻り値は最終的に Buffer (UTF-8). archiver にそのまま渡せる。
 *   4. PII は出さない: actor_email を **末尾2文字 + ドメイン** にマスク。
 *      法務向けの提示用に「誰が」を残しつつ、不要な PII 流出を防ぐ。
 *
 * 既存の `cert_audit_logs` 列 (007_add_audit_verification.sql 参照):
 *   id, certificate_id, team_id, project_id, actor_id, actor_email,
 *   event_type, before_state, after_state, prev_log_sha256, row_sha256,
 *   created_at
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface AuditLogRow {
    id: string;
    certificate_id: string;
    team_id: string | null;
    project_id: string | null;
    actor_id: string | null;
    actor_email: string | null;
    event_type: string | null;
    before_state: Record<string, unknown> | null;
    after_state: Record<string, unknown> | null;
    prev_log_sha256: string | null;
    row_sha256: string | null;
    created_at: string;
}

export interface ChainOfEvidence {
    schema_version: 1;
    certificate_id: string;
    generated_at: string;
    chain_length: number;
    chain_ok: boolean | null;
    /** SHA-256 hash chain の最先端 (最後の row_sha256). nullable. */
    chain_head_sha256: string | null;
    /** RPC verify が走らなかった場合の理由 (RPC error など). */
    chain_ok_reason?: string;
    events: ChainEvent[];
}

interface ChainEvent {
    seq: number;
    id: string;
    event_type: string | null;
    actor_id: string | null;
    actor_email_masked: string | null;
    project_id: string | null;
    team_id: string | null;
    before_state: Record<string, unknown> | null;
    after_state: Record<string, unknown> | null;
    prev_log_sha256: string | null;
    row_sha256: string | null;
    created_at: string;
}

/** PII 軽減: "alice@example.com" → "al***@example.com" */
function maskEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const at = email.indexOf('@');
    if (at < 0) return null;
    const local = email.slice(0, at);
    const domain = email.slice(at);
    if (local.length <= 2) return `${local[0] ?? '?'}***${domain}`;
    return `${local.slice(0, 2)}***${domain}`;
}

interface BuildOptions {
    log?: {
        warn: (o: Record<string, unknown>) => void;
        info: (o: Record<string, unknown>) => void;
    };
}

/**
 * Build the chain_of_evidence.json content as a Buffer.
 *
 * SELECT order: created_at ASC, id ASC (DB の fn_verify_audit_chain と一致)。
 */
export async function buildChainOfEvidence(
    admin: SupabaseClient,
    certificateId: string,
    opts: BuildOptions = {},
): Promise<Buffer> {
    const { data: rows, error: selErr } = await admin
        .from('cert_audit_logs')
        .select(
            'id, certificate_id, team_id, project_id, actor_id, actor_email, ' +
            'event_type, before_state, after_state, prev_log_sha256, row_sha256, created_at',
        )
        .eq('certificate_id', certificateId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

    if (selErr) {
        opts.log?.warn({ event: 'chain.select_failed', message: selErr.message });
    }

    const logs = (rows ?? []) as unknown as AuditLogRow[];

    // RPC で改ざん検知。失敗しても続行。
    let chainOk: boolean | null = null;
    let chainOkReason: string | undefined;
    try {
        const { data: rpc, error: rpcErr } = await admin.rpc('fn_verify_audit_chain', {
            p_certificate_id: certificateId,
        });
        if (rpcErr) {
            chainOk = null;
            chainOkReason = `rpc_error:${rpcErr.message}`;
            opts.log?.warn({ event: 'chain.rpc_error', message: rpcErr.message });
        } else if (typeof rpc === 'boolean') {
            chainOk = rpc;
        } else if (rpc === null || rpc === undefined) {
            chainOk = null;
            chainOkReason = 'rpc_returned_null';
        } else {
            chainOk = !!rpc;
        }
    } catch (err) {
        chainOk = null;
        chainOkReason = `rpc_exception:${(err as Error)?.message ?? 'unknown'}`;
        opts.log?.warn({ event: 'chain.rpc_exception', message: chainOkReason });
    }

    const events: ChainEvent[] = logs.map((row, idx) => ({
        seq: idx + 1,
        id: row.id,
        event_type: row.event_type,
        actor_id: row.actor_id,
        actor_email_masked: maskEmail(row.actor_email),
        project_id: row.project_id,
        team_id: row.team_id,
        before_state: row.before_state,
        after_state: row.after_state,
        prev_log_sha256: row.prev_log_sha256,
        row_sha256: row.row_sha256,
        created_at: row.created_at,
    }));

    const head = events.length > 0 ? events[events.length - 1].row_sha256 : null;

    const payload: ChainOfEvidence = {
        schema_version: 1,
        certificate_id: certificateId,
        generated_at: new Date().toISOString(),
        chain_length: events.length,
        chain_ok: chainOk,
        chain_head_sha256: head,
        ...(chainOkReason ? { chain_ok_reason: chainOkReason } : {}),
        events,
    };

    return Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
}
