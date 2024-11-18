import { build } from 'esbuild'
//import UnpluginTypia from '@ryoppippi/unplugin-typia/esbuild'
import path from 'path'

const __dirname = import.meta.dirname
const outdir = path.join(__dirname, process.argv[2] || './dist')

const opts = {
	entryPoints: ['./dist/*.ts'],
	bundle: true,
	platform: 'browser',
	format: 'esm',
	outdir,
	splitting: true
}

build(opts)

//const typiaPlugin = UnpluginTypia({cache: true})

// function splitTypiaPlugin() {
//   const importTypia = `var import_typia = __toESM(require_lib3(), 1);`
//   let importTypiaStart, importTypiaStop
//   return {
//     name: 'splitTypiaPlugin',

//     setup(build) {
//       build.onLoad({ filter: /\.ts$/ }, async ({path: filePath}) => {
//         const results = await typiaPlugin.setup(build); console.log(38, results)
//         if (!results) return
//         // if (!importTypiaStart) {
//         //   importTypiaStart = results.contents.indexOf(importTypia)
//         //   importTypiaStop = importTypiaStart + importTypia.length
//         // }
//         // if (filePath.endsWith('index.ts')) {
//         //   results.contents = results.contents.slice(0, importTypiaStop) +
//         //     `\n\nexport { import_typia }`
//         // } else {
//         //   results.contents = `import { import_typia } from './index.js'\n\n` +
//         //     results.contents.slice(importTypiaStop)
//         // }
//         return results
//       })
//     }
//   }
// }
