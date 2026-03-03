// import assert from 'node:assert';
import { build } from 'tsdown';
import path from 'node:path';

const pkgJsonPath = Bun.fileURLToPath(
  import.meta.resolve('next-repo/packages/font/package.json'),
);
const nextFontDir = path.dirname(pkgJsonPath);

await build({
  minify: true,
  outExtensions: () => ({
    js: '.js',
    ts: '.d.ts',
  }),
  entry: ['src/**/*.ts', '!src/**/*.test.ts'],
  outDir: path.join(import.meta.dir, '..', 'dist'),
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
});

await build({
  clean: false,
  minify: true,
  dts: {
    oxc: true,
  },
  outExtensions: () => ({
    js: '.js',
    ts: '.d.ts',
  }),
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
});
