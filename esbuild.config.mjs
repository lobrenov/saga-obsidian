import { builtinModules } from 'node:module'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import esbuild from 'esbuild'

const watch = process.argv[2] === 'watch'
const vaultPlugin = 'test/vault/.obsidian/plugins/saga'

/** Writes `manifest.json` and `styles.css` (esbuild's `main.css`, or empty) to the root and the test vault plugin folder, and `main.js` to the vault. */
const publish = {
  name: 'publish',
  setup(build) {
    build.onEnd(async () => {
      if (!existsSync('main.css')) await writeFile('main.css', '')
      await copyFile('main.css', 'styles.css')
      await mkdir(vaultPlugin, { recursive: true })
      for (const file of ['main.js', 'styles.css', 'manifest.json']) await copyFile(file, `${vaultPlugin}/${file}`)
    })
  }
}

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  jsx: 'automatic',
  alias: { react: 'preact/compat', 'react-dom': 'preact/compat' },
  outfile: 'main.js',
  format: 'cjs',
  target: 'es2022',
  platform: 'browser',
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  treeShaking: true,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  plugins: [publish]
})

if (watch) await context.watch()
else {
  await context.rebuild()
  await context.dispose()
}
