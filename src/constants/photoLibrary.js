export const photoLibrary = [
	{
		id: 'lake',
		label: 'Vann Aktivitet',
		accent: '#48C78E',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-lake" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#48C78E"/>
          <stop offset="50%" stop-color="#2FB8A0"/>
          <stop offset="100%" stop-color="#1CA8C6"/>
        </linearGradient>
        <filter id="shadow-lake">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="90" rx="24" fill="url(#grad-lake)"/>
      <!-- Wave pattern -->
      <path d="M0 60 Q15 50 30 55 T60 55 T90 55 T120 50" stroke="rgba(255,255,255,0.95)" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#shadow-lake)"/>
      <path d="M0 65 Q20 55 40 60 T80 60 T120 55" stroke="rgba(255,255,255,0.85)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M0 70 Q25 60 50 65 T100 65 T120 60" stroke="rgba(255,255,255,0.75)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M0 75 Q30 65 60 70 T120 65" stroke="rgba(255,255,255,0.65)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M0 80 Q35 70 70 75 T120 70" stroke="rgba(255,255,255,0.55)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M0 85 Q40 75 80 80 T120 75" stroke="rgba(255,255,255,0.45)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Additional wave details -->
      <ellipse cx="25" cy="58" rx="8" ry="3" fill="rgba(255,255,255,0.4)"/>
      <ellipse cx="50" cy="60" rx="10" ry="3.5" fill="rgba(255,255,255,0.35)"/>
      <ellipse cx="75" cy="58" rx="9" ry="3" fill="rgba(255,255,255,0.4)"/>
      <ellipse cx="95" cy="60" rx="7" ry="2.5" fill="rgba(255,255,255,0.3)"/>
      <!-- Canoe on waves -->
      <path d="M35 52 L45 48 L55 48 L65 52 L60 56 L40 56 Z" fill="rgba(255,255,255,0.95)" filter="url(#shadow-lake)"/>
      <path d="M38 50 L42 48 L48 48 L52 50" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M42 54 L48 54" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="52" r="2" fill="rgba(255,255,255,0.8)"/>
      <path d="M50 50 L50 54" stroke="rgba(255,255,255,0.6)" stroke-width="1" fill="none"/>
    </svg>
  `
	},
	{
		id: 'trail',
		label: 'Skog Aktivitet',
		accent: '#41B883',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-trail" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2F9964"/>
          <stop offset="50%" stop-color="#4AB37A"/>
          <stop offset="100%" stop-color="#73D19C"/>
        </linearGradient>
        <filter id="shadow-trail">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="90" rx="24" fill="url(#grad-trail)"/>
      <!-- Trail path -->
      <path d="M20 76 C35 60 50 65 65 50 C78 38 88 40 108 22" stroke="rgba(255,255,255,0.85)" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow-trail)"/>
      <!-- Large trees on left side of trail -->
      <path d="M12 70 L8 50 L16 50 Z" fill="rgba(255,255,255,0.95)" filter="url(#shadow-trail)"/>
      <path d="M10 68 L6 48 L14 48 Z" fill="rgba(255,255,255,0.85)"/>
      <circle cx="10" cy="45" r="5" fill="rgba(255,255,255,0.9)" filter="url(#shadow-trail)"/>
      <circle cx="10" cy="45" r="2.5" fill="rgba(255,255,255,0.5)"/>
      <path d="M18 72 L14 52 L22 52 Z" fill="rgba(255,255,255,0.9)" filter="url(#shadow-trail)"/>
      <circle cx="18" cy="48" r="4" fill="rgba(255,255,255,0.88)"/>
      <!-- Large trees on right side of trail -->
      <path d="M108 50 L104 30 L112 30 Z" fill="rgba(255,255,255,0.95)" filter="url(#shadow-trail)"/>
      <path d="M106 48 L102 28 L110 28 Z" fill="rgba(255,255,255,0.85)"/>
      <circle cx="106" cy="25" r="6" fill="rgba(255,255,255,0.92)" filter="url(#shadow-trail)"/>
      <circle cx="106" cy="25" r="3" fill="rgba(255,255,255,0.5)"/>
      <path d="M114 52 L110 32 L118 32 Z" fill="rgba(255,255,255,0.9)" filter="url(#shadow-trail)"/>
      <circle cx="114" cy="30" r="5" fill="rgba(255,255,255,0.88)"/>
      <!-- Medium trees along trail -->
      <path d="M26 50 L32 36 L38 50 Z" fill="rgba(255,255,255,0.95)" filter="url(#shadow-trail)"/>
      <circle cx="32" cy="33" r="4" fill="rgba(255,255,255,0.9)"/>
      <path d="M50 45 L56 32 L62 45 Z" fill="rgba(255,255,255,0.9)" filter="url(#shadow-trail)"/>
      <circle cx="56" cy="29" r="5" fill="rgba(255,255,255,0.88)"/>
      <path d="M82 42 L88 30 L94 42 Z" fill="rgba(255,255,255,0.95)" filter="url(#shadow-trail)"/>
      <circle cx="88" cy="27" r="4.5" fill="rgba(255,255,255,0.9)"/>
      <!-- Small details -->
      <circle cx="30" cy="55" r="3" fill="rgba(255,255,255,0.8)"/>
      <circle cx="70" cy="48" r="3" fill="rgba(255,255,255,0.8)"/>
    </svg>
  `
	},
	{
		id: 'urban',
		label: 'By',
		accent: '#FF8D60',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g-urban" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#FFAF66"/>
          <stop offset="1" stop-color="#FF6F61"/>
        </linearGradient>
      </defs>
      <rect width="120" height="90" rx="20" fill="url(#g-urban)"/>
      <g transform="translate(60,50)">
        <!-- symmetric skyline -->
        <rect x="-42" y="-24" width="18" height="40" rx="3" fill="#fff" opacity="0.95"/>
        <rect x="-18" y="-34" width="20" height="50" rx="3" fill="#fff" opacity="0.92"/>
        <rect x="6" y="-28" width="16" height="44" rx="3" fill="#fff" opacity="0.95"/>
        <rect x="26" y="-38" width="12" height="54" rx="2" fill="#fff" opacity="0.9"/>
        <!-- ground line symmetric -->
        <rect x="-50" y="20" width="100" height="6" rx="3" fill="rgba(255,255,255,0.75)"/>
      </g>
    </svg>
  `
	},
	{
		id: 'sports',
		label: 'Sport',
		accent: '#E74C3C',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-sports" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E74C3C"/>
          <stop offset="50%" stop-color="#DC3A2D"/>
          <stop offset="100%" stop-color="#C0392B"/>
        </linearGradient>
        <filter id="shadow-sports">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="90" rx="24" fill="url(#grad-sports)"/>
      <circle cx="60" cy="43" r="18" fill="rgba(255,255,255,0.95)" filter="url(#shadow-sports)"/>
      <path d="M50 33 L58 25 L62 25 L70 33 L66 43 L54 43 Z" fill="rgba(255,255,255,0.98)" filter="url(#shadow-sports)"/>
      <path d="M42 53 L50 48 L54 58 L46 63 Z" fill="rgba(255,255,255,0.9)" filter="url(#shadow-sports)"/>
      <path d="M72 58 L80 53 L76 63 L68 63 Z" fill="rgba(255,255,255,0.9)" filter="url(#shadow-sports)"/>
      <circle cx="58" cy="40" r="2" fill="rgba(255,255,255,0.6)"/>
      <circle cx="62" cy="40" r="2" fill="rgba(255,255,255,0.6)"/>
      <path d="M56 44 Q60 46 64 44" stroke="rgba(255,255,255,0.7)" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>
  `
	},
	{
		id: 'wellness',
		label: 'Velvære',
		accent: '#9B59B6',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g-well" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#9B59B6"/>
          <stop offset="1" stop-color="#8E44AD"/>
        </linearGradient>
      </defs>
      <rect width="120" height="90" rx="20" fill="url(#g-well)"/>
      <g transform="translate(60,48)" fill="rgba(255,255,255,0.95)">
        <path d="M0 18 C-10 8 -22 0 -8 -18 C-2 -6 2 -6 8 -18 C22 0 10 8 0 18 Z"/>
        <circle cx="0" cy="-6" r="3.2" fill="rgba(255,255,255,0.95)"/>
      </g>
    </svg>
  `
	},
	{
		id: 'culture',
		label: 'Kultur',
		accent: '#3498DB',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g-cult" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#3498DB"/>
          <stop offset="1" stop-color="#2980B9"/>
        </linearGradient>
      </defs>
      <rect width="120" height="90" rx="20" fill="url(#g-cult)"/>
      <g transform="translate(60,50)" fill="rgba(255,255,255,0.95)">
        <rect x="-30" y="-20" width="10" height="36" rx="2"/>
        <rect x="-12" y="-26" width="10" height="42" rx="2"/>
        <rect x="6" y="-18" width="10" height="34" rx="2"/>
        <rect x="24" y="-28" width="10" height="44" rx="2"/>
        <rect x="-40" y="18" width="80" height="6" rx="3" fill="rgba(255,255,255,0.8)"/>
      </g>
    </svg>
  `
	},
	{
		id: 'food',
		label: 'Mat og drikke',
		accent: '#E67E22',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g-food" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#E67E22"/>
          <stop offset="1" stop-color="#D35400"/>
        </linearGradient>
      </defs>
      <rect width="120" height="90" rx="20" fill="url(#g-food)"/>
      <g transform="translate(60,45)" fill="rgba(255,255,255,0.95)">
        <circle r="18"/>
        <circle r="8" fill="rgba(255,255,255,0.35)"/>
        <!-- fork + knife symmetric -->
        <rect x="-30" y="-12" width="4" height="28" rx="2" transform="rotate(-12)"/>
        <rect x="26" y="-12" width="4" height="28" rx="2" transform="rotate(12)"/>
      </g>
    </svg>
  `
	},
	{
		id: 'music',
		label: 'Musikk',
		accent: '#1ABC9C',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-music" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1ABC9C"/>
          <stop offset="50%" stop-color="#19B896"/>
          <stop offset="100%" stop-color="#16A085"/>
        </linearGradient>
        <filter id="shadow-music">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="90" rx="24" fill="url(#grad-music)"/>
      <circle cx="43" cy="43" r="16" fill="rgba(255,255,255,0.95)" filter="url(#shadow-music)"/>
      <circle cx="43" cy="43" r="9" fill="rgba(255,255,255,0.4)"/>
      <rect x="48" y="28" width="5" height="32" rx="2" fill="rgba(255,255,255,0.98)" filter="url(#shadow-music)"/>
      <rect x="56" y="23" width="5" height="37" rx="2" fill="rgba(255,255,255,0.98)" filter="url(#shadow-music)"/>
      <rect x="64" y="28" width="5" height="32" rx="2" fill="rgba(255,255,255,0.98)" filter="url(#shadow-music)"/>
      <path d="M38 58 Q48 53 58 58" stroke="rgba(255,255,255,0.85)" stroke-width="4" fill="none" stroke-linecap="round" filter="url(#shadow-music)"/>
    </svg>
  `
	},
	{
		id: 'art',
		label: 'Kreativitet',
		accent: '#E91E63',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-art" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E91E63"/>
          <stop offset="50%" stop-color="#E01A5F"/>
          <stop offset="100%" stop-color="#C2185B"/>
        </linearGradient>
        <filter id="shadow-art">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="90" rx="24" fill="url(#grad-art)"/>
      <path d="M28 48 Q38 28 48 38 Q58 28 68 38 Q78 28 88 48" stroke="rgba(255,255,255,0.95)" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#shadow-art)"/>
      <circle cx="38" cy="53" r="6" fill="rgba(255,255,255,0.98)" filter="url(#shadow-art)"/>
      <circle cx="38" cy="53" r="3" fill="rgba(255,255,255,0.5)"/>
      <circle cx="58" cy="48" r="7" fill="rgba(255,255,255,0.95)" filter="url(#shadow-art)"/>
      <circle cx="58" cy="48" r="3.5" fill="rgba(255,255,255,0.5)"/>
      <circle cx="78" cy="53" r="6" fill="rgba(255,255,255,0.98)" filter="url(#shadow-art)"/>
      <circle cx="78" cy="53" r="3" fill="rgba(255,255,255,0.5)"/>
      <path d="M33 63 Q43 58 53 63" stroke="rgba(255,255,255,0.75)" stroke-width="4" fill="none" stroke-linecap="round"/>
    </svg>
  `
	},
	{
		id: 'education',
		label: 'Læring',
		accent: '#34495E',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-education" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34495E"/>
          <stop offset="50%" stop-color="#304558"/>
          <stop offset="100%" stop-color="#2C3E50"/>
        </linearGradient>
        <filter id="shadow-education">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="90" rx="24" fill="url(#grad-education)"/>
      <rect x="28" y="33" width="64" height="42" rx="4" fill="rgba(255,255,255,0.95)" filter="url(#shadow-education)"/>
      <rect x="33" y="38" width="54" height="5" rx="2" fill="rgba(255,255,255,0.75)"/>
      <rect x="33" y="46" width="44" height="5" rx="2" fill="rgba(255,255,255,0.75)"/>
      <rect x="33" y="54" width="49" height="5" rx="2" fill="rgba(255,255,255,0.75)"/>
      <rect x="33" y="62" width="38" height="5" rx="2" fill="rgba(255,255,255,0.7)"/>
      <circle cx="50" cy="23" r="9" fill="rgba(255,255,255,0.98)" filter="url(#shadow-education)"/>
      <circle cx="50" cy="23" r="5" fill="rgba(255,255,255,0.4)"/>
    </svg>
  `
	},
	{
		id: 'volunteer',
		label: 'Frivillig',
		accent: '#27AE60',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-volunteer" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#27AE60"/>
          <stop offset="50%" stop-color="#25A85A"/>
          <stop offset="100%" stop-color="#229954"/>
        </linearGradient>
        <filter id="shadow-volunteer">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="90" rx="24" fill="url(#grad-volunteer)"/>
      <circle cx="60" cy="38" r="19" fill="rgba(255,255,255,0.95)" filter="url(#shadow-volunteer)"/>
      <circle cx="60" cy="38" r="11" fill="rgba(255,255,255,0.3)"/>
      <path d="M50 33 L56 43 L70 28" stroke="rgba(255,255,255,0.98)" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow-volunteer)"/>
      <path d="M38 58 Q48 53 58 58 Q68 53 78 58" stroke="rgba(255,255,255,0.85)" stroke-width="4" fill="none" stroke-linecap="round" filter="url(#shadow-volunteer)"/>
    </svg>
  `
	},
	{
		id: 'fitness',
		label: 'Trening',
		accent: '#E74C3C',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-fitness" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E74C3C"/>
          <stop offset="50%" stop-color="#DC3A2D"/>
          <stop offset="100%" stop-color="#C0392B"/>
        </linearGradient>
        <filter id="shadow-fitness">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="90" rx="24" fill="url(#grad-fitness)"/>
      <circle cx="48" cy="33" r="13" fill="rgba(255,255,255,0.98)" filter="url(#shadow-fitness)"/>
      <circle cx="48" cy="33" r="7" fill="rgba(255,255,255,0.4)"/>
      <rect x="43" y="38" width="10" height="22" rx="5" fill="rgba(255,255,255,0.95)" filter="url(#shadow-fitness)"/>
      <path d="M33 48 L28 58 L33 63 L38 58 Z" fill="rgba(255,255,255,0.95)" filter="url(#shadow-fitness)"/>
      <path d="M63 48 L68 58 L63 63 L58 58 Z" fill="rgba(255,255,255,0.95)" filter="url(#shadow-fitness)"/>
      <path d="M48 23 L43 28 L48 33 L53 28 Z" fill="rgba(255,255,255,0.95)" filter="url(#shadow-fitness)"/>
      <path d="M38 43 L33 48 L38 53 L43 48 Z" fill="rgba(255,255,255,0.9)" filter="url(#shadow-fitness)"/>
      <path d="M58 43 L63 48 L58 53 L53 48 Z" fill="rgba(255,255,255,0.9)" filter="url(#shadow-fitness)"/>
    </svg>
  `
	},
	{
		id: 'winter',
		label: 'Vinteraktivitet',
		accent: '#87CEEB',
		svg: `
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-winter" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#87CEEB"/>
          <stop offset="50%" stop-color="#6BB6D6"/>
          <stop offset="100%" stop-color="#4682B4"/>
        </linearGradient>
        <filter id="shadow-winter">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="90" rx="24" fill="url(#grad-winter)"/>
      <path d="M28 38 L33 28 L38 38 L33 33 Z" fill="rgba(255,255,255,0.98)" filter="url(#shadow-winter)"/>
      <path d="M48 33 L53 23 L58 33 L53 28 Z" fill="rgba(255,255,255,0.98)" filter="url(#shadow-winter)"/>
      <path d="M68 38 L73 28 L78 38 L73 33 Z" fill="rgba(255,255,255,0.98)" filter="url(#shadow-winter)"/>
      <path d="M88 36 L93 26 L98 36 L93 31 Z" fill="rgba(255,255,255,0.98)" filter="url(#shadow-winter)"/>
      <path d="M23 58 Q33 53 43 58 Q53 53 63 58 Q73 53 83 58 Q93 53 103 58" stroke="rgba(255,255,255,0.95)" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#shadow-winter)"/>
      <circle cx="38" cy="48" r="5" fill="rgba(255,255,255,0.95)" filter="url(#shadow-winter)"/>
      <circle cx="58" cy="46" r="6" fill="rgba(255,255,255,0.95)" filter="url(#shadow-winter)"/>
      <circle cx="78" cy="48" r="5" fill="rgba(255,255,255,0.95)" filter="url(#shadow-winter)"/>
    </svg>
  `
	}
]

export function getPhotoAccent(id) {
	const option = photoLibrary.find(item => item.id === id)
	return option ? option.accent : '#48C78E'
}

export function getPhotoSvg(id) {
	const option = photoLibrary.find(item => item.id === id)
	return option ? option.svg : null
}
