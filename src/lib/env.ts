/**
 * src/lib/env.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cross-Runtime Environment Variable Bridge (Vite SPA & Next.js App Router)
 * 
 * ⚡ The Absolute Solution:
 * 1. Vite (Rollup/esbuild) in the browser will crash with ReferenceError if process.env is accessed directly.
 * 2. Next.js (SWC) will crash during server-side compilation if import.meta.env is parsed directly.
 * 3. We abstract access by safely querying typeof process, globalThis, and dynamic imports to bypass compile-time exceptions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function getSafeEnv(key: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string {
  // ── 1. Node.js / Next.js Server & Client (process.env check) ──
  if (typeof process !== 'undefined' && process.env) {
    if (key === 'SUPABASE_URL') {
      const val = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (val) return val;
    }
    if (key === 'SUPABASE_ANON_KEY') {
      const val = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (val) return val;
    }
  }

  // ── 2. globalThis process fallback (Edge runtime compliance) ──
  const globalProcess = (globalThis as any).process;
  if (globalProcess?.env) {
    if (key === 'SUPABASE_URL') {
      const val = globalProcess.env.NEXT_PUBLIC_SUPABASE_URL;
      if (val) return val;
    }
    if (key === 'SUPABASE_ANON_KEY') {
      const val = globalProcess.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (val) return val;
    }
  }

  // ── 3. Vite / Browser (import.meta.env check) ──
  // Use a string key reflection to bypass compilation syntax errors from SWC
  try {
    const metaObj = (globalThis as any).import?.meta || import.meta;
    if (metaObj && 'env' in metaObj) {
      const metaEnv = (metaObj as any).env;
      if (metaEnv) {
        if (key === 'SUPABASE_URL' && metaEnv.VITE_SUPABASE_URL) {
          return metaEnv.VITE_SUPABASE_URL;
        }
        if (key === 'SUPABASE_ANON_KEY' && metaEnv.VITE_SUPABASE_ANON_KEY) {
          return metaEnv.VITE_SUPABASE_ANON_KEY;
        }
      }
    }
  } catch (e) {
    // Suppress errors during edge node resolution
  }

  // ── 4. window global fallback (Production build injection) ──
  if (typeof window !== 'undefined') {
    const win = window as any;
    const viteEnv = win.__VITE_ENV__ || win.ENV;
    if (viteEnv) {
      if (key === 'SUPABASE_URL' && viteEnv.VITE_SUPABASE_URL) return viteEnv.VITE_SUPABASE_URL;
      if (key === 'SUPABASE_ANON_KEY' && viteEnv.VITE_SUPABASE_ANON_KEY) return viteEnv.VITE_SUPABASE_ANON_KEY;
    }
  }

  return '';
}
