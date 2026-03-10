/**
 * Get hrefs for fonts to preload
 * Returns null if there are no fonts at all.
 * Returns string[] if there are fonts to preload (font paths)
 * Returns empty string[] if there are fonts but none to preload and no other fonts have been preloaded
 * Returns null if there are fonts but none to preload and at least some were previously preloaded
 */
export declare function getPreloadableFonts(filePath?: string): string[] | null

declare const def: {
  getPreloadableFonts: typeof getPreloadableFonts
}

export default def
