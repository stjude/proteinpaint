const path = require('path')
const { build } = require('esbuild')
const { polyfillNode } = require('esbuild-plugin-polyfill-node')
const { execSync } = require('child_process')

execSync(`node ${__dirname}/emitImports.mjs > ${__dirname}/test/internals.js`)

build({
	entryPoints: ['./src/app.js'],
	bundle: true,
	platform: 'browser',
	outdir: path.join(__dirname, './dist'),
	//chunkNames: '[hash].app',
	sourcemap: true,
	splitting: true,
	format: 'esm',
	//external: ['*.spec.js'],
	plugins: [replaceNodeBuiltIns()]
})

function replaceNodeBuiltIns() {
  // NOTE: These polyfills are installed by node-polyfill-webpack-plugin,
  // and will still be required as devDependencies after removing webpack 
  // and its plugins post-esbuild migration
  const replace = {
    path: require.resolve('path-browserify'),
    stream: require.resolve('stream-browserify'),
    // 'fs': require.resolve('./src/fs.cjs'),
    // 'util': require.resolve('./src/util.cjs'),
    // 'url': require.resolve('url/'),
  }
  const filter = RegExp(`^(${Object.keys(replace).join('|')})$`)
  return {
    name: 'replaceNodeBuiltIns',
    setup(build) {
      build.onResolve({ filter }, arg => ({
        path: replace[arg.path]
      }))
    }
  }
}
