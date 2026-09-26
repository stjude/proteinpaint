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
const overrides = { backend_only: false }

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
//       but it may be better to do npm re-installss with a docker build on top of ppfull instead of this hack
// if (serverconfig.releaseTag) {
// 	if (!serverconfig.releaseTag.server || !serverconfig.releaseTag.front) {
// 		throw 'Error: If the serverconfig.releaseTag option is used, then both {server, front} must be specified when running the full app.'
// 	}
// 	console.log('Updating proteinpaint server package ...')
// 	const serverInstall = spawnSync('npm', ['install', `@sjcrh/proteinpaint-server@${serverconfig.releaseTag.server}`], {
// 		encoding: 'utf-8',
// 		stdio: 'inherit'
// 	})
// 	if (serverInstall.error) throw serverInstall.error
// 	if (serverInstall.status !== 0) {
// 		throw new Error(`Server package installation failed with status ${serverInstall.status}`)
// 	}

// 	console.log('Updating proteinpaint front package ...')
// 	const frontInstall = spawnSync('npm', ['install', `@sjcrh/proteinpaint-front@${serverconfig.releaseTag.front}`], {
// 		encoding: 'utf-8',
// 		stdio: 'inherit'
// 	})
// 	if (frontInstall.error) throw frontInstall.error
// 	if (frontInstall.status !== 0) {
// 		throw new Error(`Front package installation failed with status ${frontInstall.status}`)
// 	}
// }

// NOTES: Restored support for
// - The environment variable that's supported in server/src/serverconfig.js is process.env.PP_URL,
//   so process.env.URL is likely a legacy requirement when running very old ppfull containers, but now
//   should always be done directly through serverconfig.URL or via override with process.env.PP_URL.
// - serverconfig.url is similar, it is not handled in serverconfig.js or documented, it's potentially
//   a legacy environment-specific fix.
if (!serverconfig.URL) serverconfig.URL = process.env.URL || serverconfig.url || '.'

// No URL is passed to bundle generation: webpack's output.publicPath is 'auto', so the client derives
// its /bin/ base path at runtime from the <script> tag it was loaded from (see front/webpack.config.js
// and front/init.js). This container therefore serves the same bundle regardless of the mount URL.
console.log(`generating the client bundle (bin/)`)
const publicBinOnly = process.argv.includes('--publicBinOnly')
const result = spawnSync('npx', ['proteinpaint-front', ...(publicBinOnly ? ['--publicBinOnly'] : [])], {
	encoding: 'utf-8',
	stdio: 'inherit'
})
if (result.stderr) {
	console.warn(result.stderr)
}
if (result.status !== 0) {
	console.error(`Process exited with non-zero status code: ${result.status}`)
	process.exit(1)
}
// the npx command above (proteinpaint-front) generates the client bundle into ./bin (this container's
// own bin, served at /bin; see front/init.js), owned by the container user that also runs the server

console.log('starting the server ...')
const { launch } = await import('@sjcrh/proteinpaint-server')
launch()
