import { defineConfig } from 'tsdown';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dts } from 'rolldown-plugin-dts';

const pkgJsonPath = fileURLToPath(
  import.meta.resolve('next-repo/packages/font/package.json'),
);
const nextFontDir = path.dirname(pkgJsonPath);

export default defineConfig([
  {
    entry: ['src/**/*.ts', '!src/**/*.test.ts'],
    dts: {
      enabled: false,
    },
    outDir: path.join(import.meta.dirname, 'dist'),
    cwd: nextFontDir,
    plugins: [
      {
        name: 'name-fixes',
        transform: (code) => {
          if (code.includes('next/font')) {
            return code.replaceAll('next/font', 'next-font');
          }
        },
      },
    ],
  },
  {
    dts: {
      oxc: true,
    },
    entry: ['src/{google,local}/loader.ts', 'src/{fontkit,index}.ts'],
    deps: {
      neverBundle: [
        '../next-font-error.js',
        // google
        './validate-google-font-function-call.js',
        './fetch-css-from-google-fonts.js',
        './fetch-font-file.js',
        './find-font-files-in-css.js',
        './get-fallback-font-override-metrics.js',
        './get-font-axes.js',
        './get-google-fonts-url.js',
        // local
        './get-fallback-metrics-from-font-file.js',
        './pick-font-file-for-fallback-generation.js',
        './validate-local-font-function-call.js',
      ],
    },
  },
]);
