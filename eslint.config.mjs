import js from '@eslint/js'
import { builtinModules } from 'node:module'
import tseslint from 'typescript-eslint'

// Node builtins, both bare (`fs`) and prefixed (`node:fs`).
const nodeBuiltins = builtinModules

export default tseslint.config(
  { ignores: ['main.js', 'styles.css', 'main.css', 'test/vault/**', 'dist/**', 'coverage/**', 'node_modules/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.shared.json', './tsconfig.plugin.json', './tsconfig.test.json', './tsconfig.component.json'],
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  },
  { files: ['**/*.mjs'], ...tseslint.configs.disableTypeChecked },
  { files: ['esbuild.config.mjs'], languageOptions: { globals: { console: 'readonly', process: 'readonly' } } },

  // `src/shared` is plain TypeScript: no Obsidian, React, DOM-specific or Node modules, no imports from the rest of `src`.
  {
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['node:*', 'obsidian', 'react', 'react/*', 'react-dom', 'react-dom/*', '@codemirror/*', '@lezer/*', 'electron', '**/obsidian/**', '**/map/**', '**/header/**', '**/settings/**', '**/main'],
          paths: nodeBuiltins.map((name) => ({ name }))
        }
      ]
    }
  }
)
