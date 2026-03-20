/**
 * Email Service
 * 
 * Handles email sending via Vercel Serverless Function (/api/send-email).
 * The function calls Resend API on the server side.
 * 
 * When deploying to Vercel:
 * 1. Add RESEND_API_KEY to Vercel environment variables
 * 2. The /api/send-email endpoint will automatically be available
 * 3. Test with real email addresses
 */

interface EmailResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Send confirmation email to user
 * @param email - User's email address
 * @returns Response with success status
 */
export async function sendConfirmationEmail(email: string): Promise<EmailResponse> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: "Invalid email format",
        error: "Please enter a valid email address",
      };
    }

    // Call Vercel Serverless Function
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        type: "confirmation",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Email API error:", error);
      return {
        success: false,
        message: "Failed to send email",
        error: error.error || error.message || "Unknown error",
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: `Confirmation email sent to ${email}`,
    };
  } catch (error) {
    console.error("Email sending error:", error);
    return {
      success: false,
      message: "Failed to send email",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send waitlist email
 * @param email - User's email address
 * @returns Response with success status
 */
export async function sendWaitlistEmail(email: string): Promise<EmailResponse> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: "Invalid email format",
        error: "Please enter a valid email address",
      };
    }

    // Call Vercel Serverless Function
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        type: "waitlist",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Email API error:", error);
      return {
        success: false,
        message: "Failed to send email",
        error: error.error || error.message || "Unknown error",
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: `Waitlist email sent to ${email}`,
    };
  } catch (error) {
    console.error("Email sending error:", error);
    return {
      success: false,
      message: "Failed to send email",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate HTML for confirmation email
 * @param email - User's email address
 * @returns HTML string for email body
 * 
 * Note: This function is kept for reference.
 * The actual email HTML is generated in /api/send-email.ts
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
