import path from 'path'
import fs from 'fs'
import { context } from 'esbuild'
import { polyfillNode } from "esbuild-plugin-polyfill-node"
import notifier from 'node-notifier'
import serverconfig from '../server/src/serverconfig.js'
    
const __dirname = import.meta.dirname
const ENV = process.env.ENV

const entryPoints = ['./src/app.js']
if (ENV != 'prod') entryPoints.push(`./test/internals-${ENV}.js`)

const outdir = path.join(__dirname, ENV == 'test' ? '../public/bin/test' : './dist')

const libReplacers = ENV == 'dev'  
  ? [nodeLibToBrowser()]
  : ENV == 'test'
  ? [polyfillNode(), nodeLibToBrowser()]
  : []

const ctx = await context({
	entryPoints,
	bundle: true,
	platform: 'browser',
  // - in dev, there is an existing public/dist -> client/dist symlink 
  //   to ensure that the same bundle is used for locally-developed 
  //   embedder portals like GFF
  // - for CLI tests such as in CI, the bundles can be outputted directly
  //   to the test runner's static (public) dir  
	outdir,
  outbase: 'src',
	//chunkNames: '[hash].app', // TODO: enable for prod build?
	sourcemap: true,
	splitting: true,
	format: 'esm',
	plugins: [
    ...libReplacers,
    dirnamePlugin(),
    cssLoader(),
    logRebuild()
  ],
  logLevel: 'warning'
})

if (ENV == 'dev') {
  console.log('watching files ...')
  await ctx.watch()
} else {
  ctx.rebuild()
}

function logRebuild() {
  const messagesDir = path.join(serverconfig.sseDir, 'messages')
  return {
    name: 'logBuildStage',
    setup({ onStart, onEnd }) {
      let t, numErrs

      onStart(() => {
        console.log('\n--- starting client rebuild... ---\n')
        t = Date.now()
      })
      onEnd((result) => { 
        if (ENV == 'dev') {
          if (result.errors.length) {
            numErrs = result.errors.length
            const message = `${numErrs} esbuild error(s)`
            notifier.notify({title: 'client', message})
            const data = JSON.stringify({
              key: 'client',
              message,
              color: 'red'
            })
            fs.promises.writeFile(`${messagesDir}/client`, data)
          } else /*if (numErrs)*/ {
            numErrs = 0
            const message = 'success, esbuild ok'
            // only notify of success if recovering from a bundling error
            notifier.notify({title: 'client', message})
            const data = JSON.stringify({
              key: 'client',
              message,
              status: 'ok',
              color: 'green',
              duration: 2500,
              reload: true
            })
            fs.promises.writeFile(`${messagesDir}/client`, data)
          }
        }
        console.log('\n--- client rebuild finished in', Date.now() - t, 'ms ---\n')
        if (ENV != 'dev') ctx.dispose()
      })
    }
  }
}

function nodeLibToBrowser() {
  // NOTE: These polyfills are installed by node-polyfill-webpack-plugin,
  // and will still be required as devDependencies after removing webpack 
  // and its plugins post-esbuild migration
  const replace = ENV == 'test' 
    ? {
      tape: import.meta.resolve('./test/tape.bundle.js').replace('file://', '')
    } 
    : ENV == 'dev' 
    ? {
      path: import.meta.resolve('path-browserify').replace('file://', ''),
      stream: import.meta.resolve('stream-browserify').replace('file://', ''),
    }
    : {}

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
