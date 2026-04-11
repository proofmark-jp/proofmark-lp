import React from 'react';
import founderBadge from '../assets/logo/badges/proofmark-badge-founder.svg';

interface FounderBadgeProps {
  className?: string;
  showIcon?: boolean;
}

export const FounderBadge: React.FC<FounderBadgeProps> = ({ className = "", showIcon = true }) => {
  return (
    <div 
      className={`flex items-center gap-1.5 bg-[#6C3EF4]/10 border border-[#6C3EF4]/50 shadow-[0_0_12px_rgba(108,62,244,0.4)] px-4 py-1.5 rounded-full ${className}`}
    >
      {showIcon && (
        <img 
          src={founderBadge} 
          alt="Founder" 
          className="w-4 h-4 print:hidden" 
        />
      )}
      <span className="hidden print:inline-block w-4 h-4 text-center leading-4">🚀</span>
      <span className="text-[10px] font-black text-[#BC78FF] tracking-widest uppercase print:text-purple-700">
        Founder
      </span>
    </div>
  );
};

export default FounderBadge;
