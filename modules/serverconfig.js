/*
	Detect and process the server configuration file,
	including generating and applying overrides as needed
*/

const fs = require('fs')

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
		hicstat: 'python3 /home/root/pp/tools/read_hic_header.py',
		hicstraw: '/home/root/pp/tools/straw'
	})
}

//Object.freeze(serverconfig)
module.exports = serverconfig

/*****************
  HELPERS
******************/

function getGDCconfig() {
	return {
		URL: process.env.PP_URL || '', // will be used for the publicPath of dynamically loaded js chunks
		host: process.env.PP_HOST || '', // will be used for querying the server data
		port: process.env.PP_PORT || 3000, // will be used to publish
		genomes: [
			{
				name: 'hg38',
				species: 'human',
				file: './genome/hg38.js',
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
