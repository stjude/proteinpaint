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

const __dirname = import.meta.dirname
const routesDir = './src/routes'
const cwd = path.join(__dirname, routesDir)
const distDir = path.join(__dirname, './dist')
const inputFile = process.argv[2]
const files = inputFile ? [inputFile.replace(cwd, '')] : glob.sync('*.ts', { cwd })
const uniquesTypeIds = new Set()

for (const f of files) {
	const jsfile = `${routesDir}/${f}`
	const _ = await import(jsfile)
	const validatorExports: any[] = []
	for (const [key, val] of Object.entries(_)) {
		if (!key.endsWith('Payload')) continue
		const { request, response } = val as any
		for (const typeId of [request?.typeId, response?.typeId]) {
			if (!typeId || uniquesTypeIds.has(typeId)) continue
			uniquesTypeIds.add(typeId)
			validatorExports.push(`export const valid${typeId} = createValidate<${typeId}>()`)
		}
	}
	if (!validatorExports.length) continue
	const tsfile = path.join(cwd, f)
	const contents = fs.readFileSync(tsfile).toString('utf-8').trim()
	const modifiedContents = [`import { createValidate } from 'typia'`, contents, '', ...validatorExports, ''].join('\n')

	if (inputFile) console.log(modifiedContents)
	else fs.writeFileSync(path.join(routesDir, f), modifiedContents, { encoding: 'utf8' })
}
