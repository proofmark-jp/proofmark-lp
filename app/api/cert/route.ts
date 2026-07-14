import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  const getHeaders = (cacheControl: string) => {
    return {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
    };
  };

  if (!id) {
    return NextResponse.json(
      { error: 'Missing or invalid ID' },
      { 
        status: 400, 
        headers: getHeaders('public, max-age=0, s-maxage=60') 
      }
    );
  }

  try {
    const { data, error } = await supabase
      .from('certificates')
      .select('id, title, public_image_url, public_verify_token, certified_at, proof_frame_urls')
      .eq('id', id)
      .eq('visibility', 'public')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Certificate not found or is private' },
        { 
          status: 404, 
          headers: getHeaders('public, max-age=0, s-maxage=60') 
        }
      );
    }

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
            // Silence parse errors
        }
    }

    const payload = {
      id: data.id,
      title: data.title || null,
      public_image_url: data.public_image_url || null,
      public_verify_token: data.public_verify_token || null,
      certified_at: data.certified_at || null,
      proof_frame_urls: proofFrames
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: getHeaders('public, max-age=60, s-maxage=60, stale-while-revalidate=31536000')
    });
    
  } catch (error) {
    console.error('[API Cert] Internal Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { 
        status: 500, 
        headers: getHeaders('public, max-age=0, s-maxage=60') 
      }
    );
  }
}
