import { useEffect, useState } from "react";

/**
 * CertificateMockup Component
 * Design: Cyber-Minimalist Security
 * 
 * Displays an animated certificate with hash generation effect.
 * Creates a sense of active cryptographic processing.
 */

export const CertificateMockup = () => {
  const [hashValue, setHashValue] = useState("calculating...");

  // Animate hash generation on mount
  useEffect(() => {
    let iteration = 0;
    const finalHash = "a3f2c891...1e4d";
    const chars = "0123456789abcdef";
    
    const interval = setInterval(() => {
      setHashValue(
        Array.from({ length: 15 })
          .map(() => chars[Math.floor(Math.random() * chars.length)])
          .join("")
      );
      
      if (iteration >= 10) {
        clearInterval(interval);
        setHashValue(finalHash);
      }
      iteration += 1;
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-1 rounded-2xl bg-gradient-to-br from-primary/50 via-accent/30 to-border overflow-hidden">
      <div className="h-full w-full p-8 rounded-[15px] bg-card/95 backdrop-blur-sm relative">
        {/* Scanline effect */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20"></div>
        
        <div className="flex justify-between items-center mb-6 pb-6 border-b border-border relative z-10">
          <span className="text-sm font-semibold text-primary">ProofMark Digital Certificate</span>
          <span className="text-xs font-mono bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">#PM-0001</span>
        </div>

        <div className="space-y-4 relative z-10">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted font-mono uppercase tracking-wider">SHA-256 Hash Signature</span>
            <span className="text-lg font-mono text-accent break-all">{hashValue}</span>
          </div>
          <div className="flex justify-between text-sm pb-3 border-b border-border/50">
            <span className="text-muted">Timestamp (JST)</span>
            <span className="font-mono">2026-03-16 14:32:19</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Storage Locations</span>
            <span className="font-mono">Tokyo • Osaka • Singapore</span>
          </div>
        </div>

        {/* Verification badge */}
        <div className="mt-6 relative z-10">
          <div className="inline-block px-4 py-2 rounded-full bg-accent text-accent-foreground font-bold text-xs">
            ✓ 3-Location Verified
          </div>
        </div>
      </div>
    </div>
  );
};
