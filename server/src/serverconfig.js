/*
	Detect and process the server configuration file,
	including generating and applying overrides as needed
*/

const fs = require('fs')
const path = require('path')

// do not assume that serverconfig.json is in the same dir as server.js
// for example, when using proteinpaint as an npm module or binary
const serverconfigfile = (process.cwd() || __dirname) + '/serverconfig.json'

/*******************
 GET SERVERCONFIG
********************/

let serverconfig
if (fs.existsSync(serverconfigfile)) {
	try {
		// manually parse instead of require() to minimize
		// bundling warnings or errors between test/prod builds
		const configstr = fs.readFileSync(serverconfigfile, { encoding: 'utf8' })
		serverconfig = JSON.parse(configstr)
	} catch (e) {
		throw `Error reading or parsing ${serverconfigfile}:` + e
	}
} else {
	// automatically generate serverconfig, hardcoded by customer
	if (process.env.PP_CUSTOMER == 'gdc') {
		serverconfig = getGDCconfig()
	} else {
		throw 'missing serverconfig.json'
	}
}

// this default port may be overwritten when using a Docker container
if (!serverconfig.port) serverconfig.port = process.env.PP_PORT || 3000
// default binary cmd paths
if (!serverconfig.tabix) serverconfig.tabix = 'tabix'
if (!serverconfig.samtools) serverconfig.samtools = 'samtools'
if (!serverconfig.bcftools) serverconfig.bcftools = 'bcftools'
if (!serverconfig.hicstraw) serverconfig.hicstraw = 'straw'
if (!serverconfig.bigwigsummary) serverconfig.bigwigsummary = 'bigWigSummary'
if (!serverconfig.bigBedToBed) serverconfig.bigBedToBed = 'bigBedToBed'
if (!serverconfig.bigBedNamedItems) serverconfig.bigBedNamedItems = 'bigBedNamedItems'
if (!serverconfig.clustalo) serverconfig.clustalo = 'clustalo'

/******************
	APPLY OVERRIDES 
******************/

if (!('allow_env_overrides' in serverconfig) && serverconfig.debugmode) {
	serverconfig.allow_env_overrides = true
}

if (!serverconfig.binpath) {
	const pkfile = process.argv.find(n => n.includes('/build'))
	if (pkfile) {
		serverconfig.binpath = pkfile.split('/build')[0] + '/server'
	} else {
		const specfile = process.argv.find(n => n.includes('.spec.js'))
		if (specfile) {
			serverconfig.binpath = path.dirname(__dirname)
		} else {
			const jsfile = process.argv.find(
				n => n.endsWith('/bin.js') || n.endsWith('/server.js') || n.endsWith('/proteinpaint')
			)
			if (jsfile) {
				try {
					const realpath = fs.realpathSync(jsfile)
					serverconfig.binpath = path.dirname(realpath)
				} catch (e) {
					throw e
				}
			} else {
				if (fs.existsSync('./server')) serverconfig.binpath = fs.realpathSync('./server')
				else if (fs.existsSync('./src')) serverconfig.binpath = fs.realpathSync('./src/..')
				else if (__dirname.includes('/server/')) serverconfig.binpath = __dirname.split('/server/')[0] + '/server'
				else throw 'unable to determine the serverconfig.binpath'
			}
		}
	}
}

if (serverconfig.debugmode) {
	// only apply optional routeSetters in debugmode
	const routeSetters = []
	const defaultDir = path.join(serverconfig.binpath, 'src/test/routes')
	// will add testing routes as needed and if found, such as in dev environment
	const testRouteSetters = ['gdc.js', 'specs.js']

	if (serverconfig.routeSetters) {
		for (const f of serverconfig.routeSetters) {
			if (testRouteSetters.includes(f)) continue // will set in the next for-of block, to avoid duplicate entry
			if (fs.existsSync(f)) {
				routeSetters.push(f)
			} else if (fs.existsSync(`${defaultDir}/${f}`)) {
				routeSetters.push(`${defaultDir}/${f}`)
			} else {
				const absf = path.join(serverconfig.binpath, f)
				if (fs.existsSync(absf)) routeSetters.push(absf)
			}
		}
	}

	for (const f of testRouteSetters) {
		const absf = `${defaultDir}/${f}`
		// avoid duplicate entries; these test route setters should only exist in dev environment and not deployed to prod
		if (!routeSetters.includes(absf) && fs.existsSync(absf)) routeSetters.push(absf)
	}

	// may replace the original routeSetters value,
	// since the serverconfig.binpath prefix may
	// have been applied to locate optional routeSetter files
	serverconfig.routeSetters = routeSetters
}

if (serverconfig.allow_env_overrides) {
	if (process.env.PP_URL) {
		serverconfig.URL = process.env.URL
	}

	if ('PP_BASEPATH' in process.env) {
		serverconfig.basepath = process.env.PP_BASEPATH
	}

	if (process.env.PP_MODE && process.env.PP_MODE.startsWith('container')) {
		// within the container, the Dockerfile uses a pre-determined port and filepaths
		Object.assign(serverconfig, {
			port: 3456,
			tpmasterdir: '/home/root/pp/tp',
			cachedir: '/home/root/pp/cache',
			hicstraw: '/home/root/pp/tools/straw',
			bigwigsummary: '/home/root/pp/tools/bigWigSummary',
			bigBedToBed: '/home/root/pp/tools/bigBedToBed',
			bigBedNamedItems: '/home/root/pp/tools/bigBedNamedItems'
			// note that tabix, samtools, and similar binaries are
			// saved in the usual */bin/ paths so locating them
			// is not needed when calling via Node child_process.spawn() or exec()
		})
	}

	if (fs.existsSync('./.ssl') && !serverconfig.ssl) {
		serverconfig.ssl = {}
		const files = fs.readdirSync('./.ssl')
		for (const filename of files) {
			if (filename.endsWith('.key')) serverconfig.ssl.key = process.cwd() + '/.ssl/' + filename
			if (filename.endsWith('.crt')) serverconfig.ssl.cert = process.cwd() + '/.ssl/' + filename
		}
	}

	if ('PP_BACKEND_ONLY' in process.env) {
		serverconfig.backend_only = +process.env.PP_BACKEND_ONLY === 1 || process.env.PP_BACKEND_ONLY === 'true'
	}
}

if (!serverconfig.features) {
	// default to having an empty object value for
	// examples of end-user-accessible features are:
	// mdjsonform: true, healthcheck_keys: ["w", "rs"], etc.
	serverconfig.features = {}
}

if (!serverconfig.examplejson) {
	serverconfig.examplejson = path.join(serverconfig.binpath, 'features/index.json')
}

if (fs.existsSync('./public/rev.txt')) {
	const revtxt = fs.readFileSync('./public/rev.txt', { encoding: 'utf8' })
	const commitHash = revtxt.trim().split(' ')[1]
	if (commitHash) serverconfig.commitHash = commitHash
}

//Object.freeze(serverconfig)
module.exports = serverconfig

/*****************
  HELPERS
******************/

function getGDCconfig() {
	return {
		allow_env_overrides: true,
		URL: process.env.PP_URL || '', // will be used for the publicPath of dynamically loaded js chunks
		port: process.env.PP_PORT || 3000, // will be used to publish the express node server
		genomes: [
			{
				name: 'hg38',
				species: 'human',
				file: './genome/hg38.gdc.js',
				datasets: [
					{
						name: 'GDC',
						jsfile: './dataset/gdc.hg38.js' // to-do: toggle between dev, prod versions
					}
				]
			}
		],
		backend_only: true
		/**** 
			ASSUMES THAT THE GDC-PP WILL RUN INSIDE A DOCKER CONTAINER,
			see above where the serverconfig.port, tpmasterdir, etc 
			are assigned or overriden
		****/
	}
}
