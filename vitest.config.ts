import { defineConfig } from 'vite-plus'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
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
