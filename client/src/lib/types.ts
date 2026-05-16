export type CertificateStatus = 'idle' | 'uploading' | 'processing' | 'verified' | 'failed';

export interface Certificate {
  id: string;
  title?: string;
  is_starred?: boolean;
  file_name: string;
  file_hash: string;
  file_url?: string;
  thumbnail_url?: string;
  created_at: string;
  original_filename?: string;
  public_image_url?: string;
  proof_mode?: string;
  visibility?: string | 'public' | 'private';
  sha256?: string;
  timestamp_token?: string | null;
  certified_at?: string | null;
  tsa_provider?: string | null;
  cross_anchors?: Array<{ provider: string; certified_at: string }> | null;
  client_project?: string | null;
  is_archived?: boolean;
  metadata?: Record<string, unknown>;

  // --- Obsidian Desk / HistoryTable 用の拡張プロパティ ---
  status?: CertificateStatus;
  issued_at?: string | null;
  tsa_receipt_id?: string;
  has_c2pa_data?: boolean;
  verification_url?: string;
  evidence_pack_url?: string;
}
