/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PresetDesign } from './types';

const cyberpunkSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="100%" height="100%" fill="none" />
  <g transform="translate(50, 50)">
    <!-- Glowing Grid Background -->
    <path d="M 0 150 L 300 150 M 150 0 L 150 300" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4"/>
    <circle cx="150" cy="150" r="130" fill="none" stroke="#ff007f" stroke-width="2" opacity="0.5" stroke-dasharray="10 5"/>
    <circle cx="150" cy="150" r="110" fill="none" stroke="#00f0ff" stroke-width="1" opacity="0.3"/>
    
    <!-- Hexagon Frame -->
    <polygon points="150,30 270,100 270,200 150,270 30,200 30,100" fill="#0c0f1d" stroke="#00f0ff" stroke-width="4" opacity="0.95" filter="drop-shadow(0px 0px 8px rgba(0, 240, 255, 0.6))"/>
    <polygon points="150,42 258,105 258,195 150,258 42,195 42,105" fill="none" stroke="#ff007f" stroke-width="2" opacity="0.8"/>
    
    <!-- Inner design -->
    <path d="M 90 100 L 150 70 L 210 100 L 210 160 L 150 190 L 90 160 Z" fill="none" stroke="#00f0ff" stroke-width="1" stroke-dasharray="3 3" />
    <path d="M 120 150 L 150 110 L 180 150 Z" fill="#ff007f" opacity="0.8"/>
    
    <!-- Bold Typography -->
    <text x="150" y="145" font-family="'Courier New', Courier, monospace, sans-serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle" letter-spacing="2">NEO-TOKYO</text>
    <text x="150" y="170" font-family="'Courier New', Courier, monospace, sans-serif" font-weight="600" font-size="11" fill="#00f0ff" text-anchor="middle" letter-spacing="4">SHIELD DIV.</text>
    <text x="150" y="225" font-family="sans-serif" font-weight="700" font-size="9" fill="#ff007f" text-anchor="middle" letter-spacing="6">SYS.ONLINE</text>
    
    <!-- Technical Corner Decorators -->
    <path d="M 60 110 L 60 90 L 80 90" fill="none" stroke="#00f0ff" stroke-width="2" />
    <path d="M 240 110 L 240 90 L 220 90" fill="none" stroke="#00f0ff" stroke-width="2" />
    <path d="M 60 190 L 60 210 L 80 210" fill="none" stroke="#ff007f" stroke-width="2" />
    <path d="M 240 190 L 240 210 L 220 210" fill="none" stroke="#ff007f" stroke-width="2" />
  </g>
</svg>
`;

const retrowaveSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="100%" height="100%" fill="none" />
  <g transform="translate(50, 50)">
    <!-- Synthwave Sunset -->
    <defs>
      <linearGradient id="synthGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ff007f" />
        <stop offset="40%" stop-color="#ff5e00" />
        <stop offset="100%" stop-color="#ffea00" />
      </linearGradient>
      <clipPath id="sunClip">
        <circle cx="150" cy="140" r="100" />
      </clipPath>
    </defs>
    
    <!-- Outer Glow Rim -->
    <circle cx="150" cy="140" r="104" fill="none" stroke="#ff007f" stroke-width="1.5" opacity="0.3" />

    <!-- Sun with horizontal split lines (Synthwave sun) -->
    <g clip-path="url(#sunClip)">
      <rect x="30" y="20" width="240" height="240" fill="url(#synthGrad)" />
      <!-- Grid stripes -->
      <rect x="0" y="115" width="300" height="4" fill="#111827" />
      <rect x="0" y="125" width="300" height="6" fill="#111827" />
      <rect x="0" y="137" width="300" height="8" fill="#111827" />
      <rect x="0" y="151" width="300" height="11" fill="#111827" />
      <rect x="0" y="168" width="300" height="15" fill="#111827" />
      <rect x="0" y="190" width="300" height="22" fill="#111827" />
      <rect x="0" y="218" width="300" height="30" fill="#111827" />
    </g>

    <!-- Mountain Silhouette -->
    <polygon points="20,200 80,140 140,200" fill="#2d004d" opacity="0.9" />
    <polygon points="110,200 180,120 260,200" fill="#1d0033" opacity="0.95" />
    <polygon points="70,200 130,150 190,200" fill="#ff007f" opacity="0.3" />

    <!-- Palm Trees Silhouettes -->
    <!-- Left Palm -->
    <path d="M 50 200 Q 60 160 80 130" fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round" />
    <path d="M 80 130 Q 65 125 50 130 M 80 130 Q 75 115 60 110 M 80 130 Q 90 115 100 115 M 80 130 Q 95 125 110 135" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round" />
    <!-- Right Palm -->
    <path d="M 250 200 Q 235 155 210 125" fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round" />
    <path d="M 210 125 Q 195 125 180 135 M 210 125 Q 200 110 190 105 M 210 125 Q 220 110 235 110 M 210 125 Q 230 120 245 130" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round" />

    <!-- Grid floor perspective -->
    <path d="M 20 200 L 280 200 L 290 240 L 10 240 Z" fill="#0d021a" />
    <path d="M 20 200 L 10 240 M 65 200 L 50 240 M 110 200 L 100 240 M 150 200 L 150 240 M 190 200 L 200 240 M 235 200 L 250 240 M 280 200 L 290 240" stroke="#00f0ff" stroke-width="1.5" />
    <line x1="15" y1="210" x2="285" y2="210" stroke="#ff007f" stroke-width="1" />
    <line x1="12" y1="223" x2="288" y2="223" stroke="#ff007f" stroke-width="1" />
    <line x1="8" y1="235" x2="292" y2="235" stroke="#ff007f" stroke-width="1.5" />

    <!-- Retro Neon Text -->
    <text x="150" y="222" font-family="'Impact', 'Arial Black', sans-serif" font-weight="900" font-style="italic" font-size="28" fill="#ffffff" text-anchor="middle" letter-spacing="4" filter="drop-shadow(0px 0px 6px #ff007f)">OUTRUN</text>
    <text x="150" y="235" font-family="'Courier New', Courier, monospace, sans-serif" font-weight="bold" font-size="10" fill="#00f0ff" text-anchor="middle" letter-spacing="5">LIMITLESS RETRO</text>
  </g>
</svg>
`;

const minimalSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="100%" height="100%" fill="none" />
  <g transform="translate(50, 50)">
    <!-- Earth Tone Circles -->
    <circle cx="120" cy="130" r="65" fill="#e8d8c8" opacity="0.9" />
    <circle cx="180" cy="150" r="55" fill="#d1bfa7" opacity="0.8" />
    <circle cx="150" cy="100" r="45" fill="#efe6dd" opacity="0.75" />
    
    <!-- Minimal Botanical Line Art -->
    <path d="M 150 220 C 150 180, 130 140, 110 100 C 120 120, 125 150, 120 170 C 115 190, 130 200, 150 220" fill="none" stroke="#2c2a29" stroke-width="3" stroke-linecap="round" />
    <path d="M 150 220 C 153 190, 175 160, 190 120 C 185 140, 175 165, 178 180 C 180 195, 165 210, 150 220" fill="none" stroke="#2c2a29" stroke-width="2.5" stroke-linecap="round" />
    
    <!-- Tiny elegant stars/crosses -->
    <path d="M 80 80 L 90 80 M 85 75 L 85 85" stroke="#2c2a29" stroke-width="1" />
    <path d="M 220 90 L 226 90 M 223 87 L 223 93" stroke="#2c2a29" stroke-width="1" />
    
    <!-- Frame border -->
    <rect x="25" y="25" width="250" height="250" fill="none" stroke="#2c2a29" stroke-width="1.5" stroke-dasharray="1 1" opacity="0.6"/>
    
    <!-- Serene Text -->
    <text x="150" y="255" font-family="'Playfair Display', 'Didot', 'Georgia', serif" font-weight="normal" font-size="16" fill="#2c2a29" text-anchor="middle" letter-spacing="5">S E R E N I T Y</text>
    <text x="150" y="270" font-family="'Inter', sans-serif" font-weight="300" font-size="7" fill="#605c59" text-anchor="middle" letter-spacing="3">ORGANIC COTTON APPAREL</text>
  </g>
</svg>
`;

const streetwearSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="100%" height="100%" fill="none" />
  <g transform="translate(50, 50)">
    <!-- Industrial Checkerboard Accent -->
    <g opacity="0.15">
      <rect x="30" y="30" width="20" height="20" fill="#ffffff" />
      <rect x="70" y="30" width="20" height="20" fill="#ffffff" />
      <rect x="50" y="50" width="20" height="20" fill="#ffffff" />
      <rect x="90" y="50" width="20" height="20" fill="#ffffff" />
      <rect x="30" y="70" width="20" height="20" fill="#ffffff" />
      <rect x="70" y="70" width="20" height="20" fill="#ffffff" />
    </g>

    <!-- Barcode graphic -->
    <g transform="translate(45, 205)" opacity="0.85">
      <rect x="0" y="0" width="5" height="25" fill="#ffffff" />
      <rect x="8" y="0" width="2" height="25" fill="#ffffff" />
      <rect x="13" y="0" width="10" height="25" fill="#ffffff" />
      <rect x="26" y="0" width="4" height="25" fill="#ffffff" />
      <rect x="33" y="0" width="8" height="25" fill="#ffffff" />
      <rect x="44" y="0" width="2" height="25" fill="#ffffff" />
      <rect x="49" y="0" width="14" height="25" fill="#ffffff" />
      <rect x="66" y="0" width="4" height="25" fill="#ffffff" />
      <rect x="73" y="0" width="6" height="25" fill="#ffffff" />
      <rect x="82" y="0" width="12" height="25" fill="#ffffff" />
      <rect x="97" y="0" width="3" height="25" fill="#ffffff" />
      <text x="50" y="35" font-family="'Courier New', monospace" font-size="7" fill="#ffffff" text-anchor="middle" letter-spacing="1">902485-TX-99</text>
    </g>

    <!-- Bold Cross Hair Overlay -->
    <path d="M 150 40 L 150 180 M 80 110 L 220 110" stroke="#ef4444" stroke-width="1" opacity="0.5" />
    <circle cx="150" cy="110" r="35" fill="none" stroke="#ef4444" stroke-width="2" opacity="0.8" />
    <circle cx="150" cy="110" r="5" fill="#ef4444" />

    <!-- Distressed/Slashed Text -->
    <text x="150" y="95" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-weight="900" font-size="42" fill="#ffffff" text-anchor="middle" letter-spacing="2">RAW</text>
    <text x="150" y="145" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-weight="900" font-size="42" fill="#ffffff" text-anchor="middle" letter-spacing="2">FORCE</text>
    
    <!-- Red warning ribbon -->
    <rect x="25" y="155" width="250" height="18" fill="#ef4444" transform="rotate(-5, 150, 160)" />
    <text x="150" y="168" font-family="sans-serif" font-weight="900" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="3" transform="rotate(-5, 150, 160)">CAUTION: ULTRA HEAVY</text>
    
    <!-- Additional street elements -->
    <text x="250" y="45" font-family="'Courier New', monospace" font-weight="bold" font-size="11" fill="#ef4444" text-anchor="end">V.09 [DEV]</text>
    <text x="50" y="45" font-family="'Courier New', monospace" font-weight="bold" font-size="11" fill="#ffffff" text-anchor="start">EDITION // 2026</text>
  </g>
</svg>
`;

export const PRESET_DESIGNS: PresetDesign[] = [
  {
    id: 'cyberpunk',
    name: 'Neo-Tokyo Cyber',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(cyberpunkSvg)}`,
    category: 'Futuristic',
  },
  {
    id: 'retrowave',
    name: 'Synthwave Sun',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(retrowaveSvg)}`,
    category: 'Retro',
  },
  {
    id: 'minimalist',
    name: 'Serenity Botanical',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(minimalSvg)}`,
    category: 'Minimalist',
  },
  {
    id: 'streetwear',
    name: 'Raw Force Industrial',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(streetwearSvg)}`,
    category: 'Streetwear',
  },
];
