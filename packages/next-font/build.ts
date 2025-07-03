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
const nextFontDir = path.dirname(
  import.meta.resolve('@vercel/next.js/packages/font/package.json'),
);
const nextFontDirPath = Bun.fileURLToPath(nextFontDir);
const distDir = path.join(cwd, 'dist');

await fs.rm(path.join(cwd, 'dist'), { recursive: true, force: true });

let start = performance.now();
await bundle(
  path.resolve(nextFontDirPath, 'fontkit.js'),
  Object.assign({}, config, {
    cwd: process.cwd(),
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

console.log('nextFontDir', nextFontDir)
console.log('files', files)


const exports = Object.fromEntries(
  files.map((file) => {
    const noSrc = path.relative('src', file);
    const ext = (ext: string) =>
      path.join(
        path.relative(
          nextFontDirPath,
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

console.log(exports);
throw new Error('stop');

start = performance.now();
await bundle(
  '',
  Object.assign({}, config, {
    cwd: nextFontDirPath,
    pkg: {
      types: undefined,
      exports,
    },
    _callbacks: {
      async onBuildEnd() {
        console.log(`Built @next/font [${performance.now() - start}ms]`);
      },
    },
  }),
);
