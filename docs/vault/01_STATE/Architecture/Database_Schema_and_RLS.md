# Database Schema & Row Level Security (RLS) Specification

This document provides a comprehensive, formal specification of ProofMark’s Supabase database schema, Row Level Security (RLS) policies, Stored Procedures (RPCs), and Storage Bucket configurations. 

ProofMark employs a **WORM (Write Once, Read Many) Ledger Architecture** to establish immutable chains of evidence for creative assets while strictly maintaining tenant isolation, GDPR compliance (account deletion anonymization), and storage cost containment.

---

## 🏗️ 1. Core Architectural Pillars

### 1.1 WORM Ledger (Immutable Audit Trail)
- **Zero Client Trust:** All data mutation paths (INSERT, UPDATE, DELETE) on the core `certificates` table are completely blocked for general users at the RLS policy layer. Client actions are strictly limited to `SELECT`.
- **System-Enforced Writes:** Data is committed to the database strictly via backend endpoints running with the `service_role` credential or via triggers/functions executing as `SECURITY DEFINER`.
- **Tamper Evidence:** Event audits (`cert_audit_logs`) are physically linked to previous records via SHA-256 hash chains. Any unauthorized change to a previous log entry breaks the verification hash chain.

### 1.2 Storage Separation & Ephemeral Quarantine
- **Zero-Copy Promotion (ADR-001):** Raw uploads go to the isolated temporary quarantine bucket. Once verified and paid/processed, files are atomically cataloged without costly cross-bucket file copies.
- **Storage Depreciation (ADR-003):** Free-tier storage is automatically reclaimed after 30 days. The original asset is physically deleted from the storage bucket, and the catalog entry is flagged with `is_asset_purged = true` while retaining the cryptographic timestamp ledger entry (`sha256`, `timestamp_token`) for verification.
- **Guest Ephemeral Bounds:** Spot purchases allow download availability for exactly 24 hours, after which the original asset file is purged, maintaining the proof record only.

---

## 📊 2. Database Schema (Tables & Columns)

ProofMark operates with the following primary relational tables.

```mermaid
erDiagram
    profiles ||--o{ certificates : "owns"
    profiles ||--o{ teams : "owns (as seat payer)"
    profiles ||--o{ team_members : "belongs to"
    teams ||--o{ team_members : "has members"
    teams ||--o{ team_invitations : "issues"
    projects ||--o{ certificates : "groups"
    teams ||--o{ projects : "contains"
    certificates ||--o{ cert_audit_logs : "audits"
    process_bundles ||--o{ process_bundle_steps : "contains steps"
    certificates ||--o[ process_bundles : "associated bundle"
```

### 2.1 profiles
Stores user profile information, billing state, and Studio-level branding properties.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Unique identifier linked to the Supabase Auth user. |
| `username` | `TEXT` | `UNIQUE NOT NULL` | Web-slug identifier for the user's public profile/storefront. |
| `display_name` | `TEXT` | | Human-friendly name displayed on certificates and profile pages. |
| `avatar_url` | `TEXT` | | URL path to the user's uploaded avatar image. |
| `bio` | `TEXT` | | Short creator bio description. |
| `plan_tier` | `TEXT` | `NOT NULL DEFAULT 'free'`, Check: `IN ('free', 'creator', 'studio', 'business', 'admin')` | Active subscription level mapping features and quotas. |
| `stripe_customer_id` | `TEXT` | `UNIQUE` | Stripe customer object reference. |
| `stripe_subscription_id` | `TEXT` | | Stripe active subscription ID. |
| `stripe_current_period_end` | `TIMESTAMPTZ` | | Stripe billing cycle end date. |
| `legal_name` | `TEXT` | `DEFAULT ''` | Physical/corporate legal name used for NDAs and certificates. |
| `default_persona` | `TEXT` | `DEFAULT 'creator'`, Check: `IN ('creator', 'legal')` | Flag selecting default signing persona (creator pseudonym vs. legal name). |
| `studio_name` | `TEXT` | Check: `length <= 80` | Agency/studio business name for storefront. |
| `studio_logo_url` | `TEXT` | | Studio brand logo image URL. |
| `studio_domain` | `TEXT` | Check: domain format regex | Custom DNS domain (e.g. `agency.com`). |
| `studio_tagline` | `TEXT` | Check: `length <= 120` | One-sentence studio pitch line. |
| `studio_bio` | `TEXT` | Check: `length <= 600` | Expanded studio bio. |
| `contact_url` | `TEXT` | Check: URL/mailto format regex | Studio storefront CTA connection link. |
| `contact_label` | `TEXT` | | Call-to-action text for storefront button. |
| `nda_default_mode` | `TEXT` | `DEFAULT 'masked'`, Check: `IN ('open', 'masked', 'hidden')` | Controls NDA file shielding default posture for storefront visitors. |
| `verified_status` | `TEXT` | `DEFAULT 'unverified'`, Check: `IN ('unverified', 'pending', 'verified')` | Authenticated verification status of the custom studio domain. |
| `verified_at` | `TIMESTAMPTZ` | | Timestamp domain verification succeeded. |
| `verified_method` | `TEXT` | Check: `IN ('dns_txt', 'email', 'manual')` | Method used to complete studio verification. |
| `storefront_theme` | `JSONB` | `DEFAULT '{}'` | Design layout configuration overrides for custom storefront. |
| `is_storefront_public`| `BOOLEAN`| `DEFAULT true` | Toggles search-indexing and public storefront visibility. |
| `is_founder` | `BOOLEAN` | `DEFAULT false` | Flag identifying early founder status (granting special badges/perks). |
| Social Links | `TEXT` | | Social account hooks: `x_handle`, `x_url`, `instagram_url`, `tiktok_url`, `youtube_url`, `pixiv_url`, `fanbox_url`, `patreon_url`, `website_url`. |
| `custom_links` | `JSONB` | `DEFAULT '[]'` | Arbitrary creator-defined URL list. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row insertion time. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Auto-updated via `set_profiles_updated_at` trigger. |

### 2.2 certificates
The primary WORM ledger holding the evidence record, TSA signatures, and file references.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique evidence record ID. |
| `user_id` | `UUID` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Reference to record owner profile. Becomes `NULL` on deletion to anonymize data but keep ledger intact. |
| `process_bundle_id` | `UUID` | `REFERENCES process_bundles(id) ON DELETE SET NULL` | Parent bundle reference if this belongs to a multi-step timeline. |
| `step_index` | `INTEGER` | `DEFAULT 0` | Ordering index of this evidence item in its parent bundle. |
| `title` | `TEXT` | `NOT NULL` | User-defined title for the asset. |
| `description` | `TEXT` | | Detailed notes on the evidence. |
| `proof_mode` | `TEXT` | `NOT NULL`, Check: `IN ('private', 'shareable', 'spot')` | Security context: private, shareable via link, or guest paid-spot. |
| `visibility` | `TEXT` | `NOT NULL DEFAULT 'private'`, Check: `IN ('private', 'unlisted', 'public')` | Exposure rules for profiles, dashboard, and public verification screens. |
| `sha256` | `CHAR(64)` | `NOT NULL UNIQUE` | SHA-256 cryptographic digest of the target file. Core check key. |
| `timestamp_token` | `TEXT` | | Base64-encoded RFC3161 TSA cryptographic signature response. |
| `certified_at` | `TIMESTAMPTZ` | | TSA official signing timestamp. |
| `tsa_provider` | `TEXT` | | TSA authority name (e.g., DigiCert). |
| `tsa_url` | `TEXT` | | TSA endpoint URL used. |
| `tsr_token_base64` | `TEXT` | | Direct copy of the raw base64 TSA token response. |
| `storage_path` | `TEXT` | | Active object key inside `proofmark-originals` or relevant storage. |
| `public_image_url` | `TEXT` | | Thumbnail/preview URL generated for dashboard/gallery displays. |
| `file_name` | `TEXT` | `NOT NULL` | Sanitized file name. |
| `original_filename` | `TEXT` | | Raw filename on creator's machine. |
| `mime_type` | `TEXT` | | Media MIME type (e.g., `image/png`, `application/pdf`). |
| `file_size` | `BIGINT` | `NOT NULL` | Data volume size in bytes. |
| `width_px` | `INTEGER` | | Dimensions of images. |
| `height_px` | `INTEGER` | | Dimensions of images. |
| `badge_tier` | `TEXT` | `NOT NULL DEFAULT 'basic'`, Check: `IN ('basic', 'pro', 'studio', 'legacy')` | Style badge tier assigned to this certificate. |
| `project_id` | `UUID` | `REFERENCES projects(id) ON DELETE SET NULL` | ID of the grouping project. |
| `delivery_status` | `TEXT` | Check: `IN ('draft', 'in_progress', 'review', 'ready', 'delivered', 'on_hold')` | Operational state of the asset in creative workflows. |
| `c2pa_manifest` | `JSONB` | | Embedded C2PA metadata validity information. |
| `metadata_json` | `JSONB` | `DEFAULT '{}'` | Payment status indicators (e.g. `stripe_payment_status: 'succeeded'`) and other custom tags. |
| `is_asset_purged` | `BOOLEAN` | `DEFAULT false` | Operational flag. True if the file has been purged due to tier expiry/retention bounds. |
| `purged_at` | `TIMESTAMPTZ` | | Date the storage file was purged. |
| `is_archived` | `BOOLEAN` | `DEFAULT false` | Flag separating active files from archived vault records. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Auto-updated via `handle_certificates_updated_at` trigger. |

> [!IMPORTANT]
> **Unique Constraint:** `certificates` enforces a unique constraint on `(process_bundle_id, step_index)`. Multiple certificates belonging to the same timeline cannot share a sequence step index, safeguarding structural timeline order.

### 2.3 projects
Folder-level grouping entity for Studio projects (案件フォルダ).

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Project ID. |
| `owner_id` | `UUID` | `NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | Creator/Owner who spawned the folder. |
| `team_id` | `UUID` | `REFERENCES teams(id) ON DELETE SET NULL` | Linked team (if shared with teammates). |
| `name` | `TEXT` | `NOT NULL`, Check: `length between 1 and 80` | Client folder/project name. |
| `client_name` | `TEXT` | Check: `length <= 80` | External client name. |
| `color` | `TEXT` | `NOT NULL DEFAULT '#6C3EF4'`, Check: hex format | Hexadecimal color code for UI customization. |
| `status` | `TEXT` | `NOT NULL DEFAULT 'active'`, Check: `IN ('active', 'on_hold', 'delivered', 'archived')` | Project lifecycle status. |
| `due_at` | `TIMESTAMPTZ` | | Project deadline. |
| `notes` | `TEXT` | Check: `length <= 2000` | Internal folder description. |
| `metadata` | `JSONB` | `DEFAULT '{}'` | Extensible JSON object metadata. |
| `is_public` | `BOOLEAN` | `DEFAULT false` | Exposes the project workspace as public. |
| `public_summary` | `TEXT` | Check: `length <= 600` | Public description on storefront. |
| `public_cover_url` | `TEXT` | | Project cover photo. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Creation date. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Updated via trigger. |

### 2.4 teams
Defines the subscription holder seat workspace.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Team workspace ID. |
| `name` | `TEXT` | `NOT NULL`, Check: `length between 1 and 80` | Brand/Team name. |
| `slug` | `TEXT` | `UNIQUE`, Check: slug URL format | Subdomain slug (e.g. `team-alpha`). |
| `owner_id` | `UUID` | `NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT` | Owning profile (paying seat holder). Account deletion blocked while teams are active. |
| `plan_tier` | `TEXT` | `NOT NULL DEFAULT 'studio'`, Check: `IN ('studio', 'business')` | Shared billing tier bounds. |
| `max_seats` | `INTEGER` | `NOT NULL DEFAULT 5`, Check: `1 to 200` | Max users allowed in workspace. |
| `status` | `TEXT` | `NOT NULL DEFAULT 'active'`, Check: `IN ('active', 'suspended', 'archived')` | Operational status of team. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Team registration timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Updated via trigger. |

### 2.5 team_members
Intersection table recording team membership access roles.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `team_id` | `UUID` | `REFERENCES teams(id) ON DELETE CASCADE` | Parent team ID. |
| `user_id` | `UUID` | `REFERENCES profiles(id) ON DELETE CASCADE` | Member profile ID. |
| `role` | `TEXT` | `NOT NULL DEFAULT 'member'`, Check: `IN ('owner', 'admin', 'member')` | Member permissions role. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Membership creation date. |

- **Composite Primary Key:** `PRIMARY KEY (team_id, user_id)`

### 2.6 team_invitations
Outstanding team join requests.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Invitation ID. |
| `team_id` | `UUID` | `REFERENCES teams(id) ON DELETE CASCADE` | Destination team. |
| `inviter_id` | `UUID` | `REFERENCES profiles(id) ON DELETE CASCADE` | Submitting admin/owner profile. |
| `invitee_email`| `CITEXT` | `NOT NULL` | Target invite email (case-insensitive type). |
| `role` | `TEXT` | `NOT NULL DEFAULT 'member'`, Check: `IN ('admin', 'member')` | Target role inside team. |
| `token` | `TEXT` | `NOT NULL UNIQUE` | Cryptographic secret URL token. |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Validity date of invitation. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Invitation timestamp. |

- **Unique Constraint:** `UNIQUE (team_id, invitee_email)` prevents multiple invitations to the same email.

### 2.7 cert_audit_logs
Append-only, tamper-evident record logs auditing critical changes on certificates.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Audit log item ID. |
| `certificate_id`| `UUID` | `NOT NULL REFERENCES certificates(id) ON DELETE CASCADE` | Linked certificate. |
| `team_id` | `UUID` | `REFERENCES teams(id) ON DELETE SET NULL` | Linked team context snapshot. |
| `project_id` | `UUID` | `REFERENCES projects(id) ON DELETE SET NULL` | Linked project context snapshot. |
| `actor_id` | `UUID` | `REFERENCES profiles(id) ON DELETE SET NULL` | Acting user ID. |
| `actor_email` | `CITEXT` | | Snapshot of the actor email. |
| `event_type` | `TEXT` | Check: `IN ('created', 'updated', 'status_changed', 'project_changed', 'archived', 'restored', 'deleted', 'evidence_pack_downloaded', 'shared', 'team_assigned', 'invitation_accepted')` | Categorical action event. |
| `before_state` | `JSONB` | | Fields state before execution. |
| `after_state` | `JSONB` | | Fields state post execution. |
| `prev_log_sha256`| `TEXT` | Check: hex string format | Previous log entry's hash for this certificate. |
| `row_sha256` | `TEXT` | Check: hex string format | Canonical JSON hash of current row content. |
| `client_ip` | `INET` | | User agent's IP context. |
| `user_agent` | `TEXT` | | User agent header. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Audit timestamp. |

### 2.8 process_bundles
Represents the parent timeline object (timeline envelope) that groups multi-step creative timelines.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Bundle ID. |
| `user_id` | `UUID` | `REFERENCES profiles(id) ON DELETE CASCADE` | Creator owner. |
| `certificate_id`| `UUID` | `REFERENCES certificates(id) ON DELETE SET NULL` | Backlink reference to final/primary certificate. |
| `title` | `TEXT` | `NOT NULL` | Name of process bundle. |
| `description` | `TEXT` | | Description notes. |
| `cover_step_id` | `UUID` | `REFERENCES process_bundle_steps(id) ON DELETE SET NULL` | Selection of step image used for cover thumbnail. |
| `evidence_mode` | `TEXT` | Check: `IN ('hash_chain_v1')` | Validation schema used to link step hashes. |
| `root_step_id` | `UUID` | `REFERENCES process_bundle_steps(id) ON DELETE SET NULL` | Initial step in timeline. |
| `chain_head_step_id`| `UUID` | `REFERENCES process_bundle_steps(id) ON DELETE SET NULL`| Current tail step of the bundle hash chain. |
| `chain_head_sha256`| `TEXT` | | Hash digest at the head of the chain. |
| `chain_depth` | `INTEGER` | `NOT NULL DEFAULT 0` | Total step count. |
| `chain_verification_status`| `TEXT`| `DEFAULT 'pending'`, Check: `IN ('pending', 'verified', 'broken')` | Verification state of internal step links. |
| `chain_verified_at`| `TIMESTAMPTZ` | | Timestamp chain was verified. |
| `status` | `TEXT` | `NOT NULL DEFAULT 'draft'`, Check: `IN ('draft', 'issued', 'archived')` | Publication status of bundle. |
| `is_public` | `BOOLEAN` | `DEFAULT true` | Public visibility flag. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Insertion timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Modified timestamp. |

### 2.9 process_bundle_steps
Step nodes in a creative progress chain.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Step ID. |
| `bundle_id` | `UUID` | `REFERENCES process_bundles(id) ON DELETE CASCADE` | Parent bundle container. |
| `user_id` | `UUID` | `REFERENCES profiles(id) ON DELETE CASCADE` | Owning profile. |
| `step_index` | `INTEGER` | `NOT NULL` | Sequence placement index. |
| `step_type` | `TEXT` | Check: `IN ('rough', 'lineart', 'color', 'final', 'other')` | Workflow stage classification. |
| `title` | `TEXT` | `NOT NULL` | Step descriptor. |
| `description` | `TEXT` | | Step notes. |
| `sha256` | `TEXT` | `NOT NULL` | Hash digest of raw asset file. |
| `original_filename`| `TEXT` | `NOT NULL` | Upload filename. |
| `mime_type` | `TEXT` | `NOT NULL` | Media MIME type. |
| `file_size` | `BIGINT` | `NOT NULL` | Step file byte size. |
| `storage_path` | `TEXT` | | originals file bucket key location. |
| `preview_url` | `TEXT` | | Preview link. |
| `prev_step_id` | `UUID` | `REFERENCES process_bundle_steps(id) ON DELETE SET NULL` | Pointer to previous step. |
| `root_step_id` | `UUID` | `REFERENCES process_bundle_steps(id) ON DELETE SET NULL` | Pointer to root step. |
| `prev_chain_sha256`| `TEXT` | | Hash aggregate output of previous step. |
| `chain_sha256` | `TEXT` | | Hash aggregate of this step (hash of file + prev_chain_sha256). |
| `chain_payload_json`| `JSONB`| `DEFAULT '{}'` | Metadata packaging the step audit details. |
| `issued_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Time step was finalized. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row insert timestamp. |

- **Unique Constraint:** `UNIQUE (bundle_id, step_index)` secures sequential alignment.

### 2.10 rate_limits
Lightweight, native API request tracker table.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Entry ID. |
| `user_id` | `UUID` | `REFERENCES auth.users(id) ON DELETE CASCADE` | User tracker. |
| `endpoint` | `TEXT` | `NOT NULL` | Endpoint API key (e.g. `api/register`). |
| `request_count`| `INTEGER`| `NOT NULL DEFAULT 1` | Requests made in current window. |
| `window_start` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Window timestamp. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Record timestamp. |

### 2.11 early_registrations
Standalone listing for early interest submissions.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Entry ID. |
| `email` | `TEXT` | `UNIQUE NOT NULL` | Submission email. |
| `plan_interest`| `TEXT` | `DEFAULT 'light'` | Target interest plan tier. |
| `ip_address` | `INET` | | Submitting IP. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Registration timestamp. |

### 2.12 stripe_events
Stripe webhook event idempotency ledger.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `TEXT` | `PRIMARY KEY` | Unique Stripe Event ID. |
| `type` | `TEXT` | `NOT NULL` | Webhook event type (e.g., `checkout.session.completed`). |
| `status` | `TEXT` | `NOT NULL DEFAULT 'received'`, Check: `IN ('received', 'processed', 'failed')` | Event handling status. |
| `payload` | `JSONB` | `NOT NULL` | Full raw JSON event package. |
| `error_message`| `TEXT` | | Error stack trace if execution failed. |
| `received_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Lock window tracker. |
| `processed_at` | `TIMESTAMPTZ` | | Completion timestamp. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Event log timestamp. |

### 2.13 admin_users
Superuser identity roster.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `user_id` | `UUID` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | Auth identity. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Role creation date. |

### 2.14 contact_submissions
Form submissions tracker from landing page contact requests.

| Column Name | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Submission ID. |
| `topic` | `TEXT` | `NOT NULL` | Form categorization header. |
| `name` | `TEXT` | `NOT NULL` | Submitter name. |
| `email` | `TEXT` | `NOT NULL` | Submitter contact address. |
| `company` | `TEXT` | | Submitter company context. |
| `message` | `TEXT` | `NOT NULL` | Form input message. |
| `ip` | `TEXT` | | Submitter network IP. |
| `user_agent` | `TEXT` | | Browser user agent string. |
| `status` | `TEXT` | `NOT NULL DEFAULT 'new'`, Check: `IN ('new', 'in_review', 'closed')` | Submission ticket state. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Form date. |

---

## 🔒 3. Row Level Security (RLS) Matrix

RLS is enabled on all public schemas to isolate user spaces and restrict unauthorized reads or tampering.

| Table | Policy Name | Operation | Targeting Role | Enforced Condition (`USING` / `WITH CHECK`) |
|:---|:---|:---|:---|:---|
| **certificates** | `Users can view their own or public certificates` | `SELECT` | `public` (All) | `auth.uid() = user_id OR visibility IN ('public', 'unlisted') OR proof_mode = 'shareable'` |
| | `No direct inserts from client` | `INSERT` | `public` | `false` (Deny clients completely; backend service-role executes writes) |
| | `No direct updates from client` | `UPDATE` | `public` | `false` (Deny clients completely; backend service-role executes writes) |
| | `No direct deletes from client` | `DELETE` | `public` | `false` (Deny clients completely; backend service-role executes writes) |
| **profiles** | `Public profiles are viewable by everyone.` | `SELECT` | `public` | `true` |
| | `Users can insert their own profile.` | `INSERT` | `authenticated`| `auth.uid() = id` |
| | `Users can update their own profile.` | `UPDATE` | `authenticated`| `auth.uid() = id` |
| **projects** | `projects own select` | `SELECT` | `authenticated`| `owner_id = auth.uid() OR (team_id IS NOT NULL AND team_id = ANY(public.fn_user_team_ids(auth.uid())))` |
| | `projects own insert` | `INSERT` | `authenticated`| `owner_id = auth.uid() AND (team_id IS NULL OR team_id = ANY(public.fn_user_team_ids(auth.uid())))` |
| | `projects own update` | `UPDATE` | `authenticated`| `owner_id = auth.uid() OR (team_id IS NOT NULL AND team_id = ANY(public.fn_user_team_ids(auth.uid())))` |
| | `projects own delete` | `DELETE` | `authenticated`| `owner_id = auth.uid()` (Teammates cannot delete) |
| **teams** | `teams member select` | `SELECT` | `authenticated`| `id = ANY(public.fn_user_team_ids(auth.uid()))` |
| | `teams owner update` | `UPDATE` | `authenticated`| `owner_id = auth.uid()` |
| **team_members** | `team_members own select` | `SELECT` | `authenticated`| `team_id = ANY(public.fn_user_team_ids(auth.uid()))` |
| **team_invitations** | `invitations inviter select` | `SELECT` | `authenticated`| `inviter_id = auth.uid() OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())` |
| **cert_audit_logs** | `audit visible select` | `SELECT` | `authenticated`| `actor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.certificates c WHERE c.id = certificate_id AND (c.user_id = auth.uid() OR (c.team_id IS NOT NULL AND c.team_id = ANY(public.fn_user_team_ids(auth.uid())))))` |
| **process_bundles** | `process bundles own select` | `SELECT` | `authenticated`| `auth.uid() = user_id` |
| | `public process bundle select` | `SELECT` | `anon` | `is_public = true AND status = 'issued'` |
| | `process bundles own insert` | `INSERT` | `authenticated`| `auth.uid() = user_id` |
| | `process bundles own update` | `UPDATE` | `authenticated`| `auth.uid() = user_id` |
| **process_bundle_steps**| `steps own select` | `SELECT` | `authenticated`| `auth.uid() = user_id` |
| | `public steps select` | `SELECT` | `anon` | `EXISTS (SELECT 1 FROM public.process_bundles pb WHERE pb.id = bundle_id AND pb.is_public = true AND pb.status = 'issued')` |
| | `steps own insert` | `INSERT` | `authenticated`| `auth.uid() = user_id` |
| **rate_limits** | *Default Deny* | `ALL` | `public` | `false` (No policies; managed via `service_role` backend only) |
| **early_registrations**| *Default Deny* | `ALL` | `public` | `false` (No policies; managed via `service_role` backend only) |
| **stripe_events** | `stripe_events_no_anon_read` | `SELECT` | `public` | `false` (Service-role only) |
| **admin_users** | `No public access to admin_users` | `ALL` | `public` | `false` (Service-role only) |
| **contact_submissions**| `contact_submissions_no_anon_read`| `SELECT` | `public` | `false` (Service-role only) |

---

## ⚙️ 4. Stored Procedures (RPCs) & Triggers

Stored procedures allow executing security-critical logic, atomic updates, and permission evaluations bypassing default RLS under controlled `SECURITY DEFINER` environments.

### 4.1 System Webhook & Transaction Routines (Service-Role Only)
These functions have their execution privileges revoked from general roles (`public`, `anon`, `authenticated`) and are restricted solely to the `service_role`.

#### `public.fn_fulfill_spot_payment(p_event_id text, p_certificate_id uuid)`
- **Behavior:** Complete Stripe checkouts for anonymous one-off (Spot) orders. It inserts a processing record into `stripe_events` to prevent double-spending, sets target certificate visibility to `'public'`, and writes `stripe_payment_status: 'succeeded'` in the certificate's `metadata_json`.

#### `public.fn_lock_stripe_event(p_event_id text, p_event_type text, p_payload jsonb)`
- **Behavior:** State-machine transaction lock for webhooks. Returns a query indicator row to Vercel API only if the event can proceed. It flips `'failed'` webhook attempts to `'received'` to enable safe retrying and releases locks that have spent >5 minutes in `'received'` status (signaling engine crash).

#### `public.fn_mark_stripe_event_processed(p_event_id text)`
- **Behavior:** Updates target Stripe event to `'processed'` with execution timestamp.

#### `public.fn_mark_stripe_event_failed(p_event_id text, p_error text)`
- **Behavior:** Sets Stripe event to `'failed'` and logs the execution error message.

#### `public.fn_set_studio_verification(p_user_id uuid, p_status text, p_method text)`
- **Behavior:** Upgrades domain verification status for storefront (`'verified'`). Validates method configurations.

---

### 4.2 Security-Definer Helpers for Client RLS
These functions execute with high privileges (`SECURITY DEFINER`) to calculate workspace membership boundaries once per query. They are set as `STABLE` so PostgreSQL evaluates them via an `InitPlan` once per statement, avoiding heavy row-by-row subquery scans.

#### `public.fn_user_team_ids(uid uuid) -> uuid[]`
- **Behavior:** Returns an array of UUIDs representing all teams the given user belongs to. Used directly in index-friendly check searches (`team_id = ANY(public.fn_user_team_ids(auth.uid()))`).

#### `public.fn_user_project_ids(uid uuid) -> uuid[]`
- **Behavior:** Gathers all project folder IDs readable by the user (projects owned by them + projects belonging to a team they are a member of).

#### `public.is_admin() -> boolean`
- **Behavior:** Checks if `auth.uid()` exists in the private `admin_users` list, returning true/false.

---

### 4.3 Tamper-Evident Audit Logging

#### `public.fn_log_cert_event(p_certificate_id uuid, p_actor_id uuid, p_actor_email citext, p_event_type text, p_before jsonb, p_after jsonb, p_client_ip inet, p_user_agent text) -> uuid`
- **Behavior:** Single logging router. It reads the previous entry's `row_sha256` for the target certificate, constructs a canonical JSON string payload including the actor's meta information and state changes, digests it with `SHA-256`, and appends the log row.
- **Lockdown:** Restrictively granted to `service_role` to block client-side log spoofing.

```
Canonical Log JSON String:
{
  "certificate_id": UUID,
  "team_id": UUID/NULL,
  "project_id": UUID/NULL,
  "actor_id": UUID/NULL,
  "actor_email": CITEXT/NULL,
  "event_type": TEXT,
  "before_state": JSONB,
  "after_state": JSONB,
  "prev_log_sha256": TEXT (SHA-256 of previous row),
  "created_at": TIMESTAMP
}
```

#### `public.fn_verify_audit_chain(p_certificate_id uuid) -> boolean`
- **Behavior:** Validates audit chain integrity by sorting logs sequentially, verifying that `prev_log_sha256` connects exactly to the previous entry, and re-digesting the row values to confirm that data hasn't been altered on disk.

#### `trg_capture_cert_audit` / `trg_cert_audit_on_change` (Trigger)
- **Behavior:** Attached to `certificates` table. Executes `AFTER INSERT OR UPDATE` to capture status modifications, folder shifts (`project_id`), or archiving toggles, routing state details to `fn_log_cert_event` automatically.

---

### 4.4 Automated TTL Storage Purging & Quotas

#### `public.get_ttl_purge_targets() -> TABLE(cert_id uuid, storage_path text, proof_mode text)`
- **Behavior:** Scans for certificates with un-purged original assets that exceed storage boundaries:
  - Spot-mode orders created > 24 hours ago.
  - Free-tier accounts created > 30 days ago.

#### `public.get_orphaned_quarantine_paths() -> TABLE(storage_path text)`
- **Behavior:** Scans the `storage.objects` table for quarantine folders that have existed for > 24 hours without being promoted to a certificate.

#### `public.cleanup_free_tier_assets()`
- **Behavior:** Scheduled daily via `pg_cron` at 02:00 UTC. It loops through target outputs returned by `get_ttl_purge_targets()`, deletes the file entry from `storage.objects` (triggering physical S3 deletion), and updates the certificate row to set `is_asset_purged = true` and `storage_path = NULL`.

#### `public.cleanup_quarantine_assets()`
- **Behavior:** Scheduled daily via `pg_cron` at 03:00 UTC. Deletes expired quarantine file paths from `storage.objects` to reclaim database buffer space.

#### `public.check_monthly_certificate_limit() (BEFORE INSERT Trigger)`
- **Behavior:** attached to `certificates`. Implements core plan limits (Free: 3/mo, Creator: 30/mo, Studio: 150/mo, Business: 1000/mo).
  - Forces `created_at = now()` to block client timeline backdating.
  - Forces `user_id = auth.uid()` to block ID-spoofing injection.
  - Takes advisory transactional lock: `pg_advisory_xact_lock(hashtext('proofmark_quota'), hashtext(user_id))` to safely serialize requests.
  - Blocks client-side Spot issuance (`proof_mode = 'spot'`) bypassing Stripe verification.

---

## 📦 5. Storage Buckets

ProofMark utilizes isolated storage spaces config. All primary assets are now secured under private settings to safeguard intellectual property.

```
📁 Storage Structure
├── 🔒 proofmark-originals   (Private: Original raw evidence uploads)
│   └── [user_id]/
│       ├── certificates/    (Active certificate assets)
│       └── bundles/         (Active timeline step files)
├── 🔒 proofmark-quarantine  (Private GUI: Temporary file buffers for upload url)
│   └── [user_id]/
│       └── [uuid].[ext]
├── 🔒 spot-evidence         (Private: Guest evidence files)
├── 🔒 certificates          (Private: PDF Output documents for verified download)
├── 🔒 proof_images          (Private: Secondary layout renders)
└── 🔒 avatars               (Private: Creator profiles)
```

### 5.1 proofmark-originals (Private)
- **Purpose:** Primary repository for files committed to certificates.
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `image/heic`, `image/heif`
- **File size limit:** 50MB
- **Access Policies:**
  - **INSERT:** Allowed to authenticated users if the folder path starts with their `auth.uid()` and is stored under `certificates/` or `bundles/`.
  - **SELECT:** Allowed only if the user matches the owning profile directory (`owner_id::text = auth.uid()`).
  - **DELETE:** Closed for general client interaction (un-pushed deletes).

### 5.2 proofmark-quarantine (Private GUI Bucket)
- **Purpose:** Provisioned via GUI interface. Serves as a temporary buffer repository before certificates are registered. Upload signed-URLs target this sandbox.
- **Public access:** OFF (Strict Private)
- **File size limit:** 50MB
- **MIME constraints:** None (allows all media types for flexibility)
- **Retention Rules:** Cleaned every 24 hours via `cleanup_quarantine_assets()` for orphaned files (Zero-Copy promotes valid files out of this space).

### 5.3 spot-evidence (Private)
- **Purpose:** Storage for single-purchase guest files.
- **Access Policy:** Direct client access disabled (All writes and reads route through backend service-role API).

### 5.4 certificates (Private)
- **Purpose:** PDF Output certificates. Changed from Public to Private in security hardening patches to prevent scraping, relying on Signed-URLs for authenticated sharing.

---

## 🔗 Connected Nodes

- [[ADR-001-Implement-Zero-Copy-Promotion]]
- [[ADR-003-Deprecate-Free-Tier-Storage]]
- [[ADR-005-Mandate-Supabase-RLS-and-JWT-Bound-Queries]]
- [[C2PA-Integration]]
- [[Stripe-Billing-Flow]]
