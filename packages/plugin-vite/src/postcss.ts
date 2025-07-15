import loaderUtils from 'loader-utils';
import postcssNextFontPlugin from 'next/dist/build/webpack/loaders/next-font-loader/postcss-next-font.js';
import type { FontLoader } from 'next-font';
import type PostCSS from 'postcss';
import { createCachedImport } from './utils';

const importPostcssModules = createCachedImport(
  () => import('postcss-modules'),
);
const importPostcss = createCachedImport(() => import('postcss'));

export const nextFontPostcss = async (
  relativePathFromRoot: string,
  {
    css,
    fallbackFonts,
    weight,
    style,
    adjustFontFallback,
    variable,
  }: Awaited<ReturnType<FontLoader>>,
) => {
  // Exports will be exported as is from css-loader instead of a CSS module export
  // const exports: { name: any; value: any }[] = [];

  // Generate a hash from the CSS content. Used to generate classnames
  const fontFamilyHash = loaderUtils.getHashDigest(
    Buffer.from(css),
    'sha1',
    'hex',
    6,
  );

  let modules: Record<string, string> | undefined;

  const result = await runPostCss({
    postcssPlugins: [
      (
        (
          postcssNextFontPlugin as unknown as Record<
            'default',
            typeof postcssNextFontPlugin
          >
        ).default || postcssNextFontPlugin
      )({
        exports: [],
        fallbackFonts,
        weight,
        style,
        adjustFontFallback,
        variable,
      }),
      (await importPostcssModules()).default({
        generateScopedName: (originalClassName: string) => {
          // hash from next-font-loader
          return `__${originalClassName}_${fontFamilyHash}`;
        },
        getJSON(
          _cssFileName: string,
          _modules: Record<string, string>,
          _outputFileName: string,
        ) {
          modules = _modules;
        },
      }),
    ],
    postcssOptions: {
      from: relativePathFromRoot,
    },
    code: css,
  });

  return {
    ...result,
    modules,
  };
};

const runPostCss = async ({
  postcssPlugins = [],
  postcssOptions = {},
  code,
}: {
  postcssPlugins?: PostCSS.AcceptedPlugin[];
  code: string;
  postcssOptions?: PostCSS.ProcessOptions;
}) => {
  let postcssResult: PostCSS.Result;
  try {
    const postcss = await importPostcss();

    // postcss is an unbundled dep and should be lazy imported
    postcssResult = await postcss
      .default(postcssPlugins)
      .process(code, postcssOptions);
  } catch (e: unknown) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'message' in e &&
      'file' in e &&
      'line' in e &&
      'column' in e &&
      typeof e.column === 'number'
    ) {
      throw Object.assign(
        {},
        {
          message: `[postcss] ${e.message}`,
          code,
          loc: {
            file: e.file,
            line: e.line,
            column: e.column - 1, // 1-based
          },
        },
      );
    }
  }

  return {
    code: postcssResult!.css,
    map: { mappings: '' as const },
  };
};
