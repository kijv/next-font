import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  deps: {
    neverBundle: ['vite', 'postcss', 'next-font', 'rollup'],
  },
});
