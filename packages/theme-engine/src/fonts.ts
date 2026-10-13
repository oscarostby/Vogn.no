/**
 * Allowlisted fonts. Themes reference fonts by id only; renderers map ids to self-hosted / next/font
 * families (web) or loaded font names (mobile). No arbitrary font URLs are ever accepted.
 */
export const FONT_IDS = [
  'inter',
  'manrope',
  'space-grotesk',
  'sora',
  'archivo',
  'barlow-condensed',
  'oswald',
  'bebas-neue',
  'chakra-petch',
  'rajdhani',
  'orbitron',
  'playfair-display',
  'cormorant-garamond',
  'dm-serif-display',
  'noto-sans-jp',
  'zen-kaku-gothic-new',
  'jetbrains-mono',
  'ibm-plex-mono',
] as const;
export type FontId = (typeof FONT_IDS)[number];

export interface FontDefinition {
  id: FontId;
  label: string;
  category: 'sans' | 'serif' | 'display' | 'mono';
  /** CSS fallback stack appended after the web font variable. */
  fallback: string;
  supportsJapanese: boolean;
  weights: number[];
}

export const FONTS: Record<FontId, FontDefinition> = {
  inter: { id: 'inter', label: 'Inter', category: 'sans', fallback: 'system-ui, sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700, 800] },
  manrope: { id: 'manrope', label: 'Manrope', category: 'sans', fallback: 'system-ui, sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700, 800] },
  'space-grotesk': { id: 'space-grotesk', label: 'Space Grotesk', category: 'sans', fallback: 'system-ui, sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700] },
  sora: { id: 'sora', label: 'Sora', category: 'sans', fallback: 'system-ui, sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700, 800] },
  archivo: { id: 'archivo', label: 'Archivo', category: 'sans', fallback: 'system-ui, sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700, 800, 900] },
  'barlow-condensed': { id: 'barlow-condensed', label: 'Barlow Condensed', category: 'display', fallback: '"Arial Narrow", sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700, 800] },
  oswald: { id: 'oswald', label: 'Oswald', category: 'display', fallback: '"Arial Narrow", sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700] },
  'bebas-neue': { id: 'bebas-neue', label: 'Bebas Neue', category: 'display', fallback: 'Impact, "Arial Narrow", sans-serif', supportsJapanese: false, weights: [400] },
  'chakra-petch': { id: 'chakra-petch', label: 'Chakra Petch', category: 'display', fallback: 'system-ui, sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700] },
  rajdhani: { id: 'rajdhani', label: 'Rajdhani', category: 'display', fallback: 'system-ui, sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700] },
  orbitron: { id: 'orbitron', label: 'Orbitron', category: 'display', fallback: 'system-ui, sans-serif', supportsJapanese: false, weights: [400, 500, 600, 700, 800, 900] },
  'playfair-display': { id: 'playfair-display', label: 'Playfair Display', category: 'serif', fallback: 'Georgia, serif', supportsJapanese: false, weights: [400, 500, 600, 700, 800] },
  'cormorant-garamond': { id: 'cormorant-garamond', label: 'Cormorant Garamond', category: 'serif', fallback: 'Georgia, serif', supportsJapanese: false, weights: [400, 500, 600, 700] },
  'dm-serif-display': { id: 'dm-serif-display', label: 'DM Serif Display', category: 'serif', fallback: 'Georgia, serif', supportsJapanese: false, weights: [400] },
  'noto-sans-jp': { id: 'noto-sans-jp', label: 'Noto Sans JP', category: 'sans', fallback: '"Hiragino Sans", "Yu Gothic", sans-serif', supportsJapanese: true, weights: [400, 500, 700, 900] },
  'zen-kaku-gothic-new': { id: 'zen-kaku-gothic-new', label: 'Zen Kaku Gothic New', category: 'sans', fallback: '"Hiragino Sans", "Yu Gothic", sans-serif', supportsJapanese: true, weights: [400, 500, 700, 900] },
  'jetbrains-mono': { id: 'jetbrains-mono', label: 'JetBrains Mono', category: 'mono', fallback: 'ui-monospace, monospace', supportsJapanese: false, weights: [400, 500, 700] },
  'ibm-plex-mono': { id: 'ibm-plex-mono', label: 'IBM Plex Mono', category: 'mono', fallback: 'ui-monospace, monospace', supportsJapanese: false, weights: [400, 500, 600] },
};

/** CSS variable name the web app exposes for each font (set by next/font in the root layout). */
export function fontCssVariable(id: FontId): string {
  return `--font-${id}`;
}

export function fontStack(id: FontId): string {
  return `var(${fontCssVariable(id)}), ${FONTS[id].fallback}`;
}
