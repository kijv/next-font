import { defineConfig } from 'vite-plus'
import tsdownConfig from './tsdown.config.js'

export default defineConfig({
  pack: tsdownConfig,
  lint: {
    $schema: './node_modules/oxlint/configuration_schema.json',
    extends: ['../../.oxlintrc.json'],
    categories: {
      correctness: 'warn',
    },
    rules: {
      'eslint/no-unused-vars': 'error',
      'eslint/no-console': [
        'error',
        {
          allow: ['error', 'warn'],
        },
      ],
    },
  },
})
