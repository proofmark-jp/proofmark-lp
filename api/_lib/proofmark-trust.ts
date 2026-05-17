/**
 * proofmark-trust.ts — Trust Tier SSOT (Server side)
 *
 * Dashboard.tsx の `deriveTrustTier()` と **完全同一仕様** で
 * Trust 階層・色・ラベルを返す。バックエンドはアイコンを使わないので
 * `icon` は名前文字列に変換している。
 */

export type TrustTier = 'pending' | 'beta' | 'trusted' | 'cross';

export interface TrustDescriptor {
    tier: TrustTier;
    label: string;
    sublabel: string;
    /** 主アクセント (Border + Text accent) */
    color: string;
    /** Glow / border with alpha */
    border: string;
    /** 塗り (with alpha) */
    bg: string;
    /** アイコン名 (lucide-react と同名)。SVG 描画時のスイッチで使う */
    iconName: 'Clock3' | 'Sparkles' | 'ShieldCheck' | 'ShieldAlert';
    description: string;
}

export interface CertificateLike {
    tsa_provider?: string | null;
    timestamp_token?: string | null;
    certified_at?: string | null;
    cross_anchors?: ReadonlyArray<unknown> | null;
}

const TRUSTED_PROVIDERS: ReadonlyArray<string> = [
    'digicert',
    'globalsign',
    'seiko',
    'sectigo',
];

export function deriveTrustTier(c: CertificateLike): TrustDescriptor {
    const provider = (c.tsa_provider || '').toLowerCase();
    const hasToken = Boolean(c.timestamp_token && c.certified_at);
    const anchors = c.cross_anchors?.length ?? 0;

    if (!hasToken) {
        return {
            tier: 'pending',
            label: 'Pending',
            sublabel: 'TSA発行待ち',
            color: '#A8A0D8',
            border: 'rgba(168,160,216,0.35)',
            bg: 'rgba(168,160,216,0.10)',
            iconName: 'Clock3',
            description:
                'タイムスタンプトークン未発行。数秒以内にTSAから署名が返る予定です。',
        };
    }
    if (anchors >= 1) {
        return {
            tier: 'cross',
            label: 'Cross-anchored',
            sublabel: `${anchors + 1} 重TSA`,
            color: '#F0BB38',
            border: 'rgba(240,187,56,0.40)',
            bg: 'rgba(240,187,56,0.12)',
            iconName: 'Sparkles',
            description:
                '複数のTSAで多重発行された証明。TSA単一障害や鍵失効への耐性を持ちます。',
        };
    }
    if (TRUSTED_PROVIDERS.includes(provider)) {
        return {
            tier: 'trusted',
            label: 'Trusted TSA',
            sublabel: provider.toUpperCase(),
            color: '#00D4AA',
            border: 'rgba(0,212,170,0.40)',
            bg: 'rgba(0,212,170,0.12)',
            iconName: 'ShieldCheck',
            description:
                '主要トラストストア収録の商用TSAによるRFC3161タイムスタンプ。',
        };
    }
    return {
        tier: 'beta',
        label: 'Beta TSA',
        sublabel: provider ? provider.toUpperCase() : 'FREETSA',
        color: '#9BA3D4',
        border: 'rgba(155,163,212,0.35)',
        bg: 'rgba(155,163,212,0.10)',
        iconName: 'ShieldAlert',
        description:
            'β版TSA（FreeTSA.org）による発行。暗号的には有効ですが商用トラストストア未収録です。',
    };
}
