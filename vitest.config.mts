import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const alias = {
  obsidian: fileURLToPath(new URL('./test/fakes/obsidian.ts', import.meta.url)),
  react: 'preact/compat',
  'react-dom': 'preact/compat'
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          typecheck: { enabled: true, tsconfig: 'tsconfig.test.json', include: ['test/unit/**/*.test-d.ts'] }
        }
      },
      {
        resolve: { alias },
        test: {
          name: 'component',
          globalSetup: ['test/component/bundle.setup.ts'],
          setupFiles: ['test/fakes/dom.ts'],
          sequence: { groupOrder: 1 },
          include: ['test/component/**/*.test.tsx'],
          typecheck: { include: [] },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium', viewport: { width: 1280, height: 800 } }]
          }
        }
      }
    ]
  }
})
