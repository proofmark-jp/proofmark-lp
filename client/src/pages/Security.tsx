import React from "react";
import { Lock, CheckCircle, Shield, Globe, Terminal, AlertTriangle, ExternalLink, FileCheck2 } from "lucide-react";
import { Link } from "wouter";
import SEO from "../components/SEO";

/**
 * Single source of truth for every security assertion on this page.
 * Rules:
 *   - Every item MUST either be "verified" (with a public evidence link)
 *     or "planned" (with a target quarter). No hand-wavy claims.
 *   - When a claim is downgraded (e.g. audit not yet performed), it
 *     moves to the "planned" column automatically — UI stays honest.
 */
type AssuranceStatus = "verified" | "planned" | "ongoing";

interface AssuranceItem {
  title: string;
  status: AssuranceStatus;
  summary: string;
  evidence?: { label: string; href: string };
  lastReviewed?: string; // ISO date (YYYY-MM-DD)
  eta?: string;          // e.g. "2026 Q3"
}

const ASSURANCES: AssuranceItem[] = [
  {
    title: "クライアントサイドでのハッシュ計算",
    status: "verified",
    summary:
      "Web Crypto API（SubtleCrypto）でSHA-256を完全にブラウザ内計算。Private Proofモードでは原本ファイルはProofMarkのサーバーに到達しません。フォールバックJSポリフィルは使用しません。",
    evidence: { label: "実装とNo-Fallback Policy (Trust Center §2)", href: "/trust-center#s2" },
    lastReviewed: "2026-05-12",
  },
  {
    title: "RFC3161準拠のタイムスタンプ発行",
    status: "verified",
    summary:
      "時刻認証局（TSA）が署名したタイムスタンプトークン（TST）を、ハッシュ値に対して発行。TSTはProofMarkに依存せず、OpenSSL等の標準ツールで独立検証できます。現在のTSAは FreeTSA.org（ベータ版）で、正式なSLAおよび主要トラストストア収録はありません。商用TSA（DigiCert / GlobalSign / セイコーソリューションズ）への移行計画を公開しています。",
    evidence: { label: "TSA選定・移行計画 (Trust Center §4)", href: "/trust-center#s4" },
    lastReviewed: "2026-05-12",
  },
  {
    title: "データ永続化とアクセス制御（Supabase RLS）",
    status: "verified",
    summary:
      "証明レコードはPostgreSQL（Supabase）上でRow-Level Securityにより、所有ユーザーのみ読込可能。UPDATE/DELETEポリシーは存在せず、レコードは実質追記専用として扱います。通信は全てTLS 1.2以上で暗号化されます。",
    evidence: { label: "スキーマ & RLSポリシー (Trust Center §5)", href: "/trust-center#s5" },
    lastReviewed: "2026-05-12",
  },
  {
    title: "独立検証スクリプトと脅威モデルの公開",
    status: "verified",
    summary:
      "Python / OpenSSLベースの検証スクリプトと、攻撃者モデル・防御設計を全文公開しています。第三者監査に頼らず、コードとプロトコルで検証できる状態を維持することが、現状の一次的な信頼根拠です。",
    evidence: { label: "検証ガイド (Trust Center §7) / GitHub", href: "https://github.com/proofmark-jp/verify" },
    lastReviewed: "2026-05-12",
  },
  {
    title: "第三者によるセキュリティ監査（外部ペネトレーション）",
    status: "planned",
    summary:
      "有料プラン正式リリースと並行し、独立した第三者監査機関による外部ペネトレーションテストを実施予定です。現時点では未実施のため「実施済」と表示することはしません。実施後は監査主体・対象範囲・エグゼクティブサマリを本ページおよび Trust Center に掲載します。",
    eta: "2026 Q3",
  },
  {
    title: "SOC 2 / ISO 27001などの認証取得",
    status: "planned",
    summary:
      "Studio / Business プランの提供に合わせ、SOC 2 Type I からの取得を計画しています。現時点では未取得であり、取得済であると誤認されうる表現（例：「業界標準の監査に準拠」など）は意図的に使用していません。",
    eta: "2026 Q4 以降",
  },
  {
    title: "インシデント対応・公開ステータスページ",
    status: "ongoing",
    summary:
      "重大インシデント（可用性・機密性・完全性に影響する事象）は、原則として検知後72時間以内に本ページおよびTrust Centerで開示します。過去のインシデント履歴は下記から確認できます。",
    evidence: { label: "インシデント履歴 & ステータス", href: "/trust-center/incidents" },
    lastReviewed: "2026-05-12",
  },
];

const STATUS_META: Record<AssuranceStatus, { label: string; color: string; bg: string; border: string }> = {
  verified: { label: "実施済・公開", color: "#00D4AA", bg: "rgba(0,212,170,0.10)", border: "rgba(0,212,170,0.35)" },
  ongoing:  { label: "運用中",       color: "#6C3EF4", bg: "rgba(108,62,244,0.10)", border: "rgba(108,62,244,0.35)" },
  planned:  { label: "計画中・未実施", color: "#F0BB38", bg: "rgba(240,187,56,0.10)", border: "rgba(240,187,56,0.35)" },
};

export default function Security() {
  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] pt-32 pb-24 px-6 md:px-12">
      <SEO 
        title="セキュリティと安全性 | ProofMark"
        description="ProofMarkのセキュリティ体制。各項目は実際に運用されている構成に対応し、未実施の対策を実施済と記載しません。ブラウザ内ハッシュ計算、RFC3161タイムスタンプ、RLSによるアクセス制御など、検証可能な根拠を公開しています。"
        url="https://proofmark.jp/security"
      />
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-xs font-bold tracking-widest uppercase mb-6">
            <Lock className="w-4 h-4" /> Security
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight mb-8">
            ProofMarkの堅牢なセキュリティ
          </h1>
          <p className="text-[#A8A0D8] text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            このページに記載する各項目は、<strong>実際に運用されている構成・設定・公開証跡に1対1で対応</strong>します。未実施の対策を「実施済」と記載することはしません。実装根拠は Trust Center（技術ホワイトペーパー）、または公開リポジトリで確認できます。
          </p>
          <p className="text-xs text-[#A8A0D8]/70 mt-4">最終更新: 2026-05-12 / 本ページの更新履歴は <Link href="/trust-center#s9" className="underline hover:text-[#00D4AA]">Trust Center §9</Link> を参照してください。</p>
        </header>

        {/* --- Honest assurance table: every row is verifiable, or explicitly labelled as planned. --- */}
        <section aria-label="ProofMark assurances" className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ASSURANCES.map((item) => {
              const meta = STATUS_META[item.status];
              return (
                <article
                  key={item.title}
                  className="p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] transition-all duration-500"
                  style={{ boxShadow: `inset 0 0 0 1px ${meta.border}` }}
                >
                  <header className="flex items-start justify-between gap-4 mb-5">
                    <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                      {item.title}
                    </h3>
                    <span
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-widest uppercase whitespace-nowrap"
                      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                    >
                      {item.status === "verified" && <FileCheck2 className="w-3.5 h-3.5" />}
                      {item.status === "planned" && <AlertTriangle className="w-3.5 h-3.5" />}
                      {item.status === "ongoing" && <Shield className="w-3.5 h-3.5" />}
                      {meta.label}
                    </span>
                  </header>

                  <p className="text-[#D4D0F4] leading-relaxed text-sm md:text-base mb-5 break-words">
                    {item.summary}
                  </p>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#A8A0D8] border-t border-white/5 pt-4">
                    {item.lastReviewed && (
                      <>
                        <dt className="uppercase tracking-widest text-[10px] text-[#A8A0D8]/70">最終確認</dt>
                        <dd className="font-mono text-white">{item.lastReviewed}</dd>
                      </>
                    )}
                    {item.eta && (
                      <>
                        <dt className="uppercase tracking-widest text-[10px] text-[#A8A0D8]/70">実施目標</dt>
                        <dd className="font-mono text-white">{item.eta}</dd>
                      </>
                    )}
                    {item.evidence && (
                      <>
                        <dt className="uppercase tracking-widest text-[10px] text-[#A8A0D8]/70">公開証跡</dt>
                        <dd className="break-all">
                          <a
                            href={item.evidence.href}
                            target={item.evidence.href.startsWith("http") ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#00D4AA] hover:underline"
                          >
                            {item.evidence.label}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </dd>
                      </>
                    )}
                  </dl>
                </article>
              );
            })}
          </div>

          {/* --- Honest negative disclosures: what we do NOT yet have. --- */}
          <aside className="mt-10 p-6 rounded-2xl border border-[#F0BB38]/30 bg-[#F0BB38]/5">
            <h4 className="flex items-center gap-2 text-[#F0BB38] font-bold mb-2">
              <AlertTriangle className="w-4 h-4" /> 現時点で「未実施」のもの（誤認防止のため明示）
            </h4>
            <ul className="text-sm text-[#E8D4A0] leading-relaxed space-y-1">
              <li>・独立した第三者による外部ペネトレーションテストおよびコード監査は未実施です（2026 Q3に計画中）。</li>
              <li>・SOC 2 / ISO 27001 等の認証は取得していません（Studio / Business プラン開始前に取得計画）。</li>
              <li>・ベータ版TSA（FreeTSA.org）は正式なSLAを提供せず、ルート証明書は主要OS・ブラウザのトラストストアに収録されていません。商用TSAへの移行計画は Trust Center §4 で公開しています。</li>
              <li>・TSA側のHSM運用はTSA提供元に帰属します。ProofMarkはHSMを自社運用しません。</li>
            </ul>
          </aside>
        </section>

        <div className="mt-20 text-center animate-in fade-in duration-1000">
          <Link href="/" className="inline-flex items-center text-[#6C3EF4] font-bold hover:text-[#00D4AA] transition-colors gap-2">
            ← トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
