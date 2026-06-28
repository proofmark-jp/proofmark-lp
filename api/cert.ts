import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  // The Infinite Cache Shield: Error Negative Cache
  if (!id || typeof id !== 'string') {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    return res.status(400).json({ error: 'Missing or invalid ID' });
  }

  try {
    // The Privacy Lock: Strictly enforcing visibility = 'public' at the query level
    const { data, error } = await supabase
      .from('certificates')
      .select('id, title, public_image_url, public_verify_token, certified_at, proof_frame_urls')
      .eq('id', id)
      .eq('visibility', 'public')
      .single();

    if (error || !data) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
      return res.status(404).json({ error: 'Certificate not found or is private' });
    }

    // The Schema Integrity: Ensure proof_frame_urls is strictly parsed into an array of strings
    let proofFrames: string[] = [];
    if (Array.isArray(data.proof_frame_urls)) {
        proofFrames = data.proof_frame_urls.filter(url => typeof url === 'string');
    } else if (typeof data.proof_frame_urls === 'string') {
        try {
            const parsed = JSON.parse(data.proof_frame_urls);
            if (Array.isArray(parsed)) {
                proofFrames = parsed.filter(url => typeof url === 'string');
            }
        } catch (e) {
            // Silence parse errors, fallback to empty array
        }
    }

    // The Schema Integrity: Mapping exact requested schema
    const payload = {
      id: data.id,
      title: data.title || null,
      public_image_url: data.public_image_url || null,
      public_verify_token: data.public_verify_token || null,
      certified_at: data.certified_at || null,
      proof_frame_urls: proofFrames
    };

    // The Infinite Cache Shield: Success Cache
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=31536000');
    return res.status(200).json(payload);
    
  } catch (error) {
    console.error('[API Cert] Internal Error:', error);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}