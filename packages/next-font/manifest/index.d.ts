export type NextFontManifest = Readonly<
  Record<string, string[]> & {
    isUsingSizeAdjust: boolean;
  }
>;

export const manifest: NextFontManifest;

/**
 * Get hrefs for fonts to preload
 * Returns null if there are no fonts at all.
 * Returns string[] if there are fonts to preload (font paths)
 * Returns empty string[] if there are fonts but none to preload and no other fonts have been preloaded
 * Returns null if there are fonts but none to preload and at least some were previously preloaded
 */
export const getPreloadableFonts: (filePath?: string) => string[] | null;

export const getFontMetadata: (filePath?: string) => {
  preconnect: {
    href: string;
    type: string;
    crossOrigin?: string;
    nonce?: string;
  }[];
  preload: {
    href: string;
    crossOrigin?: string;
    nonce?: string;
  }[];
};
