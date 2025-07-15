import { fileURLToPath } from 'node:url'
import { dataToEsm } from '@rollup/pluginutils'
import type { NextFontManifest } from 'next-font/manifest'
import type { PluginOption, ResolvedConfig } from 'vite'
import { importResolve, tryCatch } from '@/utils'

export const nextFontManifestPlugin = ({
  nextFontManifest,
}: {
  nextFontManifest: NextFontManifest
}): PluginOption[] => {
  let config: ResolvedConfig | null = null

  const manifestId = import.meta.resolve('next-font/manifest')

  return [
    {
      name: 'next-font:manifest',
      configResolved(resolvedConfig) {
        config = resolvedConfig
      },
      async load(id) {
        const { data: resolvedId, error } = await tryCatch(importResolve(id))
        if (error != null || resolvedId == null) return

        if (resolvedId === manifestId) {
          return [
            `function encodeURIPath(file) {
              return file
                .split('/')
                .map((p) => encodeURIComponent(p))
                .join('/')
            }`,
            `const injectedFontPreloadTags = new Set();`,
            dataToEsm(
              {
                __NEXT_FONT_MANIFEST__: nextFontManifest,
                getPreloadableFonts: undefined,
                getFontMetadata: undefined,
              },
              {
                preferConst: true,
                namedExports: true,
              }
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
          const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(fontFilename)[1];
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
            `export const manifest = Object.freeze(__NEXT_FONT_MANIFEST__);`,
            `if (import.meta.hot) import.meta.hot.accept(${JSON.stringify(manifestId)}, () => {
              manifest = __NEXT_FONT_MANIFEST__;
            })`,
          ].join('\n')
        }
      },
    },
  ]
}
