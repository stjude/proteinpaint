/*
	Detect and process the server configuration file,
	including generating and applying overrides as needed
*/

const fs = require('fs')
const path = require('path')

// do not assume that serverconfig.json is in the same dir as server.js
// for example, when using proteinpaint as an npm module or binary
// or when calling a pp utility script from a tp data directory
const workdirconfig = process.cwd() ? process.cwd() + '/serverconfig.json' : ''
const serverdirconfig = path.join(__dirname, '../serverconfig.json')
const pprootdirconfig = path.join(__dirname, '../../serverconfig.json')
// check which config file exists in order of usage priority
const serverconfigfile =
	workdirconfig && fs.existsSync(workdirconfig)
		? workdirconfig // prioritize a config file as found wherever a pp script is called from
		: fs.existsSync(serverdirconfig)
		? serverdirconfig // or next, use a config file in the pp/server/ dir
		: fs.existsSync(pprootdirconfig)
		? pprootdirconfig // or next, use a config file from the pp root
		: ''

/*******************
 GET SERVERCONFIG
********************/
let serverconfig
if (!serverconfigfile) {
	throw 'missing serverconfig.json'
} else {
	try {
		// manually parse instead of require() to minimize
		// bundling warnings or errors between test/prod builds
		const configstr = fs.readFileSync(serverconfigfile, { encoding: 'utf8' })
		serverconfig = JSON.parse(configstr)
	} catch (e) {
		throw `Error reading or parsing ${serverconfigfile}:` + e
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
if (!serverconfig.bigBedInfo) serverconfig.bigBedInfo = 'bigBedInfo'
if (!serverconfig.bigBedNamedItems) serverconfig.bigBedNamedItems = 'bigBedNamedItems'
if (!serverconfig.clustalo) serverconfig.clustalo = 'clustalo'
if (!serverconfig.Rscript) serverconfig.Rscript = 'Rscript'
if (!serverconfig.gfServer) serverconfig.gfServer = 'gfServer'
if (!serverconfig.gfClient) serverconfig.gfClient = 'gfClient'

/******************
	APPLY OVERRIDES 
******************/

// allow env overrides unless specifically configured
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
				n =>
					n.endsWith('/bin.js') ||
					n.endsWith('/server.js') ||
					n.endsWith('/proteinpaint') ||
					n.endsWith('/proteinpaint-server')
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
				else if (__dirname.includes('/proteinpaint')) serverconfig.binpath = __dirname
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
	const testRouteSetters = ['gdc.js', 'specs.js', 'readme.js']

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

// always change selected configuration paths in a container
if (process.env.PP_MODE?.startsWith('container')) {
	// within the container, the Dockerfile uses pre-determined port and filepaths
	Object.assign(serverconfig, {
		port: 3000,
		tpmasterdir: '/home/root/pp/tp',
		cachedir: '/home/root/pp/cache',
		hicstraw: '/home/root/pp/tools/straw',
		bigwigsummary: '/home/root/pp/tools/bigWigSummary',
		bigBedToBed: '/home/root/pp/tools/bigBedToBed',
		bigBedNamedItems: '/home/root/pp/tools/bigBedNamedItems',
		bigBedInfo: '/home/root/pp/tools/bigBedInfo'
		// note that tabix, samtools, and similar binaries are
		// saved in the usual */bin/ paths so locating them
		// is not needed when calling via Node child_process.spawn() or exec()
	})
}

if (!serverconfig.features) {
	// default to having an empty object value for
	// examples of end-user-accessible features are:
	// mdjsonform: true, healthcheck_keys: ["w", "rs"], etc.
	serverconfig.features = {}
}
if (process.argv.find(a => a == 'validate')) {
	// issues in the GDC API (like its servers being under maintenance) should not affect
	// the ability of the PP server to launch itself, so skip GDC-caching during validation
	// as the GDC API may come online later (and not require a PP server restart)
	serverconfig.features.stopGdcCacheAliquot = true
}

if (!serverconfig.backend_only && fs.existsSync(path.join(process.cwd(), './public'))) {
	const defaultTarget = path.join(serverconfig.binpath, 'cards')
	if (!serverconfig.cards) {
		serverconfig.cards = {
			target: defaultTarget,
			path: 'cards'
		}
	}
	const cards = serverconfig.cards
	const cardsPath = path.join(process.cwd(), './public/', cards.path)

	let cardsSymlink
	try {
		cardsSymlink = fs.lstatSync(cardsPath)
	} catch (e) {
		cardsSymlink = false
	}

	// only set up the symlink if the user doesn't already have a custom public/${cards.path} directory
	// a user may also not specify cards.path for other reasons, in that case no need for symlink
	if (cards.path && !fs.existsSync(cardsPath) && !cardsSymlink) {
		// a user may only wish to use a different public path for the cards
		// and keep the defaulf of using server/cards
		if (!cards.target) cards.target = defaultTarget

		fs.symlink(serverconfig.cards.target, cardsPath, 'dir', console.error)
	}
}

if (fs.existsSync('./public/rev.txt')) {
	const revtxt = fs.readFileSync('./public/rev.txt', { encoding: 'utf8' })
	const commitHash = revtxt.trim().split(' ')[1]
	if (commitHash) serverconfig.commitHash = commitHash
}
if (fs.existsSync('./package.json')) {
	const pkg = fs.readFileSync('./package.json', { encoding: 'utf8' })
	serverconfig.version = JSON.parse(pkg).version
}

//Object.freeze(serverconfig)
module.exports = serverconfig
