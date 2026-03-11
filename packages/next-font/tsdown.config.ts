import { builtinModules } from 'node:module'
import { defineConfig } from 'tsdown'

export default defineConfig({
  /*
  publint: true,
  attw: {
    profile: 'esm-only',
    level: 'error',
  },
  */
  platform: 'node',
  entry: [
    'src/{index,local,manifest}.ts',
    'src/google/index.ts',
    'src/{rolldown,vite,vite-rolldown}.ts',
  ],
  dts: {
    oxc: true,
  },
  shims: true,
  deps: {
    neverBundle: [
      '@jridgewell/sourcemap-codec',
      'rolldown',
      'vite',
      'vite-rolldown',
    ].concat(builtinModules.concat(builtinModules.map((mod) => `node:${mod}`))),
    alwaysBundle: ['fontkit'],
    onlyAllowBundle: [
      '@capsizecss/metrics',
      '@rolldown/pluginutils',
      'estree-walker',
      'stable-hash',
      'fontkit',
      // fontkit deps
      'restructure',
      '@swc/helpers',
      'tslib',
      'fast-deep-equal',
      'base64-js',
      'tiny-inflate',
      'unicode-trie',
      'unicode-properties',
      'dfa',
      'brotli',
      'clone',
    ],
  },
})
