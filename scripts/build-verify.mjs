import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

/**
 * Bundles the verification suite for plain Node.
 *
 * Electron is stubbed, and Vite's `?raw` suffix is resolved by hand so the
 * persona markdown files load exactly as they do in the real build.
 */
const rawMarkdown = {
  name: 'raw-markdown',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /\.md\?raw$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw-md'
    }))

    pluginBuild.onLoad({ filter: /.*/, namespace: 'raw-md' }, async (args) => ({
      contents: await readFile(args.path, 'utf8'),
      loader: 'text',
      resolveDir: dirname(args.path)
    }))
  }
}

await build({
  entryPoints: ['scripts/verify.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'out/verify.mjs',
  logLevel: 'error',
  plugins: [rawMarkdown],
  alias: {
    electron: resolve('scripts/electron-stub.ts'),
    '@shared': resolve('src/shared')
  }
})
