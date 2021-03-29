/*
	Detect and process the server configuration file,
	including generating and applying overrides as needed
*/

const fs = require('fs')
const path = require('path')

// do not assume that serverconfig.json is in the same dir as server.js
// for example, when using proteinpaint as an npm module or binary
const serverconfigfile = (process.cwd() || '..') + '/serverconfig.json'

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
		throw e
	}
} else {
	// automatically generate serverconfig, hardcoded by customer
	if (process.env.PP_CUSTOMER == 'gdc') {
		serverconfig = getGDCconfig()
	} else {
		throw 'missing serverconfig.json'
	}
}

/******************
	APPLY OVERRIDES 
******************/

if (!('allow_env_overrides' in serverconfig) && serverconfig.debugmode) {
	serverconfig.allow_env_overrides = true
}

if (serverconfig.debugmode) {
	const routeSetters = []
	const files = ['./src/test/routes/gdc.js']
	for (const f of files) {
		if (fs.existsSync(f)) routeSetters.push(f)
	}
	serverconfig.routeSetters = routeSetters
}

if (serverconfig.allow_env_overrides) {
	if (process.env.PP_URL) {
		serverconfig.URL = process.env.URL
	}

	if (process.env.PP_BASEPATH) {
		serverconfig.basepath = process.env.PP_BASEPATH
	}

	if (process.env.PP_MODE && process.env.PP_MODE.startsWith('container')) {
		// within the container, the Dockerfile uses a pre-determined port and filepaths
		Object.assign(serverconfig, {
			port: 3456,
			tpmasterdir: '/home/root/pp/tp',
			cachedir: '/home/root/pp/cache',
			bigwigsummary: '/home/root/pp/tools/bigWigSummary',
			hicstraw: '/home/root/pp/tools/straw'
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

if (!serverconfig.binpath) {
	const jsfile = process.argv.find(n => n.includes('/proteinpaint/'))
	serverconfig.binpath = path.dirname(jsfile)
}

//Object.freeze(serverconfig)
module.exports = serverconfig

/*****************
  HELPERS
******************/

function getGDCconfig() {
	return {
		allow_env_overrides: true,
		basepath: process.env.PP_MODE && process.env.PP_MODE.startsWith('container') ? '/auth/api/custom/proteinpaint' : '',
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
