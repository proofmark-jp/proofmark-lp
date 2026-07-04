export type ProofMode = 'private' | 'shareable';
export type Visibility = 'private' | 'unlisted' | 'public';
export type BadgeTier = 'basic' | 'pro' | 'studio' | 'legacy';
export type BundleStepType = 'rough' | 'lineart' | 'color' | 'final' | 'other';
export type EvidenceMode = 'hash_chain_v1';

export type CertificateRecord = {
  id: string;
  title: string | null;
  sha256: string;
  proof_mode: ProofMode;
  visibility: Visibility;
  public_verify_token: string;
  public_image_url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  width_px: number | null;
  height_px: number | null;
  badge_tier: BadgeTier;
  process_bundle_id: string | null;
  metadata_json: Record<string, unknown> | null;
  proven_at: string;
  created_at: string;
  c2paSignal?: WidgetC2paSignal;
};


export type ProcessBundleDraftStep = {
  id: string;
  stepType: BundleStepType;
  title: string;
  note?: string;
  file?: File;
  previewUrl?: string;
  /** If true, this step represents an existing certificate (locked, no file upload needed) */
  isRoot?: boolean;
  /** Pre-computed SHA-256 hash (for root steps from existing certificates) */
  sha256?: string;
};

export type EvidenceChainSummary = {
  valid: boolean;
  chainDepth: number;
  headChainSha256: string | null;
  headStepId: string | null;
  rootStepId: string | null;
  brokenAtStepId: string | null;
  mismatches: string[];
};

export type ProcessBundlePublic = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  evidence_mode?: EvidenceMode;
  chain_depth?: number | null;
  chain_head_sha256?: string | null;
  chain_summary?: EvidenceChainSummary;
  steps: Array<{
    id: string;
    step_index: number;
    step_type: BundleStepType;
    title: string;
    description?: string | null;
    preview_url: string | null;
    sha256: string;
    original_filename?: string;
    mime_type?: string;
    file_size?: number;
    prev_step_id?: string | null;
    prev_chain_sha256?: string | null;
    chain_sha256?: string | null;
    issued_at?: string | null;
  }>;
};

export type PortfolioEmbedSettings = {
  theme: 'dark' | 'light';
  layout: 'grid' | 'list' | 'compact';
  showBadges: boolean;
  showBundles: boolean;
  maxItems: number;
};

/** ADR-009: C2PA マニフェストから抽出するトラスト・シグナル */
export interface WidgetC2paSignal {
  hasC2pa: boolean;
  isAiGenerated: boolean;
  isHumanEdited: boolean;
  generatorName: string | null;
  signatureValid: boolean;
}

