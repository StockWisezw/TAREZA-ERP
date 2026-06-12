import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  type?: 'full' | 'symbol' | 'horizontal';
  variant?: 'light' | 'dark' | 'default';
  showSubtitle?: boolean;
}

export function TarezaLogo({
  className = '',
  size = 'md',
  type = 'full',
  variant = 'default',
  showSubtitle = true,
}: LogoProps) {
  // Determine pixel sizes for the icon part
  const getIconSize = () => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'sm': return 32;
      case 'md': return 46;
      case 'lg': return 76;
      case 'xl': return 130;
      default: return 46;
    }
  };

  const iconSize = getIconSize();

  // Create the T Symbol SVG paths
  // We use viewBox="98 102 295 352" to tightly crop the T-symbol to its exact geometry bounds,
  // eliminating all blank left/right space inside the coordinate box.
  const renderSymbol = () => (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="98 102 295 352"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 animate-fade-in"
    >
      <defs>
        {/* Left segment gradient: rich purple (magenta/violet) to deep purple */}
        <linearGradient id="tareza-left-grad" x1="110" y1="115" x2="245" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b00ff" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>

        {/* Right segment gradient: neon cyan/teal to deep royal blue */}
        <linearGradient id="tareza-right-grad" x1="260" y1="115" x2="350" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>

        {/* Vertical stem gradient: vivid purple to deep royal blue/dark purple */}
        <linearGradient id="tareza-stem-grad" x1="200" y1="190" x2="290" y2="440" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5c10eb" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        
        {/* Glow drop shadow for professional touch */}
        <filter id="logo-glow" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#8b00ff" floodOpacity="0.15" />
        </filter>
      </defs>

      <g filter="url(#logo-glow)">
        {/* Top-Left crossbar element: Purple gradient slanted parallelogram-shape */}
        <path
          d="M 110 115 L 245 115 L 215 180 L 110 180 Z"
          fill="url(#tareza-left-grad)"
        />

        {/* Top-Right crossbar element: Cyan/Blue gradient slanted parallelogram */}
        <path
          d="M 260 115 L 380 115 L 350 180 L 230 180 Z"
          fill="url(#tareza-right-grad)"
        />

        {/* Primary stem vertical column: slanted top chamfer matching the exact gaps */}
        <path
          d="M 200 440 L 200 250 L 230 190 L 290 190 L 290 440 Z"
          fill="url(#tareza-stem-grad)"
        />
      </g>
    </svg>
  );

  if (type === 'symbol') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{renderSymbol()}</div>;
  }

  // Determine text coloring depending on the variant context
  const textClass = variant === 'dark' 
    ? 'text-white' 
    : variant === 'light' 
      ? 'text-zinc-900' 
      : 'text-zinc-900 dark:text-white';

  const subtitleClass = variant === 'dark' 
    ? 'text-zinc-400' 
    : variant === 'light' 
      ? 'text-zinc-500' 
      : 'text-zinc-500 dark:text-zinc-400';

  // Sizing styles for text layout
  // We specify negative margin-left on the text block to pull 'areza' seamlessly right next to the T.
  const textLayout = size === 'sm' 
    ? { title: 'text-2xl', subtitle: 'text-[9px] tracking-[0.16em] ml-0.5', textMargin: 'ml-1.5', labelMargin: 'pl-1.5' }
    : size === 'lg'
      ? { title: 'text-5xl', subtitle: 'text-sm tracking-[0.22em] ml-1', textMargin: 'ml-3', labelMargin: 'pl-3' }
      : size === 'xl'
        ? { title: 'text-7xl', subtitle: 'text-xl tracking-[0.26em] ml-2', textMargin: 'ml-4', labelMargin: 'pl-5' }
        : { title: 'text-4xl', subtitle: 'text-[11px] tracking-[0.2em] ml-0.5', textMargin: 'ml-2', labelMargin: 'pl-2' }; // md (default)

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className="flex items-center gap-0">
        {renderSymbol()}
        
        <div className={`flex flex-col justify-center select-none ${textLayout.textMargin}`}>
          {/* Logo Name Display 'areza' with zero gap next to the cropped T symbol */}
          <div className="flex items-baseline leading-none">
            <span className={`${textLayout.title} font-black tracking-tight ${textClass} font-sans`}>
              a<span className="text-cyan-500 dark:text-cyan-400">r</span>eza
            </span>
          </div>
          {showSubtitle && (
            <span className={`${textLayout.subtitle} font-bold uppercase mt-1 leading-none ${subtitleClass}`}>
              TECHNOLOGIES
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
