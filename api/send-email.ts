/**
 * Vercel Serverless Function: Send Email via Resend
 * 
 * Endpoint: /api/send-email
 * Method: POST
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "type": "confirmation" | "waitlist"
 * }
 * 
 * Environment variables required:
 * - RESEND_API_KEY: Your Resend API key
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = "noreply@proofmark.jp";

interface SendEmailRequest {
  email: string;
  type?: "confirmation" | "waitlist";
}

interface SendEmailResponse {
  success: boolean;
  message: string;
  error?: string;
  messageId?: string;
}

/**
 * Validate email format
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate confirmation email HTML
 */
function generateConfirmationEmailHTML(email: string): string {
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ProofMark 先行登録確認</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          line-height: 1.6;
          color: #f0f0fa;
          background-color: #0a0e27;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #151d2f;
          border-radius: 12px;
          border: 1px solid #2a2a4e;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #2a2a4e;
        }
        .logo {
          font-size: 32px;
          font-weight: 900;
          color: #6c3ef4;
          margin-bottom: 10px;
        }
        .content {
          margin-bottom: 30px;
        }
        .content h1 {
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 15px;
          color: #f0f0fa;
        }
        .content p {
          margin-bottom: 15px;
          color: #a0a0c0;
        }
        .benefits {
          background-color: #0f1629;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #6c3ef4;
        }
        .benefits h3 {
          color: #6c3ef4;
          margin-top: 0;
          font-size: 16px;
        }
        .benefits ul {
          list-style: none;
          padding: 0;
          margin: 10px 0 0 0;
        }
        .benefits li {
          padding: 8px 0;
          color: #a0a0c0;
          font-size: 14px;
        }
        .benefits li:before {
          content: "✓ ";
          color: #00d4aa;
          font-weight: bold;
          margin-right: 8px;
        }
        .cta-button {
          display: inline-block;
          background-color: #6c3ef4;
          color: #f0f0fa;
          padding: 14px 32px;
          border-radius: 24px;
          text-decoration: none;
          font-weight: bold;
          margin: 20px 0;
          text-align: center;
        }
        .footer {
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid #2a2a4e;
          font-size: 12px;
          color: #6b7280;
        }
        .footer a {
          color: #6c3ef4;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">⬡ ProofMark</div>
          <p style="margin: 0; color: #a0a0c0; font-size: 14px;">AI作品の著作権証明サービス</p>
        </div>

        <div class="content">
          <h1>先行登録ありがとうございます！</h1>
          <p>
            ${email} でProofMarkの先行登録が完了しました。<br>
            β版の優先招待をお待ちください。
          </p>

          <div class="benefits">
            <h3>先着100名の特典</h3>
            <ul>
              <li>β版優先招待</li>
              <li>Standardプラン3ヶ月無料</li>
              <li>創設者バッジ</li>
            </ul>
          </div>

          <p>
            「どうせAIでしょ？」と言わせない。<br>
            あなたの創作の「事実」を、一生消えない証拠に。
          </p>

          <p style="text-align: center;">
            <a href="https://proofmark.jp" class="cta-button">ProofMarkを見る</a>
          </p>
        </div>

        <div class="footer">
          <p>
            このメールに心当たりがない場合は、<a href="https://proofmark.jp">お問い合わせ</a>ください。<br>
            © 2026 ProofMark. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Main handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse<SendEmailResponse>
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
      error: "Only POST requests are supported",
    });
  }

  try {
    // Parse request body
    const { email, type = "confirmation" } = req.body as SendEmailRequest;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        error: "Please provide an email address",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
        error: "Please enter a valid email address",
      });
    }

    // Check if Resend API key is configured
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return res.status(500).json({
        success: false,
        message: "Email service is not configured",
        error: "Please contact support",
      });
    }

    // Prepare email subject and HTML based on type
    const subject =
      type === "waitlist"
        ? "ProofMark ウェイティングリスト登録確認"
        : "ProofMark 先行登録確認 - β版優先招待";

    const html = generateConfirmationEmailHTML(email);

    // Send email via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: email,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Resend API error:", error);
      return res.status(response.status).json({
        success: false,
        message: "Failed to send email",
        error: error.message || "Unknown error from Resend API",
      });
    }

    const data = await response.json();

    // Success response
    return res.status(200).json({
      success: true,
      message: `Confirmation email sent to ${email}`,
      messageId: data.id,
    });
  } catch (error) {
    console.error("Email sending error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
