const path = require('path')
const fs = require("fs")
const { build } = require('esbuild')
const { polyfillNode } = require('esbuild-plugin-polyfill-node')
const { execSync } = require('child_process')

execSync(`node ${__dirname}/emitImports.mjs > ${__dirname}/test/internals.js`)

build({
	entryPoints: ['./src/app.js', './test/internals.js'],
	bundle: true,
	platform: 'browser',
	outdir: path.join(__dirname, './dist'),
	//chunkNames: '[hash].app',
	sourcemap: true,
	splitting: true,
	format: 'esm',
	//external: ['*.spec.js'],
	plugins: [
    replaceNodeBuiltIns(),
    dirnamePlugin()
  ]
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

function dirnamePlugin () {
  const filter = new RegExp(/^(?:.*[\\\/])?node_modules(?:[\\\/].*)?$/) // /.*/
  return {
    name: "dirnamePlugin",

    setup(build) {
      build.onLoad({ filter }, ({ path: _filePath }) => {
          const fileExt = _filePath.split('.').pop()
          let filePath = _filePath
          if (!fileExt.endsWith('js') && !fileExt.endsWith('ts')) {
            if (fs.existsSync(filePath + '.js')) filePath += '.js'
            if (fs.existsSync(filePath + '.js')) filePath += '.ts'
          }
        if (filePath.includes('/tape/')) {
          let contents = fs.readFileSync(filePath, "utf8")
          const loader = path.extname(filePath).substring(1)
          const dirname = path.dirname(filePath);
          contents = contents
            .replace("__dirname", `"${dirname}"`)
            .replace("__filename", `"${filePath}"`);
          return {
            contents,
            loader,
          };
        }
      });
    },
  }
}
