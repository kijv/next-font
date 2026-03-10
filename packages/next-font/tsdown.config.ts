import { builtinModules } from 'node:module'
import { defineConfig } from 'tsdown'

const IS_WORKFLOW = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  publint: IS_WORKFLOW ? false : true,
  attw: {
    profile: 'esm-only',
    level: 'error',
  },
  platform: 'node',
  entry: [
    'src/{index,local,manifest}.ts',
    'src/google/index.ts',
    'src/{rolldown,vite}.ts',
  ],
  dts: {
    oxc: true,
  },
  shims: true,
  deps: {
    neverBundle: ['@jridgewell/sourcemap-codec', 'rolldown', 'vite'].concat(
      builtinModules.concat(builtinModules.map((mod) => `node:${mod}`))
    ),
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
