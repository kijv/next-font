import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        name: 'next-font',
        test: {
          include: [
            'packages/next-font/tests/**/*.{ts,js}',
            'packages/next-font/src/**/*.test.{ts,js}',
          ],
        },
      },
    ],
  },
  plugins: [tsconfigPaths()],
})
