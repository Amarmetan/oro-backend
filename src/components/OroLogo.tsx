import React, { useState } from 'react';

interface OroLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  customLogoUrl?: string;
  animated?: boolean;
}

export const OroLogo: React.FC<OroLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  customLogoUrl,
  animated = false,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeStyles = {
    sm: { height: '28px', iconSize: 26, titleSize: 'text-base', subSize: 'text-[9px]' },
    md: { height: '36px', iconSize: 34, titleSize: 'text-xl', subSize: 'text-[10px]' },
    lg: { height: '54px', iconSize: 50, titleSize: 'text-3xl', subSize: 'text-xs' },
    xl: { height: '80px', iconSize: 76, titleSize: 'text-5xl', subSize: 'text-sm' },
  };

  const current = sizeStyles[size] || sizeStyles.md;
  const logoSrc = customLogoUrl && customLogoUrl.trim() ? customLogoUrl.trim() : '/logo.svg';

  // If a custom URL is provided or /logo.svg renders directly, display the crisp image
  if (!imageError) {
    return (
      <div className={`inline-flex items-center gap-2 select-none ${className}`}>
        <img
          src={logoSrc}
          alt="ORO RECORDS"
          className={`object-contain transition-transform duration-300 ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{ height: current.height, maxWidth: '240px' }}
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Pure SVG inline fallback directly matching user's uploaded image (chevron + eagle silhouette cutout)
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        className={`relative flex items-center justify-center transition-transform duration-300 ${
          animated ? 'animate-bounce scale-105' : ''
        }`}
        style={{ width: current.iconSize, height: current.iconSize }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_0_12px_rgba(34,197,94,0.45)]"
          fill="none"
        >
          {/* Main Vibrant Green Chevron with Eagle Profile Negative Space */}
          <path
            d="M 22,12 
               L 82,46 
               C 88,49 88,57 82,60 
               L 22,94 
               C 16,97 8,93 8,86 
               L 8,68 
               C 8,64 11,60 15,58 
               L 52,50 
               L 15,42 
               C 11,40 8,36 8,32 
               L 8,14 
               C 8,7 16,3 22,12 Z"
            fill="#22C55E"
          />
          {/* Subtle Falcon beak shadow & eye */}
          <circle cx="58" cy="46" r="2" fill="#FFFFFF" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col justify-center leading-none">
          <div className="flex items-center tracking-wider">
            <span
              className={`font-black tracking-widest text-[#22C55E] drop-shadow-[0_0_8px_rgba(34,197,94,0.3)] ${current.titleSize}`}
              style={{ fontFamily: "'Impact', 'Arial Black', sans-serif" }}
            >
              ORO
            </span>
          </div>
          <span
            className={`font-black tracking-[0.25em] text-white/90 drop-shadow uppercase -mt-0.5 ${current.subSize}`}
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            RECORDS
          </span>
        </div>
      )}
    </div>
  );
};
