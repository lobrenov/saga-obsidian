import { execFileSync } from 'node:child_process'

/** Builds `main.js` with the production esbuild config for `bundle.test.tsx`. */
export default function setup(): void {
  execFileSync('node', ['esbuild.config.mjs'], { stdio: 'ignore' })
}
