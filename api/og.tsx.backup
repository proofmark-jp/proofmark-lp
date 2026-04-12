import { ImageResponse } from '@vercel/og';
import React from 'react';

export const config = {
  runtime: 'edge', // This ensures it runs on Vercel's Edge Runtime
};

export default async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Extract query parameters
    const title = searchParams.get('title') || 'Digital Certificate';
    const thumb = searchParams.get('thumb');
    const hash = searchParams.get('hash') || '000000000000';
    const timestamp = searchParams.get('timestamp') || 'N/A';
    const creator = searchParams.get('creator') || 'Anonymous';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            backgroundColor: '#07061A',
            fontFamily: 'sans-serif',
          }}
        >
          {/* 1. Background Image */}
          {thumb ? (
            <img
              src={thumb}
              alt="Thumbnail"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#1C1A38',
              }}
            />
          )}

          {/* 2. Gradient Overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: 'linear-gradient(to bottom, rgba(13, 11, 36, 0) 0%, rgba(13, 11, 36, 0.4) 40%, rgba(13, 11, 36, 0.95) 80%, rgba(13, 11, 36, 1) 100%)',
            }}
          />

          {/* Foreground content wrapper */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              width: '100%',
              padding: '60px',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            {/* 3. Header (Top Left) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '36px',
                fontWeight: 900,
                color: '#F0EFF8',
              }}
            >
              <img
                src="https://proofmark.jp/apple-touch-icon.png"
                width={48}
                height={48}
                style={{ borderRadius: '12px' }}
                alt="ProofMark Logo"
              />
              <div style={{ display: 'flex' }}>
                Proof<span style={{ color: '#00D4AA' }}>Mark</span>
              </div>
            </div>

            {/* Bottom Section: Title & Creator + Evidence Chain */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              {/* 4. Title & Creator */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: '64px',
                    fontWeight: 900,
                    color: '#F0EFF8',
                    textShadow: '0 4px 20px rgba(0,0,0,0.8)',
                    lineHeight: 1.1,
                    maxWidth: '1080px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: 600,
                    color: '#A8A0D8',
                    textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                  }}
                >
                  By {creator}
                </div>
              </div>

              {/* 5. Evidence Chain Flow */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(28, 26, 56, 0.8)',
                  border: '1px solid rgba(168, 160, 216, 0.2)',
                  borderRadius: '16px',
                  padding: '16px 24px',
                  fontSize: '22px',
                  fontFamily: 'monospace',
                  color: '#A8A0D8',
                  gap: '12px',
                  marginTop: '16px',
                  width: 'fit-content',
                }}
              >
                <div style={{ display: 'flex', color: '#F0EFF8' }}>[ File ]</div>
                <div style={{ display: 'flex', opacity: 0.7 }}>➔</div>
                <div style={{ display: 'flex', color: '#6C3EF4' }}>(SHA-256)</div>
                <div style={{ display: 'flex', opacity: 0.7 }}>➔</div>
                <div style={{ display: 'flex', color: '#00D4AA', background: 'rgba(0, 212, 170, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>[{hash}...]</div>
                <div style={{ display: 'flex', opacity: 0.7 }}>➔</div>
                <div style={{ display: 'flex', color: '#6C3EF4' }}>(RFC3161)</div>
                <div style={{ display: 'flex', opacity: 0.7 }}>➔</div>
                <div style={{ display: 'flex', color: '#00D4AA', background: 'rgba(0, 212, 170, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>[{timestamp}]</div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error('Failed to generate OGP image', e);
    return new Response('Failed to generate the image', {
      status: 500,
    });
  }
}
