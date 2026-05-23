import re

with open('client/src/pages/Home.tsx', 'r') as f:
    content = f.read()

# Add import for HeroCertificateShowcase
content = content.replace(
    "import HeroDemo from '../components/HeroDemo';",
    "import HeroDemo from '../components/HeroDemo';\nimport HeroCertificateShowcase from '@/components/HeroCertificateShowcase';"
)

# 1. Update Hero section CTAs
hero_cta_old = """                <Link href="/spot-issue">
                  <span className="pm-cta-primary">
                    今すぐ1件だけ試す（登録不要）
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
                <Link href="/auth?mode=signup">
                  <span className="pm-cta-ghost">
                    無料でアカウントを作成する
                  </span>
                </Link>"""
hero_cta_new = """                <Link href="/spot-issue">
                  <span className="pm-cta-primary">
                    1件だけ試す（登録不要・¥480）
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
                <Link href="/auth?mode=signup">
                  <span className="pm-cta-ghost">
                    無料アカウントを作成する
                  </span>
                </Link>"""
content = content.replace(hero_cta_old, hero_cta_new)

# 2. Update Hero right column
hero_right_old = """            {/* 右 45% — 静的モックアップ（視線をコピーとCTAに集中させる） */}
            <motion.div {...fadeInProps(0.10)} className="w-full perspective-1000">
              <div
                className="relative overflow-hidden rounded-[24px] border border-white/10 shadow-[0_20px_80px_-20px_rgba(108,62,244,0.4)]"
                style={{ transform: 'rotateY(-5deg) rotateX(2deg)' }}
              >
                <img
                  src="/fantasy_artwork_final.jpg"
                  alt="ProofMark Showcase"
                  className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity"
                />
              </div>
            </motion.div>"""
hero_right_new = """            {/* 右 45% — HeroCertificateShowcase */}
            <div className="w-full">
              <HeroCertificateShowcase />
            </div>"""
content = content.replace(hero_right_old, hero_right_new)

# Extract sections
def extract_section(start_marker, end_marker=None):
    if end_marker:
        pattern = re.compile(f'({start_marker}.*?{end_marker})', re.DOTALL)
    else:
        pattern = re.compile(f'({start_marker}.*?</section>)', re.DOTALL)
    match = pattern.search(content)
    if not match:
        print(f"Could not find section: {start_marker}")
    return match.group(1) if match else ""

hero_sec = extract_section(r'\{/\* \[S1\] Hero — 即座の確信・期待 \*/\}')
problem_sec = extract_section(r'\{/\* \[S2\] Problem — 共感と危機感 \*/\}')
solution_sec = extract_section(r'\{/\* \[S3\] Solution — 安堵と理解 \*/\}')
herodemo_sec = extract_section(r'\{/\* \[S3\] 自動再生デモ（ProofMarkの凄さを視覚的に理解させる） \*/\}')
tech_sec = extract_section(r'\{/\* \[S4\] Technology — 確信・信頼 \*/\}')
usecase_sec = extract_section(r'\{/\* \[S5\] Use Cases — 自分ごと化 \*/\}')
pricing_sec = extract_section(r'\{/\* \[S6\] Pricing — 決断・低ハードル \*/\}')
final_sec = extract_section(r'\{/\* \[S7\] Final CTA — 最終行動 \*/\}')

# Replace Final CTA links
final_cta_old = """            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Link href="/auth?mode=signup">
                <span
                  className="inline-flex h-[56px] items-center justify-center gap-2 rounded-full px-8 text-[15px] font-bold tracking-tight"
                  style={{
                    background: '#FFFFFF',
                    color: '#6C3EF4',
                    boxShadow: '0 18px 40px -16px rgba(255,255,255,0.45)',
                  }}
                >
                  無料で証明書を発行する
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
              <Link href="/spot-issue">
                <span className="pm-cta-ghost">
                  登録せずに 1 件だけ
                </span>
              </Link>
            </div>"""
final_cta_new = """            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Link href="/spot-issue">
                <span
                  className="inline-flex h-[56px] items-center justify-center gap-2 rounded-full px-8 text-[15px] font-bold tracking-tight"
                  style={{
                    background: '#FFFFFF',
                    color: '#6C3EF4',
                    boxShadow: '0 18px 40px -16px rgba(255,255,255,0.45)',
                  }}
                >
                  1件だけ試す（登録不要・¥480）
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
              <Link href="/auth?mode=signup">
                <span className="pm-cta-ghost">
                  無料アカウントを作成する
                </span>
              </Link>
            </div>"""
final_sec = final_sec.replace(final_cta_old, final_cta_new)

# Build new inline hash demo
inline_demo_sec = """      {/* [S3.5] インラインハッシュデモ */}
      <section id="try" aria-labelledby="demo-title" className="pm-section" style={{ background: '#07061A' }}>
        <div className="pm-container">
          <motion.div className="mb-12 text-center" {...fadeInProps()}>
            <Eyebrow>TRY IT NOW</Eyebrow>
            <h2 id="demo-title" className="pm-h2 mt-4">
              あなたのファイルで、
              <br className="hidden md:inline" />
              <span className="pm-accent-text">証明書をプレビューする。</span>
            </h2>
            <p className="pm-body mx-auto mt-5 max-w-xl">
              ブラウザ内で SHA-256 を計算します。原本はサーバーに一切送信されません。
              ここで動作を確認して、気に入ったら正式発行（¥480）へ。
            </p>
          </motion.div>
          <Suspense fallback={<LoadingFallback variant="inline" />}>
            <InlineHashDemo />
          </Suspense>
        </div>
      </section>"""

# New isolated sections
trust_sec = """      {/* トラスト・コンポーネント（安全な復元） */}
      <section className="pm-section">
        <div className="pm-container">
          <TrustSignalRow />
        </div>
      </section>"""

evidence_sec = """      {/* Evidence Pack Teaser */}
      <section className="pm-section">
        <div className="pm-container">
          <EvidencePackTeaser />
        </div>
      </section>"""

c2pa_sec = """      {/* C2PA Comparison */}
      <section className="pm-section">
        <div className="pm-container">
          <C2paComparisonRow />
        </div>
      </section>"""

# Assemble new body
new_body = "\n\n".join([
    hero_sec,
    trust_sec,
    problem_sec,
    inline_demo_sec,
    solution_sec,
    herodemo_sec,
    tech_sec,
    evidence_sec,
    c2pa_sec,
    usecase_sec,
    pricing_sec,
    final_sec
])

# Replace the old layout in the file
start_idx = content.find('{/* [S1] Hero — 即座の確信・期待 */}')
end_idx = content.find('    </div>\n  );\n}\n\n/* ───────────────────────────────────────────────────────────────────')

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_body + "\n" + content[end_idx:]
else:
    print("Could not find body boundaries")

with open('client/src/pages/Home.tsx', 'w') as f:
    f.write(content)
print("Done rewriting Home.tsx")
