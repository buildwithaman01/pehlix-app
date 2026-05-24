import React from 'react';

export function PehlixWordmark({ className, light = false }) {
  const textColor = light ? 'text-white' : 'text-[#0F3D3E]';
  const xColor = light ? '#A8DDD5' : '#5FB3A5';

  return (
    <span className={`font-satoshi font-extrabold tracking-[0.06em] inline-flex items-center select-none ${textColor} ${className || ''}`}>
      <span>PEHLI</span>
      <span className="inline-flex items-center shrink-0" style={{ height: '1em', width: '0.9em', marginLeft: '0.02em' }}>
        <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          {/* Top-Left segment */}
          <line x1="3" y1="3" x2="10.5" y2="10.5" stroke={xColor} strokeWidth="4.5" strokeLinecap="butt" />
          {/* Top-Right segment */}
          <line x1="21" y1="3" x2="13.5" y2="10.5" stroke={xColor} strokeWidth="4.5" strokeLinecap="butt" />
          {/* Bottom-Left segment */}
          <line x1="3" y1="21" x2="10.5" y2="13.5" stroke={xColor} strokeWidth="4.5" strokeLinecap="butt" />
          {/* Bottom-Right segment */}
          <line x1="21" y1="21" x2="13.5" y2="13.5" stroke={xColor} strokeWidth="4.5" strokeLinecap="butt" />
        </svg>
      </span>
    </span>
  );
}

export function PehlixIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Dark emerald to teal gradient background */}
        <linearGradient id="pehlixIconBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F3D3E" />
          <stop offset="100%" stopColor="#1E5D5E" />
        </linearGradient>
      </defs>
      {/* Rounded Container Background */}
      <rect width="100" height="100" rx="28" fill="url(#pehlixIconBg)" />
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
