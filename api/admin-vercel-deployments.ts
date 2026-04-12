import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as Sentry from "@sentry/node";
import { supabaseAdmin } from "./lib/supabase-admin";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 1.0,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Unauthorized: Token missing" });
        }
        const token = authHeader.replace('Bearer ', '');

        const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
        if (verifyError || !user || user.user_metadata?.plan_type !== 'admin') {
            return res.status(403).json({ error: "Forbidden: Admin access required" });
        }

        const vercelToken = process.env.VERCEL_ACCESS_TOKEN;
        const vercelProjectId = process.env.VERCEL_PROJECT_ID;

        if (!vercelToken || !vercelProjectId) {
            throw new Error("Server configuration error: Missing Vercel credentials.");
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=5`, {
            headers: {
                "Authorization": `Bearer ${vercelToken}`
            },
            signal: controller.signal
        });
        
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Vercel API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        const deployments = data.deployments?.map((dep: any) => ({
            uid: dep.uid,
            url: dep.url,
            state: dep.state,
            created: dep.created
        })) || [];

        return res.status(200).json({ deployments });

    } catch (err: any) {
        console.error("[Admin API] Failed to fetch deployments:", err);
        Sentry.captureException(err);
        await Sentry.flush(2000);
        return res.status(err.name === 'AbortError' ? 504 : 500).json({ error: err.message });
    }
}
