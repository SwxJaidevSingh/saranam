import React from 'react';

export default function PainLadderRails({ className = "" }) {
  return (
    <svg 
      className={`absolute inset-0 w-full h-full pointer-events-none z-0 ${className}`} 
      preserveAspectRatio="none" 
      viewBox="0 0 100 100"
    >
      <defs>
        {/* Gradient for vertical rails */}
        <linearGradient id="railGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b37d4e" />
          <stop offset="30%" stopColor="#cfa076" />
          <stop offset="70%" stopColor="#8c5a2b" />
          <stop offset="100%" stopColor="#613813" />
        </linearGradient>
        {/* Gradient for horizontal rungs to make them look like 3D cylindrical poles */}
        <linearGradient id="rungGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2b48c" />
          <stop offset="25%" stopColor="#cfa076" />
          <stop offset="65%" stopColor="#8c5a2b" />
          <stop offset="100%" stopColor="#543010" />
        </linearGradient>
      </defs>
      
      {/* Left slanted rail: from top-left (14%) to bottom-left (9%) */}
      <polygon points="12,0 16,0 11,100 7,100" fill="url(#railGrad)" filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.15))" />
      
      {/* Right slanted rail: from top-right (86%) to bottom-right (91%) */}
      <polygon points="88,0 84,0 89,100 93,100" fill="url(#railGrad)" filter="drop-shadow(-2px 4px 6px rgba(0,0,0,0.15))" />

      {/* Step 3 Rung (Top): connecting left rail (13%) to right rail (87%) at y = 22% */}
      <rect x="12" y="20.5" width="76" height="3" rx="1.5" fill="url(#rungGrad)" filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.25))" />

      {/* Step 2 Rung (Middle): connecting left rail (11.5%) to right rail (88.5%) at y = 50% */}
      <rect x="10.5" y="48.5" width="79" height="3" rx="1.5" fill="url(#rungGrad)" filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.25))" />

      {/* Step 1 Rung (Bottom): connecting left rail (10%) to right rail (90%) at y = 78% */}
      <rect x="9" y="76.5" width="82" height="3" rx="1.5" fill="url(#rungGrad)" filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.25))" />
    </svg>
  );
}
