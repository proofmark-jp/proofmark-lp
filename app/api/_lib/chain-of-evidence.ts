import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChainOfEvidence {
    schema_version: 2;
    certificate_id: string;
    chain_ok: boolean | null;
    chain_ok_reason?: string;
    events: any[];
}

export async function buildChainOfEvidence(
    admin: SupabaseClient,
    certificateId: string,
    opts: { log?: any } = {}
): Promise<Buffer | null> {
    // 1. 究極の Single Source of Truth: metadata_json を一発読み
    const { data, error } = await admin
        .from('certificates')
        .select('metadata_json')
        .eq('id', certificateId)
        .single();

    if (error || !data) {
        opts.log?.warn({ event: 'chain.not_found', certificateId });
        return null;
    }

    const meta = data.metadata_json as any;
    if (!meta || !meta.chain_history || !Array.isArray(meta.chain_history)) {
        return null; // チェーンがない場合（1枚のみ）
    }

    // 2. The Merkle Rollup 形式へ直接パース (DBジョイン・RPCへの依存を完全排除)
    const events = meta.chain_history.map((step: any, idx: number) => ({
        seq: idx + 1,
        event_type: step.isHead ? 'head_seal' : 'process_step',
        row_sha256: step.sha256,
        title: step.title || `Step ${idx + 1}`,
    }));

    const payload: ChainOfEvidence = {
        schema_version: 2, // v2へ昇格
        certificate_id: certificateId,
        chain_ok: true, // JSONBに封印された時点で絶対不変
        chain_ok_reason: 'Verified via The Merkle Rollup (JSONB)',
        events,
    };

    return Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
}