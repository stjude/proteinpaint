import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { context } from 'esbuild'
import { fileURLToPath } from 'url'
    
const __dirname = path.dirname(fileURLToPath(import.meta.url)) 
execSync(`node ${__dirname}/emitImports.mjs > ${__dirname}/test/internals.js`)

const ctx = await context({
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
    dirnamePlugin(),
    logRebuild()
  ],
  logLevel: 'error' // !!! TODO: also show warnings !!!
});

console.log('watching files ...')
await ctx.watch()

function logRebuild() {
  return {
    name: 'logBuildStage',
    setup({ onStart, onEnd }) {
      var t
      onStart(() => {
        t = Date.now()
      })
      onEnd(() => {
        console.log('rebuild finished in', Date.now() - t, 'ms')
      })
    }
  }
}

function replaceNodeBuiltIns() {
  // NOTE: These polyfills are installed by node-polyfill-webpack-plugin,
  // and will still be required as devDependencies after removing webpack 
  // and its plugins post-esbuild migration
  const replace = {
    path: import.meta.resolve('path-browserify').replace('file://', ''),
    stream: import.meta.resolve('stream-browserify').replace('file://', ''),
    // 'fs': path.resolve('./src/fs.cjs'),
    // 'util': path.resolve('./src/util.cjs'),
    // 'url': path.resolve('url/'),
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
