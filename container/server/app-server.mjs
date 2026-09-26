import fs from 'fs'
import { spawnSync } from 'child_process'
import path from 'path'

const serverconfigFile = path.join(import.meta.dirname, './serverconfig.json')

if (!fs.existsSync(serverconfigFile)) {
	throw `missing serverconfig.json: did you forget to mount?`
}

const serverconfigData = fs.readFileSync(serverconfigFile, 'utf8')
const serverconfig = JSON.parse(serverconfigData)

// Do not rewrite the mounted serverconfig.json, which may be read-only or not writable by the
// container user. Instead, pass the derived values to the server, which applies them as if these
// were in serverconfig.json, see server/src/serverconfig.js.
const overrides = { backend_only: true }

if (!serverconfig.genomes) {
	overrides.genomes = [
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

// the server package must be imported only after this env variable is set,
// since the serverconfig is processed when the server package is first imported
process.env.PP_SERVERCONFIG_OVERRIDES = JSON.stringify(overrides)

// TODO: may re-enable support for serverconfig.releaseTag, will require replacing launch from update @sjcrh/proteinpaint-server,
//       but it may be better to do npm re-installss with a docker build on top of ppserver instead of this hack
// if (serverconfig.releaseTag && serverconfig.releaseTag.server) {
// 	console.log('Updating proteinpaint server package ...')
// 	const serverInstall = spawnSync('npm', ['install', `@sjcrh/proteinpaint-server@${serverconfig.releaseTag.server}`], {
// 		encoding: 'utf-8',
// 		stdio: 'inherit'
// 	})
// 	if (serverInstall.error) throw serverInstall.error
// 	if (serverInstall.status !== 0) {
// 		throw new Error(`Server package installation failed with status ${serverInstall.status}`)
// 	}
// }

console.log('starting the server ...')
const { launch } = await import('@sjcrh/proteinpaint-server')
launch()
