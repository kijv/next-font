import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          include: [
            'packages/*/tests/**/*.{ts,js}',
            'packages/*/src/**/*.test.{ts,js}',
          ],
        },
      },
    ],
  },
})
