import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      release: {
        cache: false,
      },
    },
    cache: {
      scripts: true,
      tasks: true,
    },
  },
  fmt: {
    $schema: './node_modules/oxfmt/configuration_schema.json',
    ignorePatterns: ['.changeset/**'],
    endOfLine: 'lf',
    printWidth: 80,
    singleQuote: true,
    trailingComma: 'es5',
    semi: false,
  },
  lint: {
    ignorePatterns: ['dist/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    plugins: [
      'typescript',
      'unicorn',
      'oxc',
      'import',
      'vitest',
      'node',
      'promise',
    ],
    categories: {
      perf: 'warn',
    },
    rules: {
      'unicorn/prefer-node-protocol': 'error',
      'no-duplicate-imports': 'error',
      'sort-imports': 'error',
      'import/no-cycle': ['error', { maxDepth: 3 }],
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
