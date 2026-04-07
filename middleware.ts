export const config = {
  matcher: '/cert/:id*',
};

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const idMatch = url.pathname.match(/\/cert\/(.+)/);

  if (!idMatch) {
    return fetch(request);
  }

  const id = idMatch[1];
  const ogImageUrl = `${url.origin}/api/og?id=${id}`;

  try {
    const response = await fetch(new URL('/', request.url));
    let html = await response.text();

    const metaTags = `
      <meta property="og:title" content="ProofMark | Certificate of Authenticity" />
      <meta property="og:image" content="${ogImageUrl}" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content="${ogImageUrl}" />
    `;

    html = html.replace('</head>', `${metaTags}</head>`);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
      },
    });
  } catch (error) {
    return fetch(request);
  }
}
