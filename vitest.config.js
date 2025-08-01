import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        name: 'next-font',
        test: {
          include: ['packages/next-font/tests/**/*.{ts,js}'],
        },
      },
      {
        extends: true,
        name: 'plugin-vite',
        test: {
          include: ['packages/plugin-vite/tests/**/*.{ts,js}'],
        },
      },
    ],
  },
  plugins: [tsconfigPaths()],
})
