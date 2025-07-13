import { fileURLToPath } from 'node:url';
import { dataToEsm } from '@rollup/pluginutils';
import type { NextFontManifest } from 'next-font/manifest';
import type { PluginOption, ResolvedConfig } from 'vite';

export const nextFontManifestPlugin = ({
  nextFontManifest,
}: {
  nextFontManifest: NextFontManifest;
}): PluginOption[] => {
  let config: ResolvedConfig | null = null;

  const MANIFEST_ID = fileURLToPath(import.meta.resolve('next-font/manifest'));

  return [
    {
      name: 'next-font:manifest',
      configResolved(resolvedConfig) {
        config = resolvedConfig;
      },
      async load(id) {
        const { id: resolvedId } = (await this.resolve(id)) || {};
        if (!resolvedId) return;

        if (resolvedId === MANIFEST_ID) {
          return [
            `import { fileURLToPath } from 'node:url';`,
            `export function encodeURIPath(file) {
              return file
                .split('/')
                .map((p) => encodeURIComponent(p))
                .join('/')
            }`,
            `const injectedFontPreloadTags = new Set();`,
            dataToEsm(
              {
                manifest: Object.freeze(nextFontManifest),
                getPreloadableFonts: undefined,
                getFontMetadata: undefined
              },
              {
                preferConst: true,
                namedExports: true,
              },
            ).replace(
              'export const getPreloadableFonts = undefined;',
              `export const getPreloadableFonts = (filePath) => {
	if (!manifest || !filePath) return null;
  filePath = fileURLToPath(filePath);
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
}`,
            ).replace('export const getFontMetadata = undefined;', `export const getFontMetadata = (filePath) => {
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
}`),
            // `export const `
          ].join('\n');
        }
      },
    },
  ];
};
