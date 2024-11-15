import { build, context } from 'esbuild'
import UnpluginTypia from '@ryoppippi/unplugin-typia/esbuild'
import path from 'path'

const __dirname = import.meta.dirname
const ENV = process.env.ENV || 'prod'

const opts = {
	entryPoints: ['./src/checkers/*.ts'],
	bundle: true,
	platform: 'browser',
	format: 'esm',
	outdir: path.join(__dirname, './dist'),
	splitting: true,
	plugins: [
		//splitTypiaPlugin(),
		UnpluginTypia({ cache: true })
	]
}

if (ENV == 'dev') {
	console.log('watching files ...')
	const ctx = await context(opts)
	await ctx.watch()
} else {
	build(opts)
}

// const typiaPlugin = UnpluginTypia({cache: true})

// function splitTypiaPlugin() {
//   const importTypia = `var import_typia = __toESM(require_lib3(), 1);`
//   let importTypiaStart, importTypiaStop
//   return {
//     name: 'splitTypiaPlugin',

//     setup(build) {
//       build.onLoad({ filter: /\.ts$/ }, async ({path: filePath}) => {
//         const results = await typiaPlugin.setup(build); console.log(38, results)
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
