export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      cert_audit_logs: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          certificate_id: string
          client_ip: unknown
          created_at: string
          event_type: string
          id: string
          prev_log_sha256: string | null
          project_id: string | null
          row_sha256: string | null
          team_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          certificate_id: string
          client_ip?: unknown
          created_at?: string
          event_type: string
          id?: string
          prev_log_sha256?: string | null
          project_id?: string | null
          row_sha256?: string | null
          team_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          certificate_id?: string
          client_ip?: unknown
          created_at?: string
          event_type?: string
          id?: string
          prev_log_sha256?: string | null
          project_id?: string | null
          row_sha256?: string | null
          team_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cert_audit_logs_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cert_audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cert_audit_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          badge_tier: string
          c2pa_manifest: Json | null
          certified_at: string | null
          created_at: string
          delivery_status: string | null
          description: string | null
          file_name: string | null
          file_size: number
          file_url: string | null
          height_px: number | null
          id: string
          is_active: boolean | null
          is_archived: boolean | null
          is_starred: boolean | null
          metadata: Json
          metadata_json: Json
          mime_type: string
          moderated_at: string | null
          moderation_reason: string | null
          moderation_status: string | null
          original_filename: string
          process_bundle_id: string | null
          project_id: string | null
          proof_mode: string
          proven_at: string
          public_image_url: string | null
          public_verify_token: string
          sha256: string
          show_in_gallery: boolean | null
          status: string
          storage_path: string | null
          team_id: string | null
          timestamp_token: string | null
          title: string | null
          tsa_provider: string | null
          tsa_url: string | null
          updated_at: string
          user_id: string | null
          visibility: string
          width_px: number | null
        }
        Insert: {
          badge_tier?: string
          c2pa_manifest?: Json | null
          certified_at?: string | null
          created_at?: string
          delivery_status?: string | null
          description?: string | null
          file_name?: string | null
          file_size?: number
          file_url?: string | null
          height_px?: number | null
          id?: string
          is_active?: boolean | null
          is_archived?: boolean | null
          is_starred?: boolean | null
          metadata?: Json
          metadata_json?: Json
          mime_type?: string
          moderated_at?: string | null
          moderation_reason?: string | null
          moderation_status?: string | null
          original_filename?: string
          process_bundle_id?: string | null
          project_id?: string | null
          proof_mode?: string
          proven_at?: string
          public_image_url?: string | null
          public_verify_token?: string
          sha256: string
          show_in_gallery?: boolean | null
          status?: string
          storage_path?: string | null
          team_id?: string | null
          timestamp_token?: string | null
          title?: string | null
          tsa_provider?: string | null
          tsa_url?: string | null
          updated_at?: string
          user_id?: string | null
          visibility?: string
          width_px?: number | null
        }
        Update: {
          badge_tier?: string
          c2pa_manifest?: Json | null
          certified_at?: string | null
          created_at?: string
          delivery_status?: string | null
          description?: string | null
          file_name?: string | null
          file_size?: number
          file_url?: string | null
          height_px?: number | null
          id?: string
          is_active?: boolean | null
          is_archived?: boolean | null
          is_starred?: boolean | null
          metadata?: Json
          metadata_json?: Json
          mime_type?: string
          moderated_at?: string | null
          moderation_reason?: string | null
          moderation_status?: string | null
          original_filename?: string
          process_bundle_id?: string | null
          project_id?: string | null
          proof_mode?: string
          proven_at?: string
          public_image_url?: string | null
          public_verify_token?: string
          sha256?: string
          show_in_gallery?: boolean | null
          status?: string
          storage_path?: string | null
          team_id?: string | null
          timestamp_token?: string | null
          title?: string | null
          tsa_provider?: string | null
          tsa_url?: string | null
          updated_at?: string
          user_id?: string | null
          visibility?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_process_bundle_fk"
            columns: ["process_bundle_id"]
            isOneToOne: false
            referencedRelation: "process_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          ip: string | null
          message: string
          name: string
          status: string
          topic: string
          user_agent: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          message: string
          name: string
          status?: string
          topic: string
          user_agent?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          message?: string
          name?: string
          status?: string
          topic?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      early_registrations: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: unknown
          plan_interest: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          plan_interest?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          plan_interest?: string | null
        }
        Relationships: []
      }
      process_bundle_steps: {
        Row: {
          bundle_id: string
          chain_payload_json: Json
          chain_sha256: string | null
          created_at: string
          description: string | null
          file_size: number
          id: string
          issued_at: string
          mime_type: string
          original_filename: string
          prev_chain_sha256: string | null
          prev_step_id: string | null
          preview_url: string | null
          root_step_id: string | null
          sha256: string
          step_index: number
          step_type: string
          storage_path: string | null
          title: string
          user_id: string
        }
        Insert: {
          bundle_id: string
          chain_payload_json?: Json
          chain_sha256?: string | null
          created_at?: string
          description?: string | null
          file_size: number
          id?: string
          issued_at?: string
          mime_type: string
          original_filename: string
          prev_chain_sha256?: string | null
          prev_step_id?: string | null
          preview_url?: string | null
          root_step_id?: string | null
          sha256: string
          step_index: number
          step_type: string
          storage_path?: string | null
          title: string
          user_id: string
        }
        Update: {
          bundle_id?: string
          chain_payload_json?: Json
          chain_sha256?: string | null
          created_at?: string
          description?: string | null
          file_size?: number
          id?: string
          issued_at?: string
          mime_type?: string
          original_filename?: string
          prev_chain_sha256?: string | null
          prev_step_id?: string | null
          preview_url?: string | null
          root_step_id?: string | null
          sha256?: string
          step_index?: number
          step_type?: string
          storage_path?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_bundle_steps_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "process_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_bundle_steps_prev_step_fk"
            columns: ["prev_step_id"]
            isOneToOne: false
            referencedRelation: "process_bundle_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_bundle_steps_root_step_fk"
            columns: ["root_step_id"]
            isOneToOne: false
            referencedRelation: "process_bundle_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_bundle_steps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      process_bundles: {
        Row: {
          certificate_id: string | null
          chain_depth: number
          chain_head_sha256: string | null
          chain_head_step_id: string | null
          chain_verification_status: string
          chain_verified_at: string | null
          cover_step_id: string | null
          created_at: string
          description: string | null
          evidence_mode: string
          id: string
          is_public: boolean
          root_step_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_id?: string | null
          chain_depth?: number
          chain_head_sha256?: string | null
          chain_head_step_id?: string | null
          chain_verification_status?: string
          chain_verified_at?: string | null
          cover_step_id?: string | null
          created_at?: string
          description?: string | null
          evidence_mode?: string
          id?: string
          is_public?: boolean
          root_step_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_id?: string | null
          chain_depth?: number
          chain_head_sha256?: string | null
          chain_head_step_id?: string | null
          chain_verification_status?: string
          chain_verified_at?: string | null
          cover_step_id?: string | null
          created_at?: string
          description?: string | null
          evidence_mode?: string
          id?: string
          is_public?: boolean
          root_step_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_bundles_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_bundles_chain_head_step_fk"
            columns: ["chain_head_step_id"]
            isOneToOne: false
            referencedRelation: "process_bundle_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_bundles_cover_step_fk"
            columns: ["cover_step_id"]
            isOneToOne: false
            referencedRelation: "process_bundle_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_bundles_root_step_fk"
            columns: ["root_step_id"]
            isOneToOne: false
            referencedRelation: "process_bundle_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_bundles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          contact_label: string | null
          contact_url: string | null
          created_at: string
          custom_links: Json | null
          display_name: string | null
          fanbox_url: string | null
          id: string
          instagram_url: string | null
          is_founder: boolean | null
          is_storefront_public: boolean | null
          nda_default_mode: string | null
          patreon_url: string | null
          pixiv_url: string | null
          plan_tier: string
          storefront_theme: Json | null
          stripe_current_period_end: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          studio_bio: string | null
          studio_domain: string | null
          studio_logo_url: string | null
          studio_name: string | null
          studio_tagline: string | null
          tiktok_url: string | null
          updated_at: string
          username: string
          verified_at: string | null
          verified_method: string | null
          verified_status: string | null
          website_url: string | null
          x_handle: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          contact_label?: string | null
          contact_url?: string | null
          created_at?: string
          custom_links?: Json | null
          display_name?: string | null
          fanbox_url?: string | null
          id: string
          instagram_url?: string | null
          is_founder?: boolean | null
          is_storefront_public?: boolean | null
          nda_default_mode?: string | null
          patreon_url?: string | null
          pixiv_url?: string | null
          plan_tier?: string
          storefront_theme?: Json | null
          stripe_current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          studio_bio?: string | null
          studio_domain?: string | null
          studio_logo_url?: string | null
          studio_name?: string | null
          studio_tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          username: string
          verified_at?: string | null
          verified_method?: string | null
          verified_status?: string | null
          website_url?: string | null
          x_handle?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          contact_label?: string | null
          contact_url?: string | null
          created_at?: string
          custom_links?: Json | null
          display_name?: string | null
          fanbox_url?: string | null
          id?: string
          instagram_url?: string | null
          is_founder?: boolean | null
          is_storefront_public?: boolean | null
          nda_default_mode?: string | null
          patreon_url?: string | null
          pixiv_url?: string | null
          plan_tier?: string
          storefront_theme?: Json | null
          stripe_current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          studio_bio?: string | null
          studio_domain?: string | null
          studio_logo_url?: string | null
          studio_name?: string | null
          studio_tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          username?: string
          verified_at?: string | null
          verified_method?: string | null
          verified_status?: string | null
          website_url?: string | null
          x_handle?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_name: string | null
          color: string
          created_at: string
          due_at: string | null
          id: string
          is_public: boolean | null
          metadata: Json
          name: string
          notes: string | null
          owner_id: string
          public_cover_url: string | null
          public_summary: string | null
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          color?: string
          created_at?: string
          due_at?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json
          name: string
          notes?: string | null
          owner_id: string
          public_cover_url?: string | null
          public_summary?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          color?: string
          created_at?: string
          due_at?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json
          name?: string
          notes?: string | null
          owner_id?: string
          public_cover_url?: string | null
          public_summary?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      spot_orders: {
        Row: {
          amount_total: number | null
          certified_at: string | null
          created_at: string
          currency: string | null
          email: string | null
          filename: string | null
          paid_at: string | null
          sha256: string | null
          staging_id: string
          status: string
          storage_paths: string[]
          stripe_payment_intent_id: string | null
          stripe_session_id: string
          tsa_error: string | null
          tsa_provider: string | null
          tsa_status: string
          tsa_url: string | null
        }
        Insert: {
          amount_total?: number | null
          certified_at?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          filename?: string | null
          paid_at?: string | null
          sha256?: string | null
          staging_id: string
          status?: string
          storage_paths?: string[]
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
          tsa_error?: string | null
          tsa_provider?: string | null
          tsa_status?: string
          tsa_url?: string | null
        }
        Update: {
          amount_total?: number | null
          certified_at?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          filename?: string | null
          paid_at?: string | null
          sha256?: string | null
          staging_id?: string
          status?: string
          storage_paths?: string[]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
          tsa_error?: string | null
          tsa_provider?: string | null
          tsa_status?: string
          tsa_url?: string | null
        }
        Relationships: []
      }
      stat_counters: {
        Row: {
          stat_name: string
          stat_value: number | null
        }
        Insert: {
          stat_name: string
          stat_value?: number | null
        }
        Update: {
          stat_name?: string
          stat_value?: number | null
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id: string
          payload: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invitee_email: string
          inviter_id: string
          role: string
          team_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          invitee_email: string
          inviter_id: string
          role?: string
          team_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string
          inviter_id?: string
          role?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          max_seats: number
          name: string
          owner_id: string
          plan_tier: string
          slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_seats?: number
          name: string
          owner_id: string
          plan_tier?: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_seats?: number
          name?: string
          owner_id?: string
          plan_tier?: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_accept_team_invite: {
        Args: { p_current_email: string; p_token: string; p_user_id: string }
        Returns: {
          role: string
          team_id: string
        }[]
      }
      fn_create_team: {
        Args: { p_max_seats?: number; p_name: string; p_owner_id: string }
        Returns: string
      }
      fn_create_team_invitation: {
        Args: {
          p_email: string
          p_inviter_id: string
          p_role?: string
          p_team_id: string
          p_ttl_minutes?: number
        }
        Returns: {
          expires_at: string
          id: string
          token: string
        }[]
      }
      fn_execute_spot_gc: { Args: never; Returns: number }
      fn_list_my_teams: {
        Args: { p_user_id: string }
        Returns: {
          max_seats: number
          member_count: number
          role: string
          team_id: string
          team_name: string
        }[]
      }
      fn_list_recent_audit: {
        Args: { p_certificate_id: string; p_limit?: number }
        Returns: {
          actor_email: string
          actor_id: string
          after_state: Json
          before_state: Json
          created_at: string
          event_type: string
          id: string
          prev_log_sha256: string
          row_sha256: string
        }[]
      }
      fn_lock_stripe_event: {
        Args: { p_event_id: string; p_event_type: string; p_payload: Json }
        Returns: {
          locked_id: string
          was_retry: boolean
        }[]
      }
      fn_log_cert_event: {
        Args: {
          p_actor_email: string
          p_actor_id: string
          p_after?: Json
          p_before?: Json
          p_certificate_id: string
          p_client_ip?: unknown
          p_event_type: string
          p_user_agent?: string
        }
        Returns: string
      }
      fn_mark_stripe_event_failed: {
        Args: { p_error: string; p_event_id: string }
        Returns: undefined
      }
      fn_mark_stripe_event_processed: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      fn_monthly_issuance_count: { Args: { uid: string }; Returns: number }
      fn_set_studio_verification: {
        Args: { p_method?: string; p_status: string; p_user_id: string }
        Returns: undefined
      }
      fn_spot_append_storage_path: {
        Args: { p_path: string; p_staging_id: string }
        Returns: undefined
      }
      fn_storefront_certificates: {
        Args: { p_limit?: number; p_project_id?: string; p_username: string }
        Returns: {
          badge_tier: string
          c2pa_ai_provider: string
          c2pa_ai_used: boolean
          c2pa_issuer: string
          c2pa_present: boolean
          c2pa_valid: boolean
          certified_at: string
          delivery_status: string
          has_timestamp: boolean
          id: string
          project_id: string
          proof_mode: string
          proven_at: string
          public_image_url: string
          sha256: string
          title: string
          tsa_provider: string
          visibility: string
        }[]
      }
      fn_storefront_kpi: {
        Args: { p_username: string }
        Returns: {
          audited_chain_count: number
          latest_proven_at: string
          nda_masked_assets: number
          public_assets: number
          total_assets: number
          trusted_tsa_count: number
        }[]
      }
      fn_storefront_profile: {
        Args: { p_username: string }
        Returns: {
          avatar_url: string
          contact_label: string
          contact_url: string
          id: string
          is_founder: boolean
          nda_default_mode: string
          plan_tier: string
          storefront_theme: Json
          studio_bio: string
          studio_domain: string
          studio_logo_url: string
          studio_name: string
          studio_tagline: string
          username: string
          verified_at: string
          verified_method: string
          verified_status: string
        }[]
      }
      fn_storefront_projects: {
        Args: { p_username: string }
        Returns: {
          certificate_count: number
          client_name: string
          color: string
          due_at: string
          id: string
          name: string
          public_cover_url: string
          public_summary: string
          status: string
        }[]
      }
      fn_user_project_ids: { Args: { uid: string }; Returns: string[] }
      fn_user_team_ids: { Args: { uid: string }; Returns: string[] }
      fn_verify_audit_chain: {
        Args: { p_certificate_id: string }
        Returns: boolean
      }
      get_process_bundle_lineage: {
        Args: { bundle_uuid: string }
        Returns: {
          bundle_id: string
          chain_sha256: string
          description: string
          id: string
          issued_at: string
          prev_chain_sha256: string
          prev_step_id: string
          sha256: string
          step_index: number
          step_type: string
          title: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
