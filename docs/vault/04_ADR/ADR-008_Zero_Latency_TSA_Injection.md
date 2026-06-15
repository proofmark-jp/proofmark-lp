# ADR-008: The Zero-Latency Backbone (TSA Certificate In-Memory Injection)

## 1. Context & Executive Summary (背景と目的)
ProofMarkは、Vercel Serverless Functionsを用いた限界費用ゼロのSaaSインフラを構築している。
現在、`api/generate-evidence-pack.ts` において、ZIPファイル（Evidence Pack）に同梱するFreeTSAの証明書（CA/TSA）を、APIリクエストの都度 `fetchTsaCa()` にて外部ネットワークから取得している。

**【致命的課題（The Fatal Flaw）】**
* **Vercel Cold Start Penalty:** Serverless環境のコールドスタート時に、外部ネットワークへのFetchが走ることで、最大3秒以上のレイテンシ（遅延）が発生している。
* **Availability Risk:** 外部サーバー（freetsa.org）のダウンや遅延が、ProofMarkのコア機能（パッケージ生成）の失敗（500エラー）に直結する「密結合（Tight Coupling）」状態にある。

**【アーキテクチャの決定（Decision）】**
外部ネットワークへのFetchを完全に破棄し、**「静的ファイルのインメモリ・キャッシュ化（In-Memory Injection）」**へとアーキテクチャを移行する。これにより、レイテンシを物理的にゼロ（0ms）にし、インフラの堅牢性をカンストさせる。

---

## 2. Implementation Constraints (AIへの絶対遵守事項)

あなたは世界トップクラスのSaaSアーキテクト（Claude Sonnet / Opus）として、以下の制約を1ミリも破らずに実装を完遂せよ。

1. **Zero Network Egress:** `generate-evidence-pack.ts` 内から `fetch()` による外部通信ロジックを完全に切除せよ。
2. **Vercel Memory Optimization:** `fs.readFileSync` による証明書ファイルの読み込みおよびBase64化は、必ず**「リクエストハンドラ（`export default async function handler`）の外側（グローバルスコープ）」**で実行せよ。これにより、VercelコンテナのHot状態におけるメモリ常駐（再利用）を強制し、I/O負荷をゼロにする。
3. **Non-Destructive Integration:** 既存の Auth Flow / Spot Flow の分岐ロジック、エラーハンドリング、および `EvidencePackPayload` のJSON構造は一切破壊してはならない。
4. **Vercel Build Compatibility:** `fs.readFileSync` で読み込むファイルパスは、Vercel本番環境でのコンテナ配置（Serverless Functionのパス解決）で絶対にENOENT（ファイルが見つからない）エラーを起こさない堅牢な `path.join(process.cwd(), ...)` または `__dirname` の解決策を用いよ。必要であれば `vercel.json` の `includeFiles` の更新も視野に入れよ。
5. **Certificate Rot Defense (証明書失効の監視):**
   インメモリ化された証明書（`FREETSA_TSA_BASE64`等）が将来失効し、サイレントに検証エラーが多発する「Certificate Rot」を防ぐため、安全網を構築せよ。
   具体的には、`crypto` モジュール（または既存の `asn1js`/`pkijs`）を用いて、読み込んだ証明書の有効期限（`notAfter`）をパースし、現在時刻と比較するロジックをリクエストハンドラ内に軽量に実装せよ。
   * **監視ルール:** 有効期限の「30日前」を切った場合、処理は継続（ZIP生成は止めない）しつつ、バックグラウンドで `makeLogger` を用いて `CRITICAL: FreeTSA Certificate expires in less than 30 days` というエラーログ（Sentry/Discord通知用）を吐き出せ。これにより、ファウンダーが事前に手動で証明書ファイルを更新できるフェイルセーフを確立する。
---

## 3. Surgical Execution Steps (実行手順)

以下のステップに沿って実装を完了させよ。

### Step 1: 物理ファイルの配置 (The Asset Vault)
1. プロジェクトルート（または `api/` 配下の安全な階層）に `certs/` ディレクトリを新設せよ。
2. 以下の2つの証明書ファイルを `certs/` 内に静的アセットとして配置せよ（※中身のテキストは、現在の `fetch` 先である `https://freetsa.org/files/cacert.pem` と `tsa.crt` の内容を事前にダウンロードして保存すること）。
   * `freetsa-ca.crt`
   * `freetsa-tsa.crt`

### Step 2: `api/generate-evidence-pack.ts` の外科手術
1. 不要となった `fetchTsaCa` 関数、および関連するキャッシュ変数（`tsaCaCache`, `tsaCaInflight`, 定数 `TSA_CA_FETCH_TIMEOUT_MS`, `TSA_CA_TTL_MS`）を完全に削除（Purge）せよ。
2. ファイル上部（グローバルスコープ）にて、Step 1で配置した2つのファイルを読み込み、Base64文字列として定数化せよ。
   ```typescript
   // Example (Implement with robust path resolution):
   const FREETSA_CA_BASE64 = fs.readFileSync(path.resolve(...)).toString('base64');
   const FREETSA_TSA_BASE64 = fs.readFileSync(path.resolve(...)).toString('base64');
Auth Flow および Spot Flow 内で、ペイロード配列（files.push）に証明書をプッシュしている箇所を、上記で定義したインメモリ定数を直接参照するように書き換えよ。

※ 失敗時のフォールバック（freetsa.README.txt の発行ロジック）は不要となるため削除し、無条件で証明書を同梱するコードへ純化させよ。

Step 3: Vercel Container Check
vercel.json を確認し、Step 1で作成した certs/ ディレクトリが Serverless Functions のバンドルに含まれるよう includeFiles（またはVite/Vercelのビルド設定）が適切に構成されているか確認し、必要なら修正せよ。

[END OF SPECIFICATION]
AI Agent: Read this document, confirm understanding of the Zero-Latency constraints, and immediately output the required code diffs.