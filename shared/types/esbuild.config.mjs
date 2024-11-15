import { build, context } from 'esbuild'
import UnpluginTypia from '@ryoppippi/unplugin-typia/esbuild'
import path from 'path'

const __dirname = import.meta.dirname
const ENV = process.env.ENV || 'prod'

const opts = {
	entryPoints: ['./src/checkers/routes.ts'],
	bundle: true,
	platform: 'browser',
	format: 'esm',
	outdir: path.join(__dirname, './dist'),
	plugins: [
		//addValidatorPlugin(),
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
