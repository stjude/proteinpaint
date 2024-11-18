/* 
	usage: `npx tsx emitCheckers.ts [inputFile]`

	if inputFile is specified, that file will be read and the transformed content will be echoed
	if not, `src/routes` dir will be scanned as input files and the transformed content will be written to 'dist'

  This script is a work-around to not require typia markups in ts src/ files,
  to make it easier for consumer code to import src type definitions without
  having to install typia plugins for a bundler. 

	Instead, this emitter will read the contents of route ts files
	and add the typia checker code that esbuild + plugins could use
	at build time.
*/
import fs from 'fs'
import path from 'path'
import glob from 'glob'
import { execSync } from 'child_process'

const __dirname = import.meta.dirname
const routesDir = './src/routes'
const cwd = path.join(__dirname, routesDir)
const inputFile = process.argv[2]
const files = inputFile ? [inputFile.replace(cwd, '')] : glob.sync('*.ts', { cwd })
const uniquesTypeIds = new Set()
const transitiveExports: string[] = []
// const exportCheckers: string[] = []

for (const f of files) {
	const importLines = [`import { createValidate } from 'typia'`]
	const exportPayloads: string[] = []
	const exportCheckers: string[] = []
	const _ = await import(`${routesDir}/${f}`)
	for (const [key, val] of Object.entries(_)) {
		if (!key.endsWith('Payload')) continue
		exportPayloads.push(`export { ${key} } from '../src/routes/${f}'`)
		const { request, response } = val as any
		const typeIds = [request?.typeId, response?.typeId].filter(t => t != undefined)
		if (!typeIds.length) continue
		importLines.push(`import type { ${typeIds.join(', ')} } from '../src/routes/${f}'`)
		for (const typeId of typeIds) {
			if (!typeId || uniquesTypeIds.has(typeId)) continue
			uniquesTypeIds.add(typeId)
			exportCheckers.push(`export const valid${typeId} = createValidate<${typeId}>()`)
		}
	}

	if (exportPayloads.length || exportCheckers.length) {
		const contents =
			importLines.join('\n') + '\n\n' + exportPayloads.join('\n') + '\n\n' + exportCheckers.join('\n') + '\n'
		const outfile = path.join(__dirname, `./checkers/${f}`)
		fs.writeFileSync(outfile, contents, { encoding: 'utf8' })
		transitiveExports.push(`export * from './${f}'`)
	}
}

if (transitiveExports.length) {
	const contents = transitiveExports.join('\n')
	const outfile = path.join(__dirname, `./checkers/index.js`)
	fs.writeFileSync(outfile, contents, { encoding: 'utf8' })
}

execSync(`npx prettier ./checkers/*.ts  --no-semi --use-tabs --write`)
