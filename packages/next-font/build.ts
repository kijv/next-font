#!/usr/bin/env bun

import fs from 'node:fs/promises';
import path from 'node:path';
import { type BundleConfig, bundle } from 'bunchee';
import glob from 'fast-glob';

const config: BundleConfig = {
  minify: true,
  tsconfig: path.join(import.meta.dirname, 'tsconfig.json'),
};

const cwd = import.meta.dirname;
const nextFontDir = Bun.fileURLToPath(path.dirname(
  import.meta.resolve('@vercel/next.js/packages/font/package.json'),
));
const distDir = path.join(cwd, 'dist');

await fs.rm(path.join(cwd, 'dist'), { recursive: true, force: true });

let start = performance.now();
await bundle(
  path.resolve(nextFontDir, 'fontkit.js'),
  Object.assign({}, config, {
    cwd: import.meta.dirname,
    file: path.join('dist', 'fontkit.js'),
    pkg: {
      exports: {},
    },
    _callbacks: {
      onBuildEnd() {
        console.log(`Built fontkit [${performance.now() - start}ms]`);
      },
    },
  }),
);

const files = await glob('src/**/*.ts', {
  cwd: nextFontDir,
  ignore: ['src/**/*.test.ts'],
});

const exports = Object.fromEntries(
  files.map((file) => {
    const noSrc = path.relative('src', file);
    const ext = (ext: string) =>
      path.join(
        path.relative(
          nextFontDir,
          path.join(distDir, noSrc.replace(/\.ts$/, ext)),
        ),
      );

    return [
      `./${noSrc.replace(/\.ts$/, '')}`,
      {
        import: ext('.js'),
        types: ext('.d.ts'),
      },
    ];
  }),
);

start = performance.now();
await bundle(
  '',
  Object.assign({}, config, {
    cwd: nextFontDir,
    pkg: {
      types: undefined,
      exports,
    },
    _callbacks: {
      async onBuildEnd(a) {
        console.log(JSON.stringify(a, null, 2));
        console.log(`Built @next/font [${performance.now() - start}ms]`);
      },
    },
  }),
);
