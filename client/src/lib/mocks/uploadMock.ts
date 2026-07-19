// client/src/lib/mocks/uploadMock.ts
/**
 * Browser-safe mock for Next.js Server Action src/actions/upload.ts.
 * This prevents Vite from trying to bundle Node-only modules (S3/Supabase) on the client side.
 */

export async function registerCertificateAction(input: {
  cid: string;
  sizeBytes: number;
  mimeType: string;
  objectKey: string;
  title?: string;
}) {
  console.log('[ProofMark Mock] registerCertificateAction invoked:', input);
  // Simulates a successful atomic registration on the DB
  return {
    success: true,
    certificateId: 'mock-client-certificate-id',
  };
}
