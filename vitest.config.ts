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
      {
        extends: true,
        test: {
          include: [
            'packages/common/tests/**/*.{ts,js}',
            'packages/common/src/**/*.test.{ts,js}',
          ],
        },
      },
      {
        extends: true,
        test: {
          include: [
            'packages/plugin-vite/tests/**/*.{ts,js}',
            'packages/plugin-vite/src/**/*.test.{ts,js}',
          ],
        },
      },
      {
        extends: true,
        test: {
          include: [
            'packages/plugin-rolldown/tests/**/*.{ts,js}',
            'packages/plugin-rolldown/src/**/*.test.{ts,js}',
          ],
        },
      },
    ],
  },
  plugins: [tsconfigPaths()],
})
