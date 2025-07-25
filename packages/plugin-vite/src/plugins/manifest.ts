import type { PluginOption, ResolvedConfig } from 'vite'
import { importResolve, tryCatch } from '@/utils'
import type { NextFontManifest } from 'next-font/manifest'
import { dataToEsm } from '@rollup/pluginutils'

export const nextFontManifestPlugin = ({
  nextFontManifest,
}: {
  nextFontManifest: NextFontManifest
}): PluginOption[] => {
  let config: ResolvedConfig | null = null

  return [
    {
      name: 'next-font:manifest',
      configResolved(resolvedConfig) {
        config = resolvedConfig
      },
      transform: {
        order: 'post',
        async handler(_code, id) {
          const { data: resolvedId, error } = await tryCatch(importResolve(id))
          if (error != null || resolvedId == null) return

          if (resolvedId === import.meta.resolve('next-font/manifest')) {
            return [
              `function encodeURIPath(file) {
                return file
                  .split('/')
                  .map((p) => encodeURIComponent(p))
                  .join('/')
              }`,
              `const injectedFontPreloadTags = new Set();`,
              `const __NEXT_FONT_MANIFEST__ = ${JSON.stringify(nextFontManifest, null, 2)};`,
              dataToEsm(
                {
                  manifest: undefined,
                  getPreloadableFonts: undefined,
                  getFontMetadata: undefined,
                },
                {
                  preferConst: true,
                  namedExports: true,
                }
              )
                .replace(
                  'export const manifest = undefined;',
                  `export const manifest = Object.freeze(__NEXT_FONT_MANIFEST__);`
                )
                .replace(
                  'export const getPreloadableFonts = undefined;',
                  `export const getPreloadableFonts = (filePath) => {
    if (!manifest || !filePath) return null;
    const fontFiles = new Set();
    let foundFontUsage = false;
    const preloadedFontFiles = manifest[filePath];
    if (preloadedFontFiles) {
      foundFontUsage = true;
      for (let fontFile of preloadedFontFiles) {
        fontFile = \`/${config!.build.assetsDir}/_next/\${fontFile}\`;
        fontFiles.add(fontFile);
        injectedFontPreloadTags.add(fontFile);
      }
    }
    if (fontFiles.size) {
     return [...fontFiles].sort();
    } else if (foundFontUsage && injectedFontPreloadTags.size === 0) {
     return [];
    } else {
     return null;
    }
  }`
                )
                .replace(
                  'export const getFontMetadata = undefined;',
                  `export const getFontMetadata = (filePath) => {
    const metadata = {
      preload: [],
      preconnect: []
    };
    const preloadedFontFiles = filePath
        ? getPreloadableFonts(filePath)
        : null;
    if (preloadedFontFiles) {
        if (preloadedFontFiles.length) {
          for (let i = 0; i < preloadedFontFiles.length; i++) {
            const fontFilename = preloadedFontFiles[i];
            const ext = /.(woff|woff2|eot|ttf|otf)$/.exec(fontFilename)[1];
            const type = \`font/\${ext}\`;
            const href = encodeURIPath(fontFilename);

            metadata.preload.push({
              href,
              type,
              crossOrigin: undefined,
              nonce: undefined
            });
          }
        } else {
          try {
            let url = new URL('/' + '${config!.build.assetsDir}');
            metadata.preconnect.push({
              href: url.origin,
              crossOrigin: undefined,
              nonce: undefined
            });
          } catch (error) {
            // assetPrefix must not be a fully qualified domain name. We assume
            // we should preconnect to same origin instead
            metadata.preconnect.push({
              href: '/',
              crossOrigin: '',
              nonce: null
            });
          }
        }
      }

      return metadata;
  }`
                ),
              `if (import.meta.hot) import.meta.hot.accept(${JSON.stringify(id)}, () => {
                manifest = __NEXT_FONT_MANIFEST__;
              })`,
            ].join('\n')
          }
        },
      },
    },
  ]
}
