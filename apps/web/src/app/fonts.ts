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

const manrope = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--font-manrope', display: 'swap', preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-space-grotesk', display: 'swap', preload: false });
const archivo = Archivo({ subsets: ['latin', 'latin-ext'], variable: '--font-archivo', display: 'swap', preload: false });
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-barlow-condensed',
  display: 'swap', preload: false,
});
const bebasNeue = Bebas_Neue({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-bebas-neue', display: 'swap', preload: false });
const oswald = Oswald({ subsets: ['latin', 'latin-ext'], variable: '--font-oswald', display: 'swap', preload: false });
const chakraPetch = Chakra_Petch({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-chakra-petch',
  display: 'swap', preload: false,
});
const rajdhani = Rajdhani({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-rajdhani', display: 'swap', preload: false });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron', display: 'swap', preload: false });
const playfair = Playfair_Display({ subsets: ['latin', 'latin-ext'], variable: '--font-playfair-display', display: 'swap', preload: false });
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant-garamond',
  display: 'swap', preload: false,
});
const dmSerif = DM_Serif_Display({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-dm-serif-display', display: 'swap', preload: false });
const notoSansJp = Noto_Sans_JP({ subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-noto-sans-jp', display: 'swap', preload: false });
const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-zen-kaku-gothic-new',
  display: 'swap', preload: false,
});
const jetbrains = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-jetbrains-mono', display: 'swap', preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-ibm-plex-mono', display: 'swap', preload: false });

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
