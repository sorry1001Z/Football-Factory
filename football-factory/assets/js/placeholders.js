/* ============================================
   FOOTBALL FACTORY — PLACEHOLDER GENERATORS
   Generates SVG placeholder images for demo data
   ============================================ */

(function () {
  'use strict';

  // Team color mapping (placeholder colors, not official)
  const teamColors = {
    LIV: { bg: '#C8102E', text: '#FFFFFF' },
    ARS: { bg: '#EF0107', text: '#FFFFFF' },
    MCI: { bg: '#6CABDD', text: '#0B1117' },
    TOT: { bg: '#132257', text: '#FFFFFF' },
    MUN: { bg: '#DA291C', text: '#FFE500' },
    CHE: { bg: '#034694', text: '#FFFFFF' },
    NEW: { bg: '#241F20', text: '#FFFFFF' },
    AVL: { bg: '#670E36', text: '#95BFE5' },
    BAR: { bg: '#A50044', text: '#FFD700' },
    RMA: { bg: '#FFFFFF', text: '#0B1117' },
    ATM: { bg: '#CB3524', text: '#FFFFFF' },
    SEV: { bg: '#D71920', text: '#FFFFFF' },
    VAL: { bg: '#F18101', text: '#FFFFFF' },
    MIL: { bg: '#FB090B', text: '#0B1117' },
    JUV: { bg: '#000000', text: '#FFFFFF' },
    INT: { bg: '#0068A8', text: '#0B1117' },
    NAP: { bg: '#12A0D7', text: '#0B1117' },
    ROM: { bg: '#8E1F2F', text: '#F5A02D' },
    BAY: { bg: '#DC052D', text: '#FFFFFF' },
    BVB: { bg: '#FDE100', text: '#0B1117' },
    LEV: { bg: '#E32221', text: '#0B1117' },
    B04: { bg: '#E32221', text: '#0B1117' },
    PSG: { bg: '#004170', text: '#FFFFFF' },
    MON: { bg: '#E7192F', text: '#FFFFFF' },
    MAR: { bg: '#2FAEE0', text: '#FFFFFF' },
    LYO: { bg: '#1A4A9F', text: '#FFFFFF' },
    BHA: { bg: '#0057B8', text: '#FFCD00' },
    WHU: { bg: '#7A263A', text: '#1BB1E7' },
    WOL: { bg: '#FDB913', text: '#231F20' },
    CRY: { bg: '#1B458F', text: '#C4122E' },
    EVE: { bg: '#003399', text: '#FFFFFF' },
    FUL: { bg: '#000000', text: '#FFFFFF' },
    BRE: { bg: '#E30613', text: '#FBB800' },
    NFO: { bg: '#DD0000', text: '#FFFFFF' },
    BOU: { bg: '#DA291C', text: '#000000' },
    LEI: { bg: '#003090', text: '#FDB913' },
    IPS: { bg: '#3764A6', text: '#FFFFFF' },
    SOU: { bg: '#D71920', text: '#130C0E' }
  };

  const leagueColors = {
    PL: { bg: '#3D195B', text: '#FFFFFF' },
    PD: { bg: '#EE8707', text: '#FFFFFF' },
    SA: { bg: '#003F7F', text: '#FFFFFF' },
    BL: { bg: '#D20515', text: '#FFFFFF' },
    FL: { bg: '#091C3E', text: '#FFFFFF' },
    CL: { bg: '#001E62', text: '#FFFFFF' },
    EL: { bg: '#FF6900', text: '#FFFFFF' }
  };

  // Generate a team crest SVG (60px viewBox 60)
  function crest(id, size) {
    const team = teamColors[id] || { bg: '#26333B', text: '#FFFFFF' };
    return `<svg width="${size}" height="${size}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${id} crest">
      <defs>
        <radialGradient id="g-${id}" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.25)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.25)"/>
        </radialGradient>
      </defs>
      <circle cx="30" cy="30" r="28" fill="${team.bg}"/>
      <circle cx="30" cy="30" r="28" fill="url(#g-${id})"/>
      <circle cx="30" cy="30" r="28" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
      <text x="30" y="35" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="14" fill="${team.text}">${id}</text>
    </svg>`;
  }

  // Generate league logo SVG
  function leagueLogo(id, size) {
    const league = leagueColors[id] || { bg: '#26333B', text: '#FFFFFF' };
    return `<svg width="${size}" height="${size}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${id} league">
      <circle cx="30" cy="30" r="28" fill="${league.bg}"/>
      <circle cx="30" cy="30" r="28" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <text x="30" y="35" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="13" fill="${league.text}">${id}</text>
    </svg>`;
  }

  // Player photo (gradient with initials)
  function playerPhoto(initials, palette, size) {
    const w = size || 200;
    const p = palette || ['#1B2A24', '#0B5D34'];
    return `<svg width="${w}" height="${w}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Player placeholder">
      <defs>
        <linearGradient id="pg-${initials}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${p[0]}"/>
          <stop offset="100%" stop-color="${p[1]}"/>
        </linearGradient>
        <radialGradient id="pr-${initials}" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill="url(#pg-${initials})"/>
      <!-- Player silhouette -->
      <g transform="translate(100 90)">
        <ellipse cx="0" cy="0" rx="32" ry="36" fill="rgba(255,255,255,0.18)"/>
        <ellipse cx="0" cy="0" rx="32" ry="36" fill="url(#pr-${initials})"/>
        <path d="M-48 110 Q -48 30, 0 30 Q 48 30, 48 110 Z" fill="rgba(255,255,255,0.14)"/>
        <path d="M-48 110 Q -48 30, 0 30 Q 48 30, 48 110 Z" fill="url(#pr-${initials})"/>
      </g>
      <rect width="200" height="200" fill="url(#pr-${initials})"/>
      <g transform="translate(20 184)">
        <rect width="40" height="14" rx="3" fill="rgba(245,158,11,0.9)"/>
        <text x="20" y="10" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="8" fill="#0B1117" letter-spacing="0.08em">${initials}</text>
      </g>
    </svg>`;
  }

  // Stadium / hero scene SVG (no copyrighted photos)
  function stadiumScene(label, palette) {
    const p = palette || ['#0B1117', '#1B2A24', '#148A4B'];
    return `<svg width="800" height="500" viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Football scene placeholder">
      <defs>
        <linearGradient id="sky-${label}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${p[0]}"/>
          <stop offset="100%" stop-color="${p[1]}"/>
        </linearGradient>
        <linearGradient id="pitch-${label}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1B5E2E"/>
          <stop offset="100%" stop-color="#0E3A1B"/>
        </linearGradient>
        <radialGradient id="light-${label}" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stop-color="${p[2]}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${p[2]}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="figure-${label}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${p[2] || '#39B970'}"/>
          <stop offset="100%" stop-color="${p[1] || '#0B1117'}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#sky-${label})"/>
      <rect y="320" width="800" height="180" fill="url(#pitch-${label})"/>
      <rect width="800" height="500" fill="url(#light-${label})"/>
      <!-- Crowd silhouette -->
      <g opacity="0.4">
        <ellipse cx="80" cy="280" rx="60" ry="35" fill="rgba(255,255,255,0.06)"/>
        <ellipse cx="200" cy="270" rx="80" ry="40" fill="rgba(255,255,255,0.05)"/>
        <ellipse cx="350" cy="265" rx="100" ry="45" fill="rgba(255,255,255,0.06)"/>
        <ellipse cx="500" cy="270" rx="80" ry="40" fill="rgba(255,255,255,0.05)"/>
        <ellipse cx="650" cy="280" rx="80" ry="35" fill="rgba(255,255,255,0.06)"/>
        <ellipse cx="750" cy="285" rx="50" ry="30" fill="rgba(255,255,255,0.05)"/>
      </g>
      <!-- Stadium architecture curves -->
      <path d="M0 240 Q 400 200, 800 240" stroke="rgba(255,255,255,0.1)" stroke-width="1" fill="none"/>
      <!-- Floodlights -->
      <g>
        <circle cx="120" cy="80" r="8" fill="rgba(255,255,200,0.85)"/>
        <circle cx="120" cy="80" r="14" fill="rgba(255,255,200,0.18)"/>
        <circle cx="280" cy="60" r="8" fill="rgba(255,255,200,0.85)"/>
        <circle cx="280" cy="60" r="14" fill="rgba(255,255,200,0.18)"/>
        <circle cx="440" cy="50" r="8" fill="rgba(255,255,200,0.85)"/>
        <circle cx="440" cy="50" r="14" fill="rgba(255,255,200,0.18)"/>
        <circle cx="600" cy="60" r="8" fill="rgba(255,255,200,0.85)"/>
        <circle cx="600" cy="60" r="14" fill="rgba(255,255,200,0.18)"/>
        <circle cx="680" cy="80" r="8" fill="rgba(255,255,200,0.85)"/>
        <circle cx="680" cy="80" r="14" fill="rgba(255,255,200,0.18)"/>
      </g>
      <!-- Light beams -->
      <path d="M120 80 L 100 500 L 250 500 L 280 60 Z" fill="rgba(255,255,200,0.025)"/>
      <path d="M600 60 L 550 500 L 700 500 L 680 80 Z" fill="rgba(255,255,200,0.025)"/>
      <!-- Pitch lines (more visible) -->
      <line x1="0" y1="350" x2="800" y2="350" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      <ellipse cx="400" cy="425" rx="80" ry="22" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
      <line x1="400" y1="320" x2="400" y2="500" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <circle cx="400" cy="425" r="3" fill="rgba(255,255,255,0.4)"/>
      <!-- Player silhouette (more prominent) -->
      <g transform="translate(400 290)">
        <ellipse cx="0" cy="-30" rx="22" ry="26" fill="url(#figure-${label})"/>
        <ellipse cx="0" cy="-30" rx="22" ry="26" fill="rgba(0,0,0,0.25)"/>
        <path d="M-35 60 Q -35 -5, 0 -5 Q 35 -5, 35 60 Z" fill="url(#figure-${label})"/>
        <path d="M-35 60 Q -35 -5, 0 -5 Q 35 -5, 35 60 Z" fill="rgba(0,0,0,0.25)"/>
        <!-- Arms -->
        <path d="M-32 5 L -55 35 L -45 50" stroke="${p[2] || '#39B970'}" stroke-width="8" stroke-linecap="round" fill="none"/>
        <path d="M32 5 L 60 -10 L 70 -20" stroke="${p[2] || '#39B970'}" stroke-width="8" stroke-linecap="round" fill="none"/>
      </g>
      <!-- Ball -->
      <g transform="translate(485 420)">
        <circle r="12" fill="#fff" stroke="#0B1117" stroke-width="1.5"/>
        <polygon points="0,-7 6,-2 4,5 -4,5 -6,-2" fill="#0B1117"/>
      </g>
      <!-- DEMO label -->
      <g transform="translate(40, 460)">
        <rect x="0" y="0" width="60" height="22" rx="4" fill="rgba(245,158,11,0.95)"/>
        <text x="30" y="15" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="10" fill="#0B1117" letter-spacing="0.1em">DEMO</text>
      </g>
      <g transform="translate(720, 470)">
        <rect x="0" y="0" width="50" height="20" rx="4" fill="rgba(11,93,52,0.9)"/>
        <text x="25" y="14" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="9" fill="#FFFFFF" letter-spacing="0.06em">FF • DEMO</text>
      </g>
    </svg>`;
  }

  // Simple news hero (gradient + label)
  function newsHero(label, palette) {
    const p = palette || ['#0B1117', '#148A4B'];
    return `<svg width="800" height="450" viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="News hero placeholder">
      <defs>
        <linearGradient id="nh-${label}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${p[0]}"/>
          <stop offset="100%" stop-color="${p[1]}"/>
        </linearGradient>
        <pattern id="p-${label}" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="1.5" fill="rgba(255,255,255,0.1)"/>
        </pattern>
      </defs>
      <rect width="800" height="450" fill="url(#nh-${label})"/>
      <rect width="800" height="450" fill="url(#p-${label})"/>
      <circle cx="640" cy="120" r="100" fill="rgba(255,255,255,0.06)"/>
      <circle cx="640" cy="120" r="60" fill="rgba(255,255,255,0.08)"/>
      <circle cx="640" cy="120" r="30" fill="rgba(255,255,255,0.12)"/>
      <text x="400" y="240" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="48" fill="rgba(255,255,255,0.2)" letter-spacing="-0.02em">FOOTBALL FACTORY</text>
      <g transform="translate(40, 410)">
        <rect x="0" y="0" width="60" height="22" rx="4" fill="rgba(245,158,11,0.9)"/>
        <text x="30" y="15" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="10" fill="#0B1117" letter-spacing="0.1em">DEMO</text>
      </g>
    </svg>`;
  }

  // Build DOM
  function render() {
    document.querySelectorAll('[data-crest]').forEach(el => {
      const id = el.dataset.crest;
      const size = parseInt(el.dataset.size) || 32;
      el.innerHTML = crest(id, size);
    });
    document.querySelectorAll('[data-league-logo]').forEach(el => {
      const id = el.dataset.leagueLogo;
      const size = parseInt(el.dataset.size) || 40;
      el.innerHTML = leagueLogo(id, size);
    });
    document.querySelectorAll('[data-player]').forEach(el => {
      const init = el.dataset.player;
      const palette = el.dataset.palette ? el.dataset.palette.split(',') : null;
      const size = parseInt(el.dataset.size) || 200;
      el.innerHTML = playerPhoto(init, palette, size);
    });
    document.querySelectorAll('[data-stadium]').forEach(el => {
      const label = el.dataset.stadium;
      const palette = el.dataset.palette ? el.dataset.palette.split(',') : null;
      el.innerHTML = stadiumScene(label, palette);
    });
    document.querySelectorAll('[data-news]').forEach(el => {
      const label = el.dataset.news;
      const palette = el.dataset.palette ? el.dataset.palette.split(',') : null;
      el.innerHTML = newsHero(label, palette);
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
