// From https://github.com/vercel/next.js/blob/a90f0c91d6063d25be513779cb21fb8892ba4201/packages/next/src/build/webpack/plugins/next-font-manifest-plugin.ts

/**
 * When calling font functions with next/font, you can specify if you'd like the font to be preloaded (true by default).
 * e.g.: const inter = Inter({ subsets: ['latin'], preload: true })
 *
 * In that case, next-font-loader will emit the font file as [name].p.[ext] instead of [name].[ext]
 * This function returns those files from an array that can include both preloaded and non-preloaded files.
 */
export function getPreloadedFontFiles(fontFiles: string[]) {
  return fontFiles.filter((file: string) =>
    /\.p\.(woff|woff2|eot|ttf|otf)$/.test(file)
  )
}

/**
 * Similarly to getPreloadedFontFiles, but returns true if some of the files includes -s in the name.
 * This means that a font is using size adjust in its fallback font.
 * This was added to enable adding data-size-adjust="true" to the dom, used by the Google Aurora team to collect statistics.
 */
export function getPageIsUsingSizeAdjust(fontFiles: string[]) {
  return fontFiles.some((file) => file.includes('-s'))
}
