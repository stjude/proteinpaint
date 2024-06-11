import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { context } from 'esbuild'
import { fileURLToPath } from 'url'
    
const __dirname = path.dirname(fileURLToPath(import.meta.url)) 
execSync(`node ${__dirname}/emitImports.mjs > ${__dirname}/test/internals-esm.js`)

const ctx = await context({
	entryPoints: [
    //'./src/style-normalize-unscoped.css', // TODO: this is supposed to prevent duplicate css files, not working
    './src/app.js', 
    './test/internals-esm.js' // TODO: do not include in prod build, once esbuild replaces rollup
  ],
	bundle: true,
	platform: 'browser',
	outdir: path.join(__dirname, './dist'),
  outbase: 'src',
	//chunkNames: '[hash].app', // TODO: enable for prod build?
	sourcemap: true,
	splitting: true,
	format: 'esm',
	plugins: [
    replaceNodeBuiltIns(),
    dirnamePlugin(),
    cssLoader(),
    logRebuild()
  ],
  logLevel: 'error' // !!! TODO: also show warnings !!!
})

console.log('watching files ...')
await ctx.watch()

function logRebuild() {
  return {
    name: 'logBuildStage',
    setup({ onStart, onEnd }) {
      var t
      onStart(() => {
        console.log('\n--- starting client rebuild... ---\n')
        t = Date.now()
      })
      onEnd(() => {
        console.log('\n--- client rebuild finished in', Date.now() - t, 'ms ---\n')
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
    // 'url': path.resolve('url/')
  }
  const filter = RegExp(`^(${Object.keys(replace).join('|')})$`)
  return {
    name: 'replaceNodeBuiltIns',
    setup(build) {
      build.onResolve({ filter }, arg => {
        return {
          path: replace[arg.path]
        }
      }) 
    }
  }
}

function dirnamePlugin() {
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

function cssLoader() {
  return {
    name: 'cssLoader',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const css = fs.readFileSync(args.path, 'utf8');
        const contents = `
          const styles = new CSSStyleSheet();
          styles.replaceSync(\`${css.replaceAll(/[`$]/gm, '\\$&')}\`);
          document.adoptedStyleSheets.push(styles)
        `;
        return { contents };
      });
    }
  }
}