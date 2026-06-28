import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// 1. Utility: UUID Validation
function isValidUUID(uuid: string): boolean {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
}

// 2. Utility: XSS Prevention
function escapeHtml(unsafe: string | null | undefined): string {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 3. Supabase Client Initialization (Service Role & RLS Bypass)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
});

// 4. HTML Template for Error/404
function getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ProofMark - Error</title>
    <style>
        body {
            margin: 0;
            padding: 8px;
            box-sizing: border-box;
            height: 100vh;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: transparent;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .error-card {
            background-color: #0A0716;
            border: 1px solid rgba(108, 62, 244, 0.3);
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            max-width: 100%;
            width: 100%;
            box-sizing: border-box;
        }
        .error-title {
            color: #6C3EF4;
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .error-message {
            font-size: 0.9rem;
            color: #a0a0a0;
        }
    </style>
</head>
<body>
    <div class="error-card">
        <div class="error-title">Certificate Not Found</div>
        <div class="error-message">${escapeHtml(message)}</div>
    </div>
</body>
</html>`;
}

// 5. HTML Template for Valid Certificate
function getCertificateHtml(cert: any): string {
    const safeId       = escapeHtml(cert.id);
    const safeTitle    = escapeHtml(cert.title);
    const safeUsername = escapeHtml(cert.profiles?.username || 'unknown');
    const safeImageUrl = escapeHtml(cert.public_image_url);
    const fallbackImage = 'https://proofmark.jp/og-image.png';
    const finalImageUrl = safeImageUrl || fallbackImage;
    const certUrl = `https://proofmark.jp/cert/${safeId}`;

    return `<!DOCTYPE html>
<html lang="ja" style="overflow:hidden;scrollbar-width:none;-ms-overflow-style:none;">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>ProofMark Verified: ${safeTitle}</title>
    <style>
        html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;}
        .card:hover{box-shadow:0 0 15px rgba(0,255,178,.15),0 0 30px rgba(108,62,244,.2)!important;border-color:rgba(108,62,244,.7)!important;}
        .seo-link:hover{text-decoration:underline!important;}
        .badge-dot::after{content:'';position:absolute;top:3px;left:4px;width:3px;height:5px;border:solid #050308;border-width:0 1.5px 1.5px 0;transform:rotate(45deg);}
    </style>
</head>
<body style="margin:0;padding:8px;box-sizing:border-box;height:100vh;font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:transparent;overflow:hidden;scrollbar-width:none;-ms-overflow-style:none;">
    <div class="card" style="background:#050308;border:1px solid rgba(108,62,244,.3);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;height:100%;box-sizing:border-box;transition:box-shadow .3s ease,border-color .3s ease;position:relative;">
        <a href="${certUrl}" target="_blank" rel="noopener noreferrer" style="position:absolute;inset:0;z-index:1;" aria-label="View ProofMark Certificate: ${safeTitle}"></a>
        <div style="width:100%;flex:1;position:relative;background:#000;overflow:hidden;min-height:0;">
            <img src="${finalImageUrl}" alt="${safeTitle}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" />
            <div style="position:absolute;bottom:0;left:0;right:0;height:40%;background:linear-gradient(to top,#050308 0%,transparent 100%);pointer-events:none;"></div>
        </div>
        <div style="padding:12px 16px 16px;background:#050308;display:flex;flex-direction:column;gap:8px;position:relative;z-index:2;flex-shrink:0;">
            <a href="${certUrl}" target="_blank" rel="noopener noreferrer" class="seo-link" style="color:#fff;font-size:1rem;font-weight:600;margin:0;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;text-decoration:none;">ProofMark Verified: ${safeTitle}</a>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                <span style="color:#a0a0a0;font-size:.85rem;font-weight:500;">@${safeUsername}</span>
                <div style="display:flex;align-items:center;gap:6px;background:rgba(0,255,178,.05);border:1px solid rgba(0,255,178,.25);padding:4px 10px;border-radius:20px;font-size:.75rem;font-weight:600;color:#00FFB2;text-transform:uppercase;letter-spacing:.5px;box-shadow:0 0 10px rgba(0,255,178,.1);">
                    <div class="badge-dot" style="width:12px;height:12px;background:#00FFB2;border-radius:50%;box-shadow:0 0 8px #00FFB2;position:relative;flex-shrink:0;"></div>
                    Verified by ProofMark
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// 6. Main Request Handler (Serverless Function)
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    // 1. UUID Strict Validation
    if (!id || typeof id !== 'string' || !isValidUUID(id)) {
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60'); // Negative cache shield
        return res.status(400).send(getErrorHtml('Invalid Certificate ID format.'));
    }

    try {
        // 2. Query Supabase (Service Role + Public Visibility Filter)
        const { data, error } = await supabase
            .from('certificates')
            .select('id, title, public_verify_token, public_image_url, certified_at, profiles!inner(username, display_name)')
            .eq('id', id)
            .eq('visibility', 'public')
            .single();

        if (error || !data) {
            res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60'); // Negative cache shield
            return res.status(404).send(getErrorHtml('Certificate Not Found or is strictly private.'));
        }

        // 3. The Infinite Cache Shield (CDN Defense)
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400');
        res.setHeader('Vercel-CDN-Cache-Control', 'max-age=31536000');

        // 4. Render Pure HTML SSR (No React)
        return res.status(200).send(getCertificateHtml(data));

    } catch (err) {
        console.error('[Embed SSR Error]', err);
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60'); // Negative cache shield
        return res.status(500).send(getErrorHtml('Internal Server Error while rendering embed.'));
    }
}
