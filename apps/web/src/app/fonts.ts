import {
  Archivo,
  Barlow_Condensed,
  Bebas_Neue,
  Chakra_Petch,
  Cormorant_Garamond,
  DM_Serif_Display,
  IBM_Plex_Mono,
  Inter,
  JetBrains_Mono,
  Manrope,
  Noto_Sans_JP,
  Orbitron,
  Oswald,
  Playfair_Display,
  Rajdhani,
  Sora,
  Space_Grotesk,
  Zen_Kaku_Gothic_New,
} from 'next/font/google';

/**
 * Self-hosted fonts (next/font downloads them at build time — no runtime requests to Google).
 * Only the UI fonts are preloaded; theme fonts load on demand when a crew theme uses them.
 * Variable names match `fontCssVariable()` in @vogn/theme-engine.
 */
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });
const sora = Sora({ subsets: ['latin', 'latin-ext'], variable: '--font-sora', display: 'swap' });

const lazy = { display: 'swap', preload: false } as const;
const manrope = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--font-manrope', ...lazy });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-space-grotesk', ...lazy });
const archivo = Archivo({ subsets: ['latin', 'latin-ext'], variable: '--font-archivo', ...lazy });
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-barlow-condensed',
  ...lazy,
});
const bebasNeue = Bebas_Neue({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-bebas-neue', ...lazy });
const oswald = Oswald({ subsets: ['latin', 'latin-ext'], variable: '--font-oswald', ...lazy });
const chakraPetch = Chakra_Petch({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-chakra-petch',
  ...lazy,
});
const rajdhani = Rajdhani({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-rajdhani', ...lazy });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron', ...lazy });
const playfair = Playfair_Display({ subsets: ['latin', 'latin-ext'], variable: '--font-playfair-display', ...lazy });
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant-garamond',
  ...lazy,
});
const dmSerif = DM_Serif_Display({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-dm-serif-display', ...lazy });
const notoSansJp = Noto_Sans_JP({ subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-noto-sans-jp', ...lazy });
const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-zen-kaku-gothic-new',
  ...lazy,
});
const jetbrains = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-jetbrains-mono', ...lazy });
const plexMono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-ibm-plex-mono', ...lazy });

export const fontVariables = [
  inter,
  sora,
  manrope,
  spaceGrotesk,
  archivo,
  barlowCondensed,
  bebasNeue,
  oswald,
  chakraPetch,
  rajdhani,
  orbitron,
  playfair,
  cormorant,
  dmSerif,
  notoSansJp,
  zenKaku,
  jetbrains,
  plexMono,
]
  .map((f) => f.variable)
  .join(' ');
