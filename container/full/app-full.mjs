import fs from 'fs'
import { spawnSync } from 'child_process'
import path from 'path'
import { launch } from '@sjcrh/proteinpaint-server'

const serverconfigFile = path.join(import.meta.dirname, './serverconfig.json')

if (!fs.existsSync(serverconfigFile)) {
	throw `missing serverconfig.json: did you forget to mount?`
}

const serverconfigData = fs.readFileSync(serverconfigFile, 'utf8')
const serverconfig = JSON.parse(serverconfigData)

if (!serverconfig.genomes) {
	serverconfig.genomes = [
		{
			name: 'hg19',
			species: 'human',
			file: './genome/hg19.js',
			datasets: [
				{
					name: 'ClinVar',
					jsfile: './dataset/clinvar.hg19.js'
				}
			]
		},
		{
			name: 'hg38',
			species: 'human',
			file: './genome/hg38.js',
			datasets: [
				{
					name: 'ClinVar',
					jsfile: './dataset/clinvar.hg38.js'
				}
			]
		}
	]
}

serverconfig.backend_only = false
// TODO: app-full.mjs (and app-server.mjs) should have NO side effects on mounted artifacts except
// active/public. This writeback mutates the mounted serverconfig.json, which forces that bind mount to
// be read-write — a :ro mount makes this fail with EROFS and crashes the container at startup (the
// releaseRollout healthgate then times out and rolls back a good release; see its validate.js guard
// against a :ro serverconfig mount). Prefer passing the derived values (backend_only, and the default
// genomes above) to launch() directly, or via process.env, so the server picks them up without
// rewriting serverconfig.json on disk.
fs.writeFileSync('./serverconfig.json', JSON.stringify(serverconfig, null, '   '), { charset: 'utf8' })

if (serverconfig.releaseTag) {
	if (!serverconfig.releaseTag.server || !serverconfig.releaseTag.front) {
		throw 'Error: If the serverconfig.releaseTag option is used, then both {server, front} must be specified when running the full app.'
	}

	console.log('Updating proteinpaint server package ...')
	spawnSync('npm', ['install', `"@sjcrh/proteinpaint-server@${serverconfig.releaseTag.server}"`], { encoding: 'utf-8' })

	console.log('Updating proteinpaint front package ...')
	spawnSync('npm', ['install', `"@sjcrh/proteinpaint-front@${serverconfig.releaseTag.front}"`], { encoding: 'utf-8' })
}

if (!serverconfig.URL) serverconfig.URL = process.env.URL || serverconfig.url || '.'

console.log(`generating public/bin for ${serverconfig.URL}`)
const publicBinOnly = process.argv.includes('--publicBinOnly')
const result = spawnSync(
	'npx',
	['proteinpaint-front', serverconfig.URL, publicBinOnly ? '--publicBinOnly' : 'allPublic'],
	{
		encoding: 'utf-8'
	}
)
if (result.stderr) {
	console.warn(result.stderr)
}
if (result.status !== 0) {
	console.error(`Process exited with non-zero status code: ${result.status}`)
	process.exit(1)
}
// since the npx command generated non-root owned js files inside the public/bin folder , we need to change the owner of the folder and files to root
spawnSync('chown', ['-R', 'root:root', './public/bin'], { encoding: 'utf8' })

console.log('starting the server ...')
launch()
