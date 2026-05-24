import React from 'react';

export function PehlixWordmark({ className, light = false }) {
  const textColor = light ? 'text-white' : 'text-[#1E1E1E]';
  return (
    <span className={`font-satoshi font-extrabold tracking-wider inline-flex items-center ${textColor} ${className}`}>
      <span>PEHLI</span>
      <span className="inline-flex items-center ml-1 shrink-0" style={{ height: '0.85em', width: '0.85em' }}>
        <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          {/* Left chevron pointing right */}
          <path d="M6 5 L11 12 L6 19" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Right chevron pointing left */}
          <path d="M18 5 L13 12 L18 19" stroke="#5FB3A5" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
}

export function PehlixIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rounded Container Background in Deep Emerald */}
      <rect width="100" height="100" rx="28" fill="#0F3D3E" />
      {/* Top P Loop in White */}
      <path d="M40 32 H62 C68 32, 68 48, 62 48 H40" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Vertical Stem - Three nodes layout */}
      <line x1="40" y1="32" x2="40" y2="76" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
      <circle cx="40" cy="54" r="6" fill="#5FB3A5" stroke="#FFFFFF" strokeWidth="3" />
      <circle cx="40" cy="65" r="6" fill="#5FB3A5" stroke="#FFFFFF" strokeWidth="3" />
      <circle cx="40" cy="76" r="6" fill="#5FB3A5" stroke="#FFFFFF" strokeWidth="3" />
      {/* Small teal connectivity accent lines */}
      <line x1="40" y1="54" x2="55" y2="54" stroke="#5FB3A5" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="40" y1="65" x2="55" y2="65" stroke="#5FB3A5" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="40" y1="76" x2="55" y2="76" stroke="#5FB3A5" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

export default function PehlixLogo({ variant = 'wordmark', className, light = false }) {
  if (variant === 'icon') {
    return <PehlixIcon className={className} />;
  }
  return <PehlixWordmark className={className} light={light} />;
}
