/*

********** test accessibility of serverconfig.tpmasterdir at two places **********
if inaccessible, do not crash service. maintain server process to be able to return helpful message to all request
1. pp_init()
   if dir is inaccessible, will not initiate and validate any genome/dataset
   a server process will be launched hosting no genome/dataset,
   allowing the service to respond to requests with a message (rather than a dead irresponsive url)
2. handle_genomes()
   if dir is inaccessbile, will return error
   this can handle the case that dir becomes inaccessible *after* server launches
   as genomes is the first thing most requests will query about
   this may allow to return a helpful message for most of the cases

************** dataset *************
in serverconfig, a dataset is defined as {"name":str,"jsfile":..}
when launching:
- at server backend
  - an in-memory "ds{}" object is created for this dataset
    ds.label is the "name" from serverconfig
  - creates genome.datasets{}
    key: ds.label, value: ds{} object
    the keys are referred to as "dsname" and is used in server requests to point to a specific ds
- at client, runpp() returns list of server-side official dataset for a genome
  as genomeobj.datasets{name:{label:str}}
  both name and label are the same "name" from serverconfig
*/

import serverconfig from './serverconfig'
import express from 'express'
import util from 'util'
import url from 'url'
import http from 'http'
import https from 'https'
import fs from 'fs'
import path from 'path'
import got from 'got'
import lazy from 'lazy'
import compression from 'compression'
import child_process from 'child_process'
import { spawn } from 'child_process'
import { createCanvas } from 'canvas'
import { stratinput } from '#shared/tree'
import bodyParser from 'body-parser'
import imagesize from 'image-size'
import readline from 'readline'
import jsonwebtoken from 'jsonwebtoken'
import * as utils from './utils'
import * as common from '#shared/common'
import * as vcf from '#shared/vcf'
import handle_study from './handle_study'
import d3color from 'd3-color'
import { stratify as d3stratify } from 'd3-hierarchy'
import * as d3scale from 'd3-scale'
import * as d3dsv from 'd3-dsv'
import basicAuth from 'express-basic-auth'
import * as termdb from './termdb'
import { handle_tkbigwig } from './bw'
import { handle_tkld } from './ld'
import * as termdbbarsql from './termdb.barchart'
import bedgraphdot_request_closure from './bedgraphdot'
import bam_request_closure from './bam'
import { mdsjunction_request_closure } from './mds.junction'
import { gdc_bam_request } from './bam.gdc'
import * as mds3Gdc from './mds3.gdc'
import aicheck_request_closure from './aicheck'
import bampile_request from './bampile'
import junction_request from './junction'
import bedj_request_closure from './bedj'
import { request_closure as blat_request_closure } from './blat'
import { mds3_request_closure } from './mds3.load'
import { handle_mdssvcnv_expression } from './handle_mdssvcnv_expression'
import { server_updateAttr } from './dsUpdateAttr'
import * as mds2_init from './mds2.init'
import * as mds3_init from './mds3.init'
import * as mds2_load from './mds2.load'
import * as massSession from './massSession'
import * as singlecell from './singlecell'
import * as fimo from './fimo'
import { draw_partition } from './partitionmatrix'
import mdsgeneboxplot_closure from './mds.geneboxplot'
import { handle_mdssurvivalplot } from './km'
import * as validator from './validator'
import cookieParser from 'cookie-parser'
import { authApi } from './auth.js'
import { server_init_db_queries, listDbTables } from './termdb.server.init'
import { versionInfo } from './health'
export * as phewas from './termdb.phewas'

export const tabixnoterror = s => {
	return s.startsWith('[E::idx_test_and_fetch]') // got this with htslib 1.15.1
}

// cache
const ch_genemcount = {} // genome name - gene name - ds name - mutation class - count
const ch_dbtable = new Map() // k: db path, v: db stuff

export const features = Object.freeze(serverconfig.features || {})

//////////////////////////////
// Global variable (storing things in memory)
export const genomes = {} // { hg19: {...}, ... }
const tabix = serverconfig.tabix
const samtools = serverconfig.samtools
const bcftools = serverconfig.bcftools
const bigwigsummary = serverconfig.bigwigsummary
const hicstraw = serverconfig.hicstraw

/*
    this hardcoded term is kept same with notAnnotatedLabel in block.tk.mdsjunction.render
    */
const infoFilter_unannotated = 'Unannotated'

export const app = express()
app.disable('x-powered-by')

if (serverconfig.users) {
	// { user1 : pass1, user2: pass2, ... }
	app.use(basicAuth({ users: serverconfig.users, challenge: true }))
}

/* when using webpack, should no longer use __dirname, otherwise cannot find the html files!
app.use(express.static(__dirname+'/public'))
*/

export const basepath = serverconfig.basepath || ''

function setHeaders(res) {
	res.header('Vary', 'Origin')
	res.header('Access-Control-Allow-Origin', '*')
	res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, HEAD')
	// embedder sites may use HTTP 2.0 which requires lowercased header key names
	// must support mixed casing and all lowercased for compatibility
	res.header(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept, Authorization' +
			', origin, x-requested-with, content-type, accept, authorization' +
			', X-Auth-Token, X-Ds-Access-Token, X-SjPPDs-Sessionid' +
			', x-auth-token, x-ds-access-token, x-sjppds-sessionid'
	)
}

if (!serverconfig.backend_only) {
	const staticDir = express.static(path.join(process.cwd(), './public'), { setHeaders })
	app.use(staticDir)
}

app.use(compression())

app.use((req, res, next) => {
	if (req.method.toUpperCase() == 'POST') {
		// assume all post requests have json-encoded content
		// TODO: change all client-side fetch(new Request(...)) to use dofetch*() to preset the content-type
		req.headers['content-type'] = 'application/json'
	}

	// detect URL parameter values with matching JSON start-stop encoding characters
	try {
		const encoding = req.query.encoding
		for (const key in req.query) {
			const value = req.query[key]
			if (value == 'undefined') {
				// maybe better to also detect this common error
				// console.warn(`${key}="undefined" value as a string URL query parameter`)
				delete req.query[key]
				continue
			}
			if (
				encoding == 'json' ||
				value == 'null' || // not new, always been
				value == 'true' || // NEED TO FIND-REPLACE CODE THAT USES value == 'true'
				value == 'false' || // NEED TO FIND-REPLACE CODE THAT USES value == 'false'
				isNumeric(value) || // NEED TO check
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith('{') && value.endsWith('}')) ||
				(value.startsWith('[') && value.endsWith(']'))
			)
				req.query[key] = JSON.parse(value)
			// else the value is already a string
		}
	} catch (e) {
		res.send({ error: e })
		return
	}
	next()
})

function isNumeric(d) {
	return !isNaN(parseFloat(d)) && isFinite(d) && d !== ''
}

app.use(cookieParser())
app.use(bodyParser.json({ limit: '5mb' }))
app.use(bodyParser.text({ limit: '5mb' }))
app.use(bodyParser.urlencoded({ extended: true }))

app.use((req, res, next) => {
	if (req.method.toUpperCase() == 'POST' && req.body && req.headers['content-type'] != 'application/json') {
		res.send({ error: `invalid HTTP request.header['content-type'], must be 'application/json'` })
		return
	}
	if (req.headers['content-type'] == 'application/json') {
		if (!req.query) req.query = {}
		// TODO: in the future, may have to combine req.query + req.params + req.body
		// if using req.params based on expressjs server route /:paramName interpolation
		Object.assign(req.query, req.body)
	}

	// log the request before adding protected info
	log(req)

	/*
	!!! put this code after logging the request, so these protected info are not logged !!!
	!! more or less quick fix !!
	in gdc environment, this will pass sessionid from cookie to req.query
	to be added to request header where it's querying gdc api
	by doing this, route code is worry-free and no need to pass "req{}" to gdc purpose-specific code doing the API calls
	these *protected* contents are not used in non-gdc code
	*/
	req.query.__protected__ = {}
	if (req.cookies?.sessionid) {
		req.query.__protected__.sessionid = req.cookies.sessionid
	}
	Object.freeze(req.query.__protected__)

	setHeaders(res)
	res.header(
		'Access-Control-Allow-Origin',
		req.get('origin') || req.get('referrer') || req.protocol + '://' + req.get('host').split(':')[0] || '*'
	)
	res.header('Access-Control-Allow-Credentials', true)

	if (req.method == 'GET' && (!req.path.includes('.') || req.path.endsWith('proteinpaint.js'))) {
		// immutable response before expiration, client must revalidate after max-age;
		// by convention, any path that has a dot will be treated as
		// a static file and not handled here with cache-control
		res.header('Cache-control', `immutable,max-age=${serverconfig.responseMaxAge || 1}`)
	}
	next()
})

app.catch = validator.floodCatch
app.use(validator.middleware)

// NOTE: The error handling middleware should be used after all other app.use() middlewares
// error handling middleware has four arguments
app.use((error, req, res, next) => {
	log(req)
	if (error) {
		if (error && error.type == 'entity.parse.failed') {
			res.send({ error: 'invalid request body, must be a valid JSON-encoded object' })
		} else {
			res.send({ error })
		}
		return
	}
})

if (serverconfig.jwt) {
	console.log('JWT is activated')
	app.use((req, res, next) => {
		let j = {}
		if (req.body && req.method == 'POST') {
			// a preceding middleware assumes all POST contents are json-encoded and processed by bodyParser()
			j = req.body
		}
		const jwt = j.jwt
			? j.jwt
			: req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
			? req.headers.authorization.split(' ')[1]
			: null
		if (!jwt) return res.send({ error: 'json web token missing' })

		jsonwebtoken.verify(jwt, serverconfig.jwt.secret, (err, decode) => {
			if (err) return res.send({ error: 'Invalid token' })

			// FIXME do not hardcode required attribute, replace with a list
			if (!decode[serverconfig.jwt.permissioncheck]) return res.send({ error: 'Not authorized' })

			next()
		})
	})
}

// has to set optional routes before app.get() or app.post()
// otherwise next() may not be called for a middleware in the optional routes
setOptionalRoutes()
authApi.maySetAuthRoutes(app, basepath, serverconfig)
app.get(basepath + '/cardsjson', handle_cards)
app.post(basepath + '/mdsjsonform', handle_mdsjsonform)
app.get(basepath + '/genomes', handle_genomes)
app.get(basepath + '/getDataset', handle_getDataset)
app.all(basepath + '/ntseq', handle_ntseq)
app.post(basepath + '/pdomain', handle_pdomain)
app.post(basepath + '/tkbedj', bedj_request_closure(genomes))
app.post(basepath + '/tkbedgraphdot', bedgraphdot_request_closure(genomes))
app.all(basepath + '/tkbam', bam_request_closure(genomes))
app.get(basepath + '/gdcbam', gdc_bam_request(genomes))
app.get(basepath + '/tkaicheck', aicheck_request_closure(genomes))
app.get(basepath + '/blat', blat_request_closure(genomes))
app.all(basepath + '/mds3', mds3_request_closure(genomes))
app.get(basepath + '/tkbampile', bampile_request)
app.post(basepath + '/dsdata', handle_dsdata) // old official ds, replace by mds
app.post(basepath + '/tkbigwig', handle_tkbigwig)
app.post(basepath + '/tkld', handle_tkld(genomes))
app.get(basepath + '/tabixheader', handle_tabixheader)
app.all(basepath + '/snp', handle_snp)
app.post(basepath + '/isoformlst', handle_isoformlst)
app.post(basepath + '/dbdata', handle_dbdata)
app.get(basepath + '/img', handle_img)
app.post(basepath + '/svmr', handle_svmr)
app.post(basepath + '/study', handle_study)
app.post(basepath + '/textfile', handle_textfile)
app.post(basepath + '/urltextfile', handle_urltextfile)
app.get(basepath + '/junction', junction_request) // legacy, including rnapeg
app.post(basepath + '/mdsjunction', mdsjunction_request_closure(genomes))
app.post(basepath + '/mdscnv', handle_mdscnv)
app.post(basepath + '/mdssvcnv', handle_mdssvcnv)
app.post(basepath + '/mdsgenecount', handle_mdsgenecount)
app.post(basepath + '/mds2', mds2_load.handle_request(genomes))
app.post(basepath + '/mdsexpressionrank', handle_mdsexpressionrank) // expression rank as a browser track
app.post(basepath + '/mdsgeneboxplot', mdsgeneboxplot_closure(genomes))
app.post(basepath + '/mdsgenevalueonesample', handle_mdsgenevalueonesample)

app.post(basepath + '/vcf', handle_vcf) // for old ds/vcf and old junction

app.get(basepath + '/vcfheader', handle_vcfheader)

app.post(basepath + '/translategm', handle_translategm)

app.post(basepath + '/samplematrix', handle_samplematrix)
app.get(basepath + '/mdssamplescatterplot', handle_mdssamplescatterplot)
app.post(basepath + '/mdssamplesignature', handle_mdssamplesignature)
app.post(basepath + '/mdssurvivalplot', handle_mdssurvivalplot(genomes))
app.post(basepath + '/fimo', fimo.handle_closure(genomes))
app.all(basepath + '/termdb', termdb.handle_request_closure(genomes))
app.all(basepath + '/termdb-barsql', termdbbarsql.handle_request_closure(genomes))
app.post(basepath + '/singlecell', singlecell.handle_singlecell_closure(genomes))
app.post(basepath + '/massSession', massSession.save)
app.get(basepath + '/massSession', massSession.get)
app.delete(basepath + '/massSession', massSession._delete)
app.get(basepath + '/sessionIds', massSession.getSessionIdsByCred)
app.get(basepath + '/isoformbycoord', handle_isoformbycoord)
app.post(basepath + '/ase', handle_ase)
app.post(basepath + '/bamnochr', handle_bamnochr)
app.get(basepath + '/gene2canonicalisoform', handle_gene2canonicalisoform)
app.get(basepath + '/ideogram', handle_ideogram)

/****
	- validate and start the server
	This enables the correct monitoring by the forever module. 
	Whereas before 'forever' will endlessly restart the server
	even if it cannot be initialized in a full working state,
	the usage in a bash script should now be: 
	```
	set -e
	node server validate 
	# only proceed to using forever on successful validation
	forever -a --minUptime 1000 --spinSleepTime 1000 --uid "pp" -l $logdir/log -o $logdir/out -e $logdir/err start server.js --max-old-space-size=8192
	
	# - OR -
	# use the serverconfig.preListenScript option to stop the previous process
	# after all configurations, genomes, and datasets have been loaded in the current process, 
	# so that the validation happens from within the same monitored process (see startServer())
	```
***/

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function log(req) {
	const j = {}
	for (const k in req.query) {
		if (k != 'jwt') j[k] = req.query[k]
	}
	console.log(
		'%s\t%s\t%s\t%s',
		url.parse(req.url).pathname,
		new Date(),
		req.header('x-forwarded-for') || req.connection.remoteAddress,
		JSON.stringify(j).replace(/\\"/g, '"')
	)
}

export async function startServer() {
	// uses the global express "app"
	try {
		if (serverconfig.preListenScript) {
			const { cmd, args } = serverconfig.preListenScript
			const ps = child_process.spawnSync(cmd, args, { encoding: 'utf-8' })
			if (ps.stderr.trim()) throw ps.stderr.trim()
			console.log(ps.stdout)
		}

		// serverconfig.appEnable is an array of strings that are
		// valid arguments to http://expressjs.com/en/4x/api.html#app.enabled
		// For example, when the server sits behind a trusted reverse proxy,
		// "appEnable": ["trust proxy"]
		if (serverconfig.appEnable) serverconfig.appEnable.forEach(d => app.enable(d))

		const port = serverconfig.port
		// !!! DO NOT CHANGE THE FOLLOWING MESSAGE !!!
		// a serverconfig.preListenScript may rely on detecting this exact post-listen() message
		const message = `STANDBY AT PORT ${port}`
		if (serverconfig.ssl) {
			const options = {
				key: fs.readFileSync(serverconfig.ssl.key),
				cert: fs.readFileSync(serverconfig.ssl.cert)
			}
			const server = await https.createServer(options, app)
			// second optional argument is host, formatted so that req.ip will be ipv4
			server.listen(port, '0.0.0.0', () => {
				console.log(`HTTPS ${message}`)
			})
			return server
		} else {
			const server = await http.createServer(app)
			// second optional argument is host, formatted so that req.ip will be ipv4
			server.listen(port, '0.0.0.0', () => {
				if (process.send) {
					process.send('ready')
				}
				console.log(message)
			})
			return server
		}
	} catch (e) {
		throw e
	}
}

function setOptionalRoutes() {
	// routeSetters is an array of "filepath/name.js"
	if (!serverconfig.routeSetters) return
	for (const fname of serverconfig.routeSetters) {
		if (fname.endsWith('.js')) {
			const setRoutes = __non_webpack_require__(fname)
			setRoutes(app, basepath)
		}
	}
}

function handle_gene2canonicalisoform(req, res) {
	try {
		if (!req.query.gene) throw '.gene missing'
		const genome = genomes[req.query.genome]
		if (!genome) throw 'unknown genome'
		if (!genome.genedb.get_gene2canonicalisoform) throw 'gene2canonicalisoform not supported on this genome'
		const data = genome.genedb.get_gene2canonicalisoform.get(req.query.gene)
		// data = { isoform: str }
		res.send(data)
	} catch (e) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}

async function handle_cards(req, res) {
	try {
		if (req.query.datafile && req.query.tabixCoord) {
			// does not return the raw contents of a file, so okay not to use utils.illegalpath() ???
			// may also be too strict with file extensions that tabix expects
			// if (utils.illegalpath(req.query.datafile)) throw 'Invalid file'
			return new Promise((resolve, reject) => {
				const sp = spawn(tabix, [path.join(serverconfig.tpmasterdir, req.query.datafile), req.query.tabixCoord])
				const output = [],
					errOut = []
				sp.stdout.on('data', i => output.push(i))
				sp.stderr.on('data', i => errOut.push(i))
				sp.on('close', code => {
					const e = errOut.join('').trim()
					if (e != '') reject('error querying bedj file')
					const tmp = output.join('').trim()
					resolve(res.send({ file: tmp.split('\n') }))
				})
			}).catch(err => {
				if (err.stack) {
					// debug
					console.error(err.stack)
				}
			})
		} else throw `invalid cards request`
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

async function handle_mdsjsonform(req, res) {
	if (!features.mdsjsonform) return res.send({ error: 'This feature is not enabled on this server.' })
	if (req.query.deposit) {
		const id = Math.random().toString()
		const folder = await maymakefolder()
		const file = path.join(folder, id)
		await utils.write_file(file, JSON.stringify(req.query.deposit))
		res.send({ id })
		return
	}
	if (req.query.draw) {
		const file = path.join(serverconfig.cachedir, 'mdsjsonform', req.query.draw)
		const txt = await utils.read_file(file)
		try {
			const json = JSON.parse(txt)
			res.send({ json })
		} catch (e) {
			res.send({ error: 'Invalid JSON' })
		}
		return
	}
	// no other trigger, return empty obj to allow client to test if feature is enabled on server
	res.send({})
}

function maymakefolder() {
	const p = path.join(serverconfig.cachedir, 'mdsjsonform')
	return new Promise((resolve, reject) => {
		fs.stat(p, (e, s) => {
			if (e) {
				if (e.code == 'ENOENT') {
					fs.mkdir(p, e => {
						if (e) reject('error creating dir')
						resolve(p)
					})
					return
				}
				reject('error checking directory')
			} else {
				if (s.isDirectory()) {
					resolve(p)
				} else {
					reject('"mdsjsonform" exists but not directory')
				}
			}
		})
	})
}

async function handle_tabixheader(req, res) {
	try {
		const [e, file, isurl] = utils.fileurl(req)
		if (e) throw e
		const dir = isurl ? await utils.cache_index(file, req.query.indexURL) : null
		const lines = await utils.get_header_tabix(file, dir)
		res.send({ lines })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

async function handle_genomes(req, res) {
	try {
		await fs.promises.stat(serverconfig.tpmasterdir)
	} catch (e) {
		/* dir is inaccessible
		return error message as the service is out
		*/
		// default error message
		let message = 'Error with TP directory (' + e.code + ')'
		const m = serverconfig.maintenance || {}
		// may override with a non-empty maintenance message
		if ('start' in m && 'stop' in m && m.tpMessage) {
			// use unix timestamps to simplify comparison
			const start = +new Date(m.start)
			const stop = +new Date(m.stop)
			const currTime = +new Date()
			if (start <= currTime && currTime <= stop) {
				message = m.tpMessage
			}
		}
		res.send({ error: message })
		return
	}

	const hash = {}
	if (req.query && req.query.genome) {
		hash[req.query.genome] = clientcopy_genome(req.query.genome)
	} else {
		for (const genomename in genomes) {
			hash[genomename] = clientcopy_genome(genomename)
		}
	}
	let hasblat = false
	for (const n in genomes) {
		if (genomes[n].blat) hasblat = true
	}
	res.send({
		genomes: hash,
		debugmode: serverconfig.debugmode,
		headermessage: serverconfig.headermessage,
		base_zindex: serverconfig.base_zindex,
		codedate: versionInfo.codedate,
		launchdate: versionInfo.launchdate,
		hasblat,
		features,
		dsAuth: authApi.getDsAuth(req),
		commonOverrides: serverconfig.commonOverrides,
		targetPortal: serverconfig.targetPortal, //sending target portal to the client
		cardsPath: serverconfig.cards?.path
	})
}

function clientcopy_genome(genomename) {
	const g = genomes[genomename]
	const g2 = {
		species: g.species,
		name: genomename,
		hasSNP: g.snp ? true : false,
		hasIdeogram: g.genedb.hasIdeogram,
		fimo_motif: g.fimo_motif ? true : false,
		blat: g.blat ? true : false,
		geneset: g.geneset,
		defaultcoord: g.defaultcoord,
		isdefault: g.isdefault,
		majorchr: g.majorchr,
		majorchrorder: g.majorchrorder,
		minorchr: g.minorchr,
		tracks: g.tracks,
		hicenzymefragment: g.hicenzymefragment,
		datasets: {}
	}

	if (g.termdbs) {
		g2.termdbs = {}
		for (const k in g.termdbs) {
			g2.termdbs[k] = { label: g.termdbs[k].label }
		}
	}

	for (const dsname in g.datasets) {
		const ds = g.datasets[dsname]

		if (ds.isMds3) {
			// only send most basic info about the dataset, enough for e.g. a button to launch this dataset
			// client will request detailed info when using this dataset
			g2.datasets[ds.label] = {
				isMds3: true,
				noHandleOnClient: ds.noHandleOnClient,
				label: ds.label
			}
			continue
		}

		if (ds.isMds) {
			g2.datasets[ds.label] = {
				isMds: true,
				mdsIsUninitiated: true,
				noHandleOnClient: ds.noHandleOnClient,
				label: ds.label
			}
			continue
			/*
			const _ds = mds_clientcopy(ds)
			if (_ds) {
				g2.datasets[ds.label] = _ds
			}
			continue
			*/
		}

		// old official ds; to be replaced by mds3
		g2.datasets[ds.label] = {
			isofficial: true,
			legacyDsIsUninitiated: true, // so client only gets copy_legacyDataset once
			noHandleOnClient: ds.noHandleOnClient,
			label: ds.label
		}
	}

	if (g.hicdomain) {
		g2.hicdomain = { groups: {} }
		for (const s1 in g.hicdomain.groups) {
			const tt = g.hicdomain.groups[s1]
			g2.hicdomain.groups[s1] = {
				name: tt.name,
				reference: tt.reference,
				sets: {}
			}
			for (const s2 in tt.sets) {
				g2.hicdomain.groups[s1].sets[s2] = {
					name: tt.sets[s2].name,
					longname: tt.sets[s2].longname
				}
			}
		}
	}
	return g2
}

function copy_legacyDataset(ds) {
	const ds2 = {
		noHandleOnClient: ds.noHandleOnClient,
		sampleselectable: ds.sampleselectable,
		label: ds.label,
		dsinfo: ds.dsinfo,
		stratify: ds.stratify,
		cohort: ds.cohort,
		vcfinfofilter: ds.vcfinfofilter,
		info2table: ds.info2table,
		info2singletable: ds.info2singletable,
		url4variant: ds.url4variant,
		itemlabelname: ds.itemlabelname
	}

	if (ds.snvindel_attributes) {
		ds2.snvindel_attributes = []
		for (const at of ds.snvindel_attributes) {
			const rep = {}
			for (const k in at) {
				if (k == 'lst') {
					rep.lst = []
					for (const e of at.lst) {
						const rep2 = {}
						for (const k2 in e) rep2[k2] = e[k2]
						rep.lst.push(rep2)
					}
				} else {
					rep[k] = at[k]
				}
			}
			ds2.snvindel_attributes.push(rep)
		}
	}
	if (ds.snvindel_legend) {
		ds2.snvindel_legend = ds.snvindel_legend
	}
	const vcfinfo = {}
	let hasvcf = false
	for (const q of ds.queries) {
		if (q.vcf) {
			hasvcf = true
			vcfinfo[q.vcf.vcfid] = q.vcf
		}
	}
	if (hasvcf) {
		ds2.id2vcf = vcfinfo
	}
	return ds2
}

function handle_getDataset(req, res) {
	/*
	q.genome=str, case-sensitive match with genome name
	q.dsname=str, case-insensitive match with ds key (e.g. pediatric for Pediatric) 

	allow case-insensitive match with dsname
	*/
	try {
		const genome = genomes[req.query.genome]
		if (!genome) throw 'unknown genome'
		if (!genome.datasets) throw 'genomeobj.datasets{} missing'
		let ds
		for (const k in genome.datasets) {
			if (k.toLowerCase() == req.query.dsname.toLowerCase()) {
				ds = genome.datasets[k]
				break
			}
		}
		if (!ds) throw 'invalid dsname'
		if (ds.isMds3) {
			return res.send({ ds: mds3_init.client_copy(ds, null, null, app, basepath) })
		}
		if (ds.isMds) {
			return res.send({ ds: mds_clientcopy(ds) })
		}
		return res.send({ ds: copy_legacyDataset(ds) }) // to be replaced by mds3
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

function mds_clientcopy(ds) {
	// make client-side copy of a mds

	const ds2 = {
		isMds: true,
		noHandleOnClient: ds.noHandleOnClient,
		label: ds.label,
		version: ds.version,
		annotationsampleset2matrix: ds.annotationsampleset2matrix,
		mutationAttribute: ds.mutationAttribute,
		locusAttribute: ds.locusAttribute,
		alleleAttribute: ds.alleleAttribute,
		// these are quick fixes and should be deleted later
		hide_genotypedownload: ds.hide_genotypedownload,
		hide_phewas: ds.hide_phewas,
		sample2bam: ds.sample2bam
	}

	if (ds.queries) {
		ds2.queries = {}
	}

	if (ds.track) {
		ds2.track = mds2_init.client_copy(ds)
	}

	if (ds.singlesamplemutationjson) {
		ds2.singlesamplemutationjson = 1
	}
	if (ds.gene2mutcount) {
		ds2.gene2mutcount = true
		ds2.mutCountType = ds.gene2mutcount.mutationTypes
	}
	if (ds.assayAvailability) {
		ds2.assayAvailability = 1
	}

	if (ds.cohort && ds.cohort.sampleAttribute) {
		// attr may be hidden from client
		const toclient = {}
		for (const k in ds.cohort.sampleAttribute.attributes) {
			const a = ds.cohort.sampleAttribute.attributes[k]
			if (!a.clientnoshow) toclient[k] = a
		}
		ds2.sampleAttribute = { attributes: toclient }
	}

	if (ds.cohort) {
		if (ds.cohort.termdb) {
			// let client know the existance, do not reveal details unless needed
			ds2.termdb = {
				selectCohort: ds.cohort.termdb.selectCohort
			}
		}

		if (ds.cohort.attributes && ds.cohort.attributes.defaulthidden) {
			/*
            .attributes.lst[] are not released to client
            default hidden attributes from sample annotation, tell client
            */
			ds2.cohortHiddenAttr = ds.cohort.attributes.defaulthidden
		}

		if (ds.cohort.survivalplot) {
			ds2.survivalplot = {
				samplegroupattrlst: ds.cohort.survivalplot.samplegroupattrlst,
				plots: []
			}
			for (const k in ds.cohort.survivalplot.plots) {
				const p = ds.cohort.survivalplot.plots[k]
				ds2.survivalplot.plots.push({
					key: k,
					name: p.name,
					timelabel: p.timelabel
				})
			}
		}

		if (ds.cohort.mutation_signature) {
			const sets = {}
			for (const k in ds.cohort.mutation_signature.sets) {
				const s = ds.cohort.mutation_signature.sets[k]
				sets[k] = {
					name: s.name,
					signatures: s.signatures
				}
			}
			ds2.mutation_signature = { sets: sets }
		}
	}

	for (const k in ds.queries) {
		const q = ds.queries[k]

		const clientquery = {
			// revealed to client
			name: q.name,
			hideforthemoment: q.hideforthemoment // hide track not ready to show on client
		}

		if (q.istrack) {
			clientquery.istrack = true
			clientquery.type = q.type
			clientquery.isfull = q.isfull
			// track attributes, some are common, many are track type-specific
			if (q.nochr != undefined) {
				clientquery.nochr = q.nochr
			}
			if (q.infoFilter) {
				clientquery.infoFilter = q.infoFilter
			}
			// junction attributes
			if (q.readcountCutoff) {
				clientquery.readcountCutoff = q.readcountCutoff
			}
			// cnv attributes
			if (q.valueLabel) {
				clientquery.valueLabel = q.valueLabel
			}
			if (q.valueCutoff) {
				clientquery.valueCutoff = q.valueCutoff
			}
			if (q.bplengthUpperLimit) {
				clientquery.bplengthUpperLimit = q.bplengthUpperLimit
			}
			// loh attributes
			if (q.segmeanValueCutoff) {
				clientquery.segmeanValueCutoff = q.segmeanValueCutoff
			}
			if (q.lohLengthUpperLimit) {
				clientquery.lohLengthUpperLimit = q.lohLengthUpperLimit
			}

			if (q.type == common.tkt.mdssvcnv) {
				if (q.groupsamplebyattr) {
					clientquery.groupsamplebyattr = q.groupsamplebyattr
				}

				// flags
				clientquery.multihidelabel_fusion = q.multihidelabel_fusion
				clientquery.multihidelabel_sv = q.multihidelabel_sv
				clientquery.multihidelabel_vcf = q.multihidelabel_vcf
				clientquery.showfullmode = q.showfullmode
				clientquery.legend_vorigin = q.legend_vorigin
				clientquery.no_loh = q.no_loh // quick dirty fix

				if (q.expressionrank_querykey) {
					// for checking expression rank
					const e = ds.queries[q.expressionrank_querykey]
					clientquery.checkexpressionrank = {
						querykey: q.expressionrank_querykey,
						datatype: e.datatype
					}
					if (e.boxplotbysamplegroup && e.boxplotbysamplegroup.additionals) {
						// quick fix!!
						// array element 0 is boxplotbysamplegroup.attributes
						// rest of array, one ele for each of .additionals
						const lst = []
						if (e.boxplotbysamplegroup.attributes)
							lst.push(e.boxplotbysamplegroup.attributes.map(i => i.label).join(', '))
						for (const i of e.boxplotbysamplegroup.additionals) lst.push(i.label)
						clientquery.checkexpressionrank.boxplotgroupers = lst
					}
				}
				if (q.vcf_querykey) {
					clientquery.checkvcf = {
						querykey: q.vcf_querykey,
						info: ds.queries[q.vcf_querykey].info,
						format: {}
					}
					for (const tk of ds.queries[q.vcf_querykey].tracks) {
						if (tk.format) {
							for (const k in tk.format) {
								clientquery.checkvcf.format[k] = tk.format[k]
							}
						}
					}
				}
			}
		} else if (q.isgenenumeric) {
			clientquery.isgenenumeric = true
			clientquery.datatype = q.datatype
			clientquery.no_ase = q.no_ase
		} else {
			// this query is not to be revealed to client
			continue
		}

		ds2.queries[k] = clientquery
	}
	return ds2
}

async function handle_img(req, res) {
	const [e, file, isurl] = utils.fileurl(req) // utils.fileurl({ query: { file: req.query.file } })
	try {
		if (e) throw 'invalid image file'
		const data = await fs.promises.readFile(file)
		res.send({
			src: 'data:image/jpeg;base64,' + new Buffer.from(data).toString('base64'),
			size: imagesize(file)
		})
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

async function handle_ntseq(req, res) {
	try {
		if (!req.query.coord) throw 'coord missing'
		const g = genomes[req.query.genome]
		if (!g) throw 'invalid genome'
		if (!g.genomefile) throw 'no sequence file available'
		const seq = await utils.get_fasta(g, req.query.coord)
		res.send({
			seq: seq.split('\n').slice(1).join('')
		})
	} catch (e) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}

function handle_pdomain(req, res) {
	try {
		const gn = req.query.genome
		if (!gn) throw 'no genome'
		const g = genomes[gn]
		if (!g) throw 'invalid genome ' + gn
		if (!g.proteindomain) {
			// no error
			return res.send({ lst: [] })
		}
		if (!Array.isArray(req.query.isoforms)) throw 'isoforms[] missing'
		const lst = []
		for (const isoform of req.query.isoforms) {
			if (g.genomicNameRegexp.test(isoform)) continue
			const tmp = g.proteindomain.getbyisoform.all(isoform)
			// FIXME returned {data} is text not json
			lst.push({
				name: isoform,
				pdomains: tmp.map(i => {
					const j = JSON.parse(i.data)
					j.refseq = isoform
					return j
				})
			})
		}
		res.send({ lst })
	} catch (e) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}

async function handle_snp(req, res) {
	// TODO move to routes
	try {
		const n = req.query.genome
		if (!n) throw 'no genome'
		res.send({ results: await searchSNP(req.query, genomes[n]) })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return res.send({ error: e.message || e })
	}
}

/*
.byCoord
	if true, query bigbed file by coordinate
.byName
	if true, query bigbed file by rs id
.genome
	name of genome
.chr
	used for byCoord
.ranges[ {start, stop} ]
	used for byCoord
.alleleLst[ str ]
	used for byCoord, if provided will only return snps with matching alleles
.lst[ str ]
	used for byName
*/
export async function searchSNP(q, genome) {
	if (!genome) throw 'invalid genome'
	if (!genome.snp) throw 'snp is not configured for this genome'
	const hits = []
	if (q.byCoord) {
		// query dbSNP bigbed file by coordinate
		// input query coordinates need to be 0-based
		// output snp coordinates are 0-based
		if (genome.genomicNameRegexp.test(q.chr)) throw 'invalid chr name'
		if (!Array.isArray(q.ranges)) throw 'ranges not an array'
		for (const r of q.ranges) {
			// require start/stop of a range to be non-neg integers, as a measure against attack
			if (!Number.isInteger(r.start) || !Number.isInteger(r.stop) || r.start < 0 || r.stop < r.start)
				throw 'invalid start/stop'
			if (r.stop - r.start >= 100) {
				// quick fix!
				// as this function only works as spot checking snps
				// guard against big range and avoid retrieving snps from whole chromosome that will overwhelm server
				throw 'range too big'
			}
			const snps = await utils.query_bigbed_by_coord(genome.snp.bigbedfile, q.chr, r.start, r.stop)
			for (const snp of snps) {
				const hit = snp2hit(snp)
				if (q.alleleLst) {
					// given alleles must be found in a snp for it to be returned
					let missing = false
					for (const i of q.alleleLst) {
						// only test on non-empty strings
						if (i && !hit.alleles.includes(i)) {
							missing = true
							break
						}
					}
					if (missing) continue
				}
				hits.push(hit)
			}
		}
	} else if (q.byName) {
		if (!Array.isArray(q.lst)) throw '.lst[] missing'
		for (const n of q.lst) {
			// query dbSNP bigbed file by rsID
			// see above for description of output snp fields
			if (genome.genomicNameRegexp.test(n)) continue
			const snps = await utils.query_bigbed_by_name(genome.snp.bigbedfile, n)
			for (const snp of snps) {
				const hit = snp2hit(snp)
				hits.push(hit)
			}
		}
	} else {
		throw 'unknown query method'
	}
	return hits
}

function snp2hit(snp) {
	// snp must be non-empty string
	// output snp fields: [0]chrom, [1]chromStart, [2]chromEnd, [3]name, [4]ref, altCount, [6]alts, shiftBases, freqSourceCount, minorAlleleFreq, majorAllele, minorAllele, maxFuncImpact, class, ucscNotes, _dataOffset, _dataLen
	const fields = snp.split('\t')
	const ref = fields[4]
	const alts = fields[6].split(',').filter(Boolean)
	const observed = ref + '/' + alts.join('/')
	const hit = {
		chrom: fields[0],
		chromStart: Number(fields[1]),
		chromEnd: Number(fields[2]),
		name: fields[3],
		observed: observed,
		alleles: [ref, ...alts]
	}
	return hit
}

async function handle_dsdata(req, res) {
	/*
    poor mechanism, only for old-style official dataset

    to be totally replaced by mds, which can identify queries in a mds by querykeys
    */
	try {
		if (!genomes[req.query.genome]) throw 'invalid genome'
		if (!req.query.dsname) throw '.dsname missing'
		const ds = genomes[req.query.genome].datasets[req.query.dsname]
		if (!ds) throw 'invalid dsname'

		const data = []

		for (const query of ds.queries) {
			if (req.query.expressiononly && !query.isgeneexpression) {
				/*
                expression data only
                TODO mds should know exactly which data type to query, or which vending button to use
                */
				continue
			}
			if (req.query.noexpression && query.isgeneexpression) {
				// skip expression data
				continue
			}

			if (query.dsblocktracklst) {
				/*
                do not load any tracks here yet
                TODO should allow loading some/all, when epaint is not there
                */
				continue
			}

			if (query.vcffile) {
				const d = await handle_dsdata_vcf(query, req)
				data.push(d)
				continue
			}

			if (query.makequery) {
				const d = handle_dsdata_makequery(ds, query, req)
				data.push(d)
				continue
			}

			throw 'unknow type from one of ds.queries[]'
		}

		res.send({ data })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

function handle_dsdata_makequery(ds, query, req) {
	// query from ds.newconn

	if (req.query.isoform) {
		// quick fix!! deflect attacks from isoform parameter to avoid db query
		if (genomes[req.query.genome].genomicNameRegexp.test(req.query.isoform)) return
	}

	const [sqlstr, values] = query.makequery(req.query)
	if (!sqlstr) {
		// when not using gm, will not query tables such as expression
		return
	}
	const rows = ds.newconn.prepare(sqlstr).all(values)
	let lst
	if (query.tidy) {
		lst = rows.map(i => query.tidy(i))
	} else {
		lst = rows
	}
	const result = {}
	if (query.isgeneexpression) {
		result.lst = lst
		result.isgeneexpression = true
		result.config = query.config

		/*
        	loading of junction track as a dependent of epaint
        	attach junction track info in this result, for making the junction button in epaint
        	await user to click that button

        	replace-by-mds

        	*/

		for (const q2 of ds.queries) {
			if (!q2.dsblocktracklst) continue
			for (const tk of q2.dsblocktracklst) {
				if (tk.type == common.tkt.junction) {
					result.config.dsjunctiontk = tk
				}
			}
		}
	} else {
		result.lst = lst
	}
	return result
}

function handle_dsdata_vcf(query, req) {
	const par = [
		path.join(serverconfig.tpmasterdir, query.vcffile),
		(query.vcf.nochr ? req.query.range.chr.replace('chr', '') : req.query.range.chr) +
			':' +
			req.query.range.start +
			'-' +
			req.query.range.stop
	]
	return new Promise((resolve, reject) => {
		const ps = spawn(tabix, par)
		const out = [],
			out2 = []
		ps.stdout.on('data', i => out.push(i))
		ps.stderr.on('data', i => out2.push(i))
		ps.on('close', code => {
			const e = out2.join('').trim()
			if (e != '') reject('error querying vcf file')
			const tmp = out.join('').trim()
			resolve({
				lines: tmp == '' ? [] : tmp.split('\n'),
				vcfid: query.vcf.vcfid
			})
		})
	})
}

function handle_isoformlst(req, res) {
	try {
		const g = genomes[req.query.genome]
		if (!g) throw 'invalid genome'
		if (!Array.isArray(req.query.lst)) throw '.lst missing'
		const lst = []
		for (const isoform of req.query.lst) {
			if (g.genomicNameRegexp.test(isoform)) continue
			const tmp = g.genedb.getjsonbyisoform.all(isoform)
			lst.push(
				tmp.map(i => {
					const j = JSON.parse(i.genemodel)
					if (i.isdefault) j.isdefault = true
					return j
				})
			)
		}
		res.send({ lst })
	} catch (e) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}

function handle_dbdata(req, res) {
	const query = () => {
		const config = ch_dbtable.get(req.query.db)
		let sql
		if (config.makequery) {
			sql = config.makequery(req.query)
			if (!sql) {
				res.send({ error: 'cannot make query' })
				return
			}
		} else {
			if (!req.query.tablename) {
				res.send({ error: 'no db table name' })
				return
			}
			if (!req.query.keyname) {
				res.send({ error: 'no db table key name' })
				return
			}
			if (!req.query.key) {
				res.send({ error: 'no value to query for' })
				return
			}
			sql =
				'select * from ' +
				req.query.tablename +
				' where ' +
				req.query.keyname +
				'="' +
				req.query.key.toLowerCase() +
				'"'
		}
		config.db.all(sql, (err, rows) => {
			if (err) return res.send({ error: 'error querying db: ' + err })
			if (config.tidy) {
				config.tidy(rows)
			}
			res.send({ rows: rows })
		})
	}

	/*
	// req.query.db db file path
	if (ch_dbtable.has(req.query.db)) {
		query()
	} else {
		const config = {}
		const [e, file, isurl] = utils.fileurl({ query: { file: req.query.db } })
		if (e) {
			res.send({ error: 'db file error: ' + e })
			return
		}
		config.db = new sqlite3.Database(file, sqlite3.OPEN_READONLY, err => {
			if (err) {
				res.send({ error: 'error connecting db' })
				return
			}
			ch_dbtable.set(req.query.db, config)
			query()
		})
	}
	*/
}

function handle_svmr(req, res) {
	if (req.query.file) {
		const [e, file, isurl] = utils.fileurl(req)
		if (e) {
			res.send({ error: 'illegal file name' })
			return
		}
		fs.readFile(file, 'utf8', (err, data) => {
			if (err) {
				res.send({ error: 'cannot read file' })
				return
			}
			res.send({ raw: data })
			return
		})
	} else {
		res.send({ error: 'missing file' })
	}
}

function handle_textfile(req, res) {
	/*
    load a server hosted text file
    argument is json object
    .file
    	path from <TP>
    .from
    .to
    	optional, if present, will get range [from to] 1-based, else will get the entire file
    */
	if (!req.query.file) return res.send({ error: 'no file' })
	if (utils.illegalpath(req.query.file)) return res.send({ error: 'invalid file name' })
	const file = path.join(serverconfig.tpmasterdir, req.query.file)

	if (req.query.from != undefined) {
		// get range [from to]
		if (!Number.isInteger(req.query.from)) {
			res.send({ error: 'invalid value for from' })
			return
		}
		if (!Number.isInteger(req.query.to)) {
			res.send({ error: 'invalid value for to' })
			return
		}
		const lines = []
		// TODO replace by readline
		lazy(fs.createReadStream(file))
			.on('end', () => {
				res.send({ text: lines.join('\n') })
			})
			.lines.map(String)
			.skip(req.query.from - 1)
			.take(req.query.to)
			.forEach(line => {
				lines.push(line)
			})
	} else {
		// get entire file
		fs.readFile(file, { encoding: 'utf8' }, (err, data) => {
			if (err) {
				res.send({ error: 'error reading file' })
				return
			}
			res.send({ text: data })
		})
	}
}

async function handle_urltextfile(req, res) {
	// const url = req.query.url
	const url = req.query.url.replace(serverconfig.URL, `http://127.0.0.1:${serverconfig.port}`)
	/* 
	Fix for loopback request issue on prp1. https links were not properly
	downgrading to http. 
	*/
	try {
		const response = await got(url)
		switch (response.statusCode) {
			case 200:
				res.send({ text: utils.stripJsScript(response.body) })
				return
			case 404:
				res.send({ error: 'File not found: ' + url })
				return
			default:
				res.send({ error: 'unknown status code: ' + response.status })
		}
	} catch (e) {
		return res.send({ error: 'Error downloading file: ' + url })
	}
}

function mds_query_arg_check(q) {
	if (!q.genome) return ['no genome']
	const g = genomes[q.genome]
	if (!g) return ['invalid genome']
	if (!g.datasets) return ['genome is not equipped with datasets']
	if (!q.dslabel) return ['dslabel missing']
	const ds = g.datasets[q.dslabel]
	if (!ds) return ['invalid dslabel']
	if (!ds.queries) return ['dataset is not equipped with queries']
	if (!q.querykey) return ['querykey missing']
	const query = ds.queries[q.querykey]
	if (!query) return ['invalid querykey']
	return [null, g, ds, query]
}

function handle_mdscnv(req, res) {
	/*
    get all cnv in view range, make stats for:
    	- sample annotation


    ****** filter attributes (added by addFilterToLoadParam)

    .cohortHiddenAttr (for dropping sample by annotation)
    	.key
    		.value


    ******* routes

    */
	const [err, gn, ds, dsquery] = mds_query_arg_check(req.query)
	if (err) return res.send({ error: err })

	///////////////// getting all cnv from view range

	if (!req.query.rglst) return res.send({ error: 'rglst missing' })
	if (!req.query.gain) return res.send({ error: '.gain missing' })
	if (!req.query.loss) return res.send({ error: '.loss missing' })

	if (dsquery.viewrangeupperlimit) {
		const len = req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0)
		if (len >= dsquery.viewrangeupperlimit) {
			return res.send({ error: 'zoom in under ' + common.bplen(dsquery.viewrangeupperlimit) + ' to view details' })
		}
	}

	if (req.query.permanentHierarchy) {
		const err = mds_tkquery_parse_permanentHierarchy(req.query, ds)
		if (err) return res.send({ error: 'permanentHierarchy error: ' + err })
	}

	const tasks = []

	// cnv event number in view range, and samples, gain/loss separately
	const gain = {
		count: 0, // number of lines
		samples: new Set()
	}
	const loss = {
		count: 0,
		samples: new Set()
	}

	for (const r of req.query.rglst) {
		const task = new Promise((resolve, reject) => {
			const ps = spawn(
				tabix,
				[
					dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
					r.chr + ':' + r.start + '-' + r.stop
				],
				{ cwd: dsquery.usedir }
			)
			const rl = readline.createInterface({
				input: ps.stdout
			})

			/* r.width (# of pixels) is number of bins in this region
            bin resolution is # of bp per bin
            */
			const binresolution = (r.stop - r.start) / r.width

			// cumulative value per pixel, for this region
			const regioncumv = []
			for (let i = 0; i < r.width; i++) {
				regioncumv.push({ positive: 0, negative: 0 })
			}

			rl.on('line', line => {
				const l = line.split('\t')
				const start0 = Number.parseInt(l[1])
				const stop0 = Number.parseInt(l[2])

				if (req.query.bplengthUpperLimit) {
					if (stop0 - start0 > req.query.bplengthUpperLimit) {
						return
					}
				}

				const j = JSON.parse(l[3])

				if (req.query.valueCutoff) {
					if (Math.abs(j.value) < req.query.valueCutoff) {
						return
					}
				}

				if (j.sample && ds.cohort && ds.cohort.annotation) {
					// may apply sample annotation filtering
					const anno = ds.cohort.annotation[j.sample]
					if (!anno) {
						// this sample has no annotation at all, since it's doing filtering, will drop it
						return
					}

					if (req.query.cohortOnlyAttr && ds.cohort && ds.cohort.annotation) {
						/*
                        from subtrack, will only use samples for one attribute (from hierarchies)
                        cannot refer ds.cohort.attributes
                        */
						let keep = false // if match with any in cohortOnlyAttr, will keep the sample
						for (const attrkey in req.query.cohortOnlyAttr) {
							const value = anno[attrkey]
							if (value && req.query.cohortOnlyAttr[attrkey][value]) {
								keep = true
								break
							}
						}
						if (!keep) {
							return
						}
					}

					if (req.query.cohortHiddenAttr && ds.cohort.attributes) {
						let hidden = false

						for (const attrkey in req.query.cohortHiddenAttr) {
							// this attribute in registry, so to be able to tell if it's numeric
							const attr = ds.cohort.attributes.lst.find(i => i.key == attrkey)

							if (attr.isNumeric) {
								//continue
							}

							// categorical
							const value = anno[attrkey]
							if (value) {
								// this sample has annotation for this attrkey
								if (req.query.cohortHiddenAttr[attrkey][value]) {
									hidden = true
									break
								}
							} else {
								// this sample has no value for attrkey
								if (req.query.cohortHiddenAttr[attrkey][infoFilter_unannotated]) {
									// to drop unannotated ones
									hidden = true
									break
								}
							}
						}
						if (hidden) {
							// this sample has a hidden value for an attribute, skip
							return
						}
					}
				}
				// this item is acceptable
				if (j.value > 0) {
					gain.count++
					gain.samples.add(j.sample)
				} else if (j.value < 0) {
					loss.count++
					loss.samples.add(j.sample)
				}

				// accumulate
				const start = Math.max(r.start, start0)
				const stop = Math.min(r.stop, stop0)

				let startidx, stopidx
				if (r.reverse) {
					startidx = Math.floor((r.stop - stop) / binresolution)
					stopidx = Math.floor((r.stop - start) / binresolution)
				} else {
					startidx = Math.floor((start - r.start) / binresolution)
					stopidx = Math.floor((stop - r.start) / binresolution)
				}
				for (let i = startidx; i < stopidx; i++) {
					if (j.value > 0) {
						//regioncumv[i].positive += j.value
						regioncumv[i].positive++
					} else if (j.value < 0) {
						//regioncumv[i].negative += -j.value
						regioncumv[i].negative++
					}
				}
			})

			const errout = []
			ps.stderr.on('data', i => errout.push(i))
			ps.on('close', code => {
				const e = errout.join('')
				if (e && !tabixnoterror(e)) {
					reject(e)
					return
				}
				resolve(regioncumv)
			})
		})
		tasks.push(task)
	}

	Promise.all(tasks)
		.then(data => {
			// canvas width
			const width = req.query.rglst.reduce((i, j) => i + j.width + req.query.regionspace, 0) - req.query.regionspace
			const canvas = createCanvas(width, req.query.gain.barheight + req.query.loss.barheight)
			const ctx = canvas.getContext('2d')

			const result = {
				gain: {
					count: gain.count,
					samplenumber: gain.samples.size
				},
				loss: {
					count: loss.count,
					samplenumber: loss.samples.size
				},
				maxvalue: 0 // max cumulative cnv value, shared for both negative & positive
			}

			if (gain.count + loss.count == 0) {
				// no data
				ctx.font = '15px Arial'
				ctx.fillStyle = '#aaa'
				ctx.textAlign = 'center'
				ctx.textBaseline = 'middle'
				ctx.fillText('No data in view range', width / 2, req.query.gain.barheight)
				result.src = canvas.toDataURL()
				res.send(result)
				return
			}

			for (const r of data) {
				for (const c of r) {
					result.maxvalue = Math.max(result.maxvalue, c.positive, c.negative)
				}
			}

			const maxvalue = req.query.maxvalue || result.maxvalue

			// render
			let x = 0
			for (const regioncumv of data) {
				for (const c of regioncumv) {
					if (c.positive) {
						ctx.fillStyle = req.query.gain.color || '#67a9cf'
						const h = Math.ceil((req.query.gain.barheight * Math.min(maxvalue, c.positive)) / maxvalue)
						const y = req.query.gain.barheight - h
						ctx.fillRect(x, y, 1, h)
					}
					if (c.negative) {
						ctx.fillStyle = req.query.loss.color || '#ef8a62'
						const h = Math.ceil((req.query.loss.barheight * Math.min(maxvalue, c.negative)) / maxvalue)
						const y = req.query.gain.barheight
						ctx.fillRect(x, y, 1, h)
					}
					x++
				}
				x += req.query.regionspace
			}

			result.src = canvas.toDataURL()

			/* annotation summary
		must pool gain & loss samples together for annotation summary
		*/
			if (gain.samples.size || loss.samples.size) {
				const allsamples = new Set([...gain.samples, ...loss.samples])
				const [attributeSummary, hierarchySummary] = mds_tkquery_samplesummary(ds, dsquery, [...allsamples])
				if (attributeSummary) {
					for (const attr of attributeSummary) {
						for (const value of attr.values) {
							value.gain = 0
							value.loss = 0
							for (const samplename of value.sampleset) {
								if (gain.samples.has(samplename)) value.gain++
								if (loss.samples.has(samplename)) value.loss++
							}
							delete value.sampleset
						}
					}
					result.attributeSummary = attributeSummary
				}
				if (hierarchySummary) {
					for (const k in hierarchySummary) {
						for (const node of hierarchySummary[k]) {
							if (!node.sampleset) continue
							node.gain = 0
							node.loss = 0
							for (const samplename of node.sampleset) {
								if (gain.samples.has(samplename)) node.gain++
								if (loss.samples.has(samplename)) node.loss++
							}
						}
					}
					result.hierarchySummary = hierarchySummary
				}
			}

			res.send(result)
		})
		.catch(err => {
			res.send({ error: err })
			if (err.stack) {
				// debug
				console.error(err.stack)
			}
		})
}

async function handle_mdsgenecount(req, res) {
	try {
		const genome = genomes[req.query.genome]
		if (!genome) throw 'invalid genome'
		if (!genome.datasets) throw 'no datasets from genome'
		const ds = genome.datasets[req.query.dslabel]
		if (!ds) throw 'invalid dataset'
		if (!ds.gene2mutcount) throw 'not supported on this dataset'
		if (!req.query.samples) throw '.samples missing'
		let mutation_count_str, n_gene
		if (req.query.selectedMutTypes) mutation_count_str = req.query.selectedMutTypes.join('+')
		else mutation_count_str = 'total'
		if (req.query.nGenes) n_gene = req.query.nGenes
		else n_gene = 15
		const query = `WITH
	filtered AS (
		SELECT gene, ${mutation_count_str} AS total FROM genecount
		WHERE sample IN (${JSON.stringify(req.query.samples)
			.replace(/[[\]\"]/g, '')
			.split(',')
			.map(i => "'" + i + "'")
			.join(',')})
	)
	SELECT gene, SUM(total) AS count
	FROM filtered
	GROUP BY gene
	ORDER BY count DESC
	LIMIT ${n_gene}`
		const genes = ds.gene2mutcount.db.prepare(query).all()
		const validgenes = []
		for (const gene of genes) {
			const re = genome.genedb.getCoordByGene.get(gene.gene)
			if (!re) continue
			re.gene = gene.gene
			re.count = gene.count
			delete re.name
			validgenes.push(re)
		}
		res.send({ genes: validgenes })
	} catch (e) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}
async function handle_mdssvcnv(req, res) {
	/*
    cnv & vcf & expression rank done in one query
    	- get all cnv/loh in view range:
    		- filtering
    		- group events by sample
    		- group samples by hierarchy, for client rendering

    	- if to make expression rank:
    		- expression file for official or custom
    		- calculate expression rank for genes in each sample

    vcf matrix and ase computation

    ****** filter attributes (added by addFilterToLoadParam)

    .singlesample
    .showonlycnvwithsv

    */
	let gn, ds, dsquery

	if (req.query.iscustom) {
		// is custom track
		gn = genomes[req.query.genome]
		if (!gn) return res.send({ error: 'invalid genome' })

		// in ase by vcf and rnabam mode, svcnv file is optional
		//if(!req.query.file && !req.query.url) return res.send({error:'no file or url for svcnv track'})

		ds = {}
		dsquery = {
			iscustom: 1,
			file: req.query.file,
			url: req.query.url,
			indexURL: req.query.indexURL,
			allow_getallsamples: true
		}

		if (req.query.checkexpressionrank) {
			if (!req.query.checkexpressionrank.file && !req.query.checkexpressionrank.url)
				return res.send({ error: 'no file or url for checkexpressionrank' })
			dsquery.checkexpressionrank = {
				file: req.query.checkexpressionrank.file,
				url: req.query.checkexpressionrank.url,
				indexURL: req.query.checkexpressionrank.indexURL
			}
		}

		if (req.query.checkvcf) {
			let vcf
			try {
				vcf = JSON.parse(req.query.checkvcf)
			} catch (e) {
				return res.send({ error: 'invalid JSON for VCF object' })
			}
			if (!vcf.file && !vcf.url) return res.send({ error: 'no file or url for custom VCF track' })
			vcf.type = common.mdsvcftype.vcf
			dsquery.checkvcf = {
				info: vcf.info,
				tracks: [vcf]
			}
		}

		if (req.query.checkrnabam) {
			if (!req.query.checkrnabam.samples) return res.send({ error: 'samples{} missing from checkrnabam' })
			let n = 0
			for (const k in req.query.checkrnabam.samples) n++
			if (n > 13) return res.send({ error: 'no more than 13 BAM files allowed' })
			const e = ase_testarg(req.query.checkrnabam)
			if (e) return res.send({ error: e })
			dsquery.checkrnabam = req.query.checkrnabam
		}
	} else {
		// is native track

		gn = genomes[req.query.genome]
		if (!gn) return res.send({ error: 'invalid genome' })
		if (!gn.datasets) return res.send({ error: 'genome is not equipped with datasets' })
		ds = gn.datasets[req.query.dslabel]
		if (!ds) return res.send({ error: 'invalid dslabel' })

		//////////// exits that only requires ds but not dsquery
		if (req.query.getsample4disco) return mdssvcnv_exit_getsample4disco(req, res, gn, ds)
		if (req.query.gettrack4singlesample) return mdssvcnv_exit_gettrack4singlesample(req, res, ds)
		if (req.query.findsamplename) return mdssvcnv_exit_findsamplename(req, res, ds)
		if (req.query.assaymap) return mdssvcnv_exit_assaymap(req, res, ds)

		if (!ds.queries) return res.send({ error: 'dataset is not equipped with queries' })
		dsquery = ds.queries[req.query.querykey]
		if (!dsquery) return res.send({ error: 'invalid querykey' })
	}

	///////////////// exits that require dsquery (svcnv)
	if (req.query.getexpression4gene) return mdssvcnv_exit_getexpression4gene(req, res, gn, ds, dsquery)
	if (req.query.ifsamplehasvcf) return mdssvcnv_exit_ifsamplehasvcf(req, res, gn, ds, dsquery)

	if (!req.query.rglst) return res.send({ error: 'rglst missing' })

	if (dsquery.viewrangeupperlimit) {
		// hard limit from official dataset
		const len = req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0)
		if (len >= dsquery.viewrangeupperlimit) {
			return res.send({ error: 'zoom in under ' + common.bplen(dsquery.viewrangeupperlimit) + ' to view details' })
		}
	}

	/*******
    TODO rewrite: helper func return {} attached with all possible filters
    ***/

	// single or multi: hidden dt, for cnv/loh/sv/fusion/itd, all from one file
	let hiddendt
	if (req.query.hiddendt) {
		hiddendt = new Set(req.query.hiddendt)
	}

	/*
    multi: mutation attributes selected to be hidden from client
    terms defined in ds.mutationAttribute
    */
	let hiddenmattr
	if (req.query.hiddenmattr) {
		hiddenmattr = {}
		for (const key in req.query.hiddenmattr) {
			hiddenmattr[key] = new Set(req.query.hiddenmattr[key])
		}
	}

	/*
    multi: vcf info field allele-level
    */
	let filteralleleattr
	if (req.query.filteralleleattr) {
		filteralleleattr = {}
		for (const key in req.query.filteralleleattr) {
			const v = req.query.filteralleleattr[key]
			if (v.cutoffvalue != undefined) {
				// numeric
				filteralleleattr[key] = v
			} else {
				// categorical
				filteralleleattr[key] = v
			}
		}
	}
	/*
    multi: vcf info field locus-level
    */
	let filterlocusattr
	if (req.query.filterlocusattr) {
		filterlocusattr = {}
		for (const key in req.query.filterlocusattr) {
			const v = req.query.filterlocusattr[key]
			if (v.cutoffvalue != undefined) {
				// numeric
				filterlocusattr[key] = v
			} else {
				// categorical
				filterlocusattr[key] = v
			}
		}
	}

	let filter_sampleset
	if (req.query.sampleset) {
		const set = new Set()
		const sample2group = new Map()
		for (const i of req.query.sampleset) {
			for (const s of i.samples) {
				set.add(s)
				sample2group.set(s, i.name)
			}
		}
		if (set.size) {
			filter_sampleset = { set, sample2group }
		}
	}

	// TODO terms from locusAttribute

	/*
    multi: sample attributes selected to be hidden from client
    as defined in ds.cohort.sampleAttribute
    */
	let hiddensampleattr
	if (req.query.hiddensampleattr) {
		hiddensampleattr = {}
		for (const key in req.query.hiddensampleattr) {
			hiddensampleattr[key] = new Set(req.query.hiddensampleattr[key])
		}
	}

	// cache svcnv tk url index
	if (dsquery.url) {
		try {
			dsquery.dir = await utils.cache_index(dsquery.url, dsquery.indexURL)
		} catch (e) {
			return res.send({ error: 'svcnv file index url error' })
		}
	}

	// query svcnv
	const data_cnv = await handle_mdssvcnv_cnv(
		ds,
		dsquery,
		req,
		hiddendt,
		hiddensampleattr,
		hiddenmattr,
		filter_sampleset
	)

	// expression query
	const [expressionrangelimit, gene2sample2obj] = await handle_mdssvcnv_expression(ds, dsquery, req, data_cnv)

	// vcf query
	// for both single- and multi sample
	// each member track has its own data type
	// querying procedure is the same for all types, data parsing will be different
	const [vcfrangelimit, data_vcf] = await handle_mdssvcnv_vcf(
		gn,
		ds,
		dsquery,
		req,
		filteralleleattr,
		filterlocusattr,
		hiddendt,
		hiddenmattr,
		hiddensampleattr,
		filter_sampleset
	)

	// group samples by svcnv, calculate expression rank
	const sample2item = mdssvcnv_do_sample2item(data_cnv)

	/*
    if(req.query.showonlycnvwithsv) {
    	mdssvcnv_do_showonlycnvwithsv(sample2item)
    }
    */

	if (req.query.singlesample) {
		/*
        exit
        single sample does not include expression
        but will include vcf
        */
		const result = {
			lst: sample2item.get(req.query.singlesample)
		}

		if (vcfrangelimit) {
			// out of range
			result.vcfrangelimit = vcfrangelimit
		} else {
			result.data_vcf = data_vcf
		}

		res.send(result)
		return
	}

	const samplegroups = handle_mdssvcnv_groupsample(ds, dsquery, data_cnv, data_vcf, sample2item, filter_sampleset)

	const result = {
		samplegroups,
		vcfrangelimit,
		data_vcf
	}

	// QUICK FIX!!
	if (req.query.getallsamples && dsquery.allow_getallsamples) {
		result.getallsamples = true
	}

	if (dsquery.checkrnabam) {
		// should be only one querying region
		await handle_mdssvcnv_rnabam(req.query.rglst[0], gn, dsquery, result)
		// added result.checkrnabam[{}]
	} else {
		handle_mdssvcnv_addexprank(result, ds, expressionrangelimit, gene2sample2obj)
	}

	handle_mdssvcnv_end(ds, result)

	res.send(result)
}

async function mdssvcnv_exit_assaymap(req, res, ds) {
	try {
		if (!ds.assayAvailability) throw 'assay availability not enabled for this dataset'
		const skip_termids = new Set(req.query.skip_termids || [])
		const sample2assay = new Map()
		// k: sample
		// v: Map( assay => 'yes')
		for (const n in ds.cohort.annotation) {
			if (req.query.key) {
				// only keep samples matching with key/value
				const s = ds.cohort.annotation[n]
				if (s[req.query.key] != req.query.value) continue
			}
			sample2assay.set(n, new Map())
		}
		for (const [sample, k2v] of sample2assay) {
			const a = ds.assayAvailability.samples.get(sample)
			if (!a) continue
			for (const t of ds.assayAvailability.assays) {
				if (skip_termids.has(t.id)) continue
				if (a[t.id]) {
					k2v.set(t.id, 'yes')
				}
			}
		}
		for (const sample of sample2assay.keys()) {
			if (sample2assay.get(sample).size == 0) sample2assay.delete(sample)
		}
		const data = {}
		data.totalsample = sample2assay.size
		data.terms = draw_partition({
			sample2term: sample2assay,
			terms: ds.assayAvailability.assays,
			config: {
				termidorder: req.query.termidorder // optional
			}
		})
		res.send(data)
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

async function handle_mdssvcnv_rnabam(region, genome, dsquery, result) {
	/*
    runs on a vcf matrix, and one rna bam file for each sample
    hardcoded to query first region
    irrelevant to samplegroup from svcnv query
    */

	if (!dsquery.checkvcf) return
	if (region.stop - region.start >= 500000) {
		result.expressionrangelimit = 500000
		return
	}

	const genetk = genome.tracks.find(i => i.__isgene)

	const genes = await handle_ase_getgenes(genome, genetk, region.chr, region.start, region.stop)

	let start = null,
		stop
	for (const o of genes.values()) {
		if (start == null) {
			start = o.start
			stop = o.stop
		} else {
			start = Math.min(start, o.start)
			stop = Math.max(stop, o.stop)
		}
	}

	await handle_mdssvcnv_rnabam_do(genes, region.chr, start, stop, dsquery, result)
}

async function handle_mdssvcnv_rnabam_do(genes, chr, start, stop, dsquery, result) {
	/* actually do
    works for normal query and adding fixed gene in expression column
    */

	const snps = await handle_mdssvcnv_rnabam_getsnp(dsquery, chr, start, stop)
	const testlines = []

	for (const samplename in dsquery.checkrnabam.samples) {
		// for each gene, record het snp from this sample of this gene
		const sbam = dsquery.checkrnabam.samples[samplename]
		sbam.hetsnps = [] // all het for this sample

		for (const m of snps) {
			const het = handle_ase_hetsnp4sample(m, samplename, dsquery.checkrnabam)
			if (het && het.dnacount.ishet) sbam.hetsnps.push(het)
		}

		if (sbam.url) {
			// even if no het snp still init dir, will calculate fpkm later for all bams
			sbam.dir = await utils.cache_index(sbam.url, sbam.indexURL || sbam.url + '.bai')
		} else if (sbam.file) {
			sbam.file = path.join(serverconfig.tpmasterdir, sbam.file)
		}

		if (sbam.hetsnps.length > 0) {
			// do one pileup for these snp over this bam
			await handle_mdssvcnv_rnabam_pileup(sbam, sbam.hetsnps, chr, dsquery.checkrnabam)
			for (const m of sbam.hetsnps) {
				if (m.rnacount.nocoverage) continue
				if (m.rnacount.ref + m.rnacount.alt < dsquery.checkrnabam.rna_mintotalreads) continue
				testlines.push(
					samplename +
						'.' +
						m.pos +
						'.' +
						m.ref +
						'.' +
						m.alt +
						'\t\t\t\t\t\t\t\t' +
						m.rnacount.ref +
						'\t' +
						m.rnacount.alt
				)
			}
		}
	}

	if (testlines.length > 0) {
		await handle_mdssvcnv_rnabam_binom(testlines, dsquery.checkrnabam.samples)
	}

	result.checkrnabam = []

	for (const samplename in dsquery.checkrnabam.samples) {
		const sbam = dsquery.checkrnabam.samples[samplename]

		const thisgenes = []
		for (const [genename, genepos] of genes) {
			// one obj for each gene
			const outputgene = {
				gene: genename,
				chr: chr,
				start: genepos.start,
				stop: genepos.stop
			}

			// het snps within this gene
			const thishetsnp = sbam.hetsnps.filter(m => m.pos >= genepos.start && m.pos <= genepos.stop)
			// het snps covered in rna
			const rnasnp = thishetsnp.filter(m => !m.rnacount.nocoverage)

			if (rnasnp.length > 0) {
				const deltasum = rnasnp.reduce((i, j) => i + Math.abs(j.rnacount.f - 0.5), 0)

				// geometric mean
				let mean = null
				// number of ase markers by pvalue cutoff
				let ase_markers = 0
				for (const s of rnasnp) {
					// if rna read count below cutoff, then pvalue is undefined
					if (s.rnacount.pvalue != undefined) {
						if (mean == null) mean = s.rnacount.pvalue
						else mean *= s.rnacount.pvalue

						if (s.rnacount.pvalue <= dsquery.checkrnabam.binompvaluecutoff) {
							ase_markers++
						}
					}
				}

				if (mean != null) {
					// has snp with valid pvalue
					outputgene.ase = {
						markers: thishetsnp.filter(i => i.dnacount.ishet).length,
						ase_markers: ase_markers,
						mean_delta: deltasum / rnasnp.length,
						geometricmean: Math.pow(mean, 1 / rnasnp.length)
					}
				}
			}

			let count
			if (sbam.pairedend) {
				count = await handle_mdssvcnv_rnabam_genefragcount(sbam, chr, genepos)
			} else {
				count = await handle_mdssvcnv_rnabam_genereadcount(sbam, chr, genepos)
			}

			outputgene.fpkm = (count * 1000000000) / (sbam.totalreads * genepos.exonlength)
			outputgene.snps = thishetsnp

			thisgenes.push(outputgene)
		}
		if (thisgenes.length) {
			result.checkrnabam.push({
				sample: samplename,
				genes: thisgenes
			})
		}
	}
}

async function handle_mdssvcnv_rnabam_genereadcount(bam, chr, gene) {
	/* get # of reads for single-end sequencing over exons
    .exonunion[
    	[ start, stop ], e2, ...
    ]
    */
	const args = ['view', '-c', '-M', bam.url || bam.file]
	for (const e of gene.exonunion) {
		args.push((bam.nochr ? chr.replace('chr', '') : chr) + ':' + (e[0] + 1) + '-' + (e[1] + 1))
	}
	let line
	await utils.get_lines_bigfile({
		isbam: true,
		args,
		dir: bam.dir,
		callback: ln => (line = ln)
	})
	return Number.parseInt(line)
}

function handle_mdssvcnv_rnabam_genefragcount(bam, chr, gene) {
	// for paired-end, over exons
	return new Promise((resolve, reject) => {
		const args = ['view', '-M', bam.url || bam.file]
		for (const e of gene.exonunion) {
			args.push((bam.nochr ? chr.replace('chr', '') : chr) + ':' + (e[0] + 1) + '-' + (e[1] + 1))
		}

		const p1 = spawn(samtools, args, { cwd: bam.dir })
		const p2 = spawn('cut', ['-f1'], { cwd: bam.dir })
		const p3 = spawn('sort', ['-u'], { cwd: bam.dir })
		const p4 = spawn('wc', ['-l'], { cwd: bam.dir })
		p1.stdout.pipe(p2.stdin)
		p2.stdout.pipe(p3.stdin)
		p3.stdout.pipe(p4.stdin)
		const out = [],
			out2 = []
		p4.stdout.on('data', i => out.push(i))
		p4.stderr.on('data', i => out2.push(i))
		p4.on('close', () => {
			resolve(Number.parseInt(out.join('')))
		})
	})
}

async function handle_mdssvcnv_rnabam_binom(lines, samples) {
	const infile = await handle_mdssvcnv_rnabam_binom_write(lines)
	const pfile = await handle_ase_binom_test(infile)
	await handle_mdssvcnv_rnabam_binom_result(pfile, samples)
	fs.unlink(infile, () => {})
	fs.unlink(pfile, () => {})
}

function handle_mdssvcnv_rnabam_binom_write(lines) {
	const snpfile = path.join(serverconfig.cachedir, Math.random().toString())
	return new Promise((resolve, reject) => {
		fs.writeFile(snpfile, lines.join('\n') + '\n', err => {
			if (err) reject('cannot write')
			resolve(snpfile)
		})
	})
}

function handle_mdssvcnv_rnabam_binom_result(pfile, samples) {
	return new Promise((resolve, reject) => {
		fs.readFile(pfile, 'utf8', (err, data) => {
			if (err) reject('cannot read binom pvalue')
			if (!data) {
				resolve()
				return
			}
			for (const line of data.trim().split('\n')) {
				const l = line.split('\t')
				const tmp = l[0].split('.')
				const sbam = samples[tmp[0]]
				if (!sbam) {
					// should not happen
					continue
				}
				const m = sbam.hetsnps.find(i => i.pos + '.' + i.ref + '.' + i.alt == tmp[1] + '.' + tmp[2] + '.' + tmp[3])
				if (m) {
					m.rnacount.pvalue = Number.parseFloat(l[10])
				}
			}
			resolve()
		})
	})
}

function handle_mdssvcnv_rnabam_pileup(bam, snps, chr, arg) {
	// only query said snps
	const lst = []
	for (const m of snps) {
		m.rnacount = {
			nocoverage: 1
		}
		lst.push((bam.nochr ? chr.replace('chr', '') : chr) + ':' + (m.pos + 1) + '-' + (m.pos + 1))
	}

	return new Promise((resolve, reject) => {
		const sp = spawn(
			bcftools,
			[
				'mpileup',
				'--no-reference',
				'-a',
				'INFO/AD',
				'-d',
				999999,
				'-r',
				lst.join(','),
				'-q',
				arg.rnapileup_q,
				'-Q',
				arg.rnapileup_Q,
				bam.url || bam.file
			],
			{ cwd: bam.dir }
		)

		const rl = readline.createInterface({ input: sp.stdout })
		rl.on('line', line => {
			if (line[0] == '#') return

			const m0 = mpileup_parsevcf_dp_ad(line)
			if (!m0) return

			const m = snps.find(m => m.pos == m0.pos)
			if (m) {
				// a het snp
				const c1 = m0.allele2count[m.ref] || 0
				const c2 = m0.allele2count[m.alt] || 0

				if (c1 + c2 > 0) {
					// has coverage at this snp
					m.rnacount = {
						ref: c1,
						alt: c2,
						f: c2 / (c1 + c2)
					}
				}
			}
		})

		sp.on('close', () => {
			resolve()
		})
	})
}

async function handle_mdssvcnv_rnabam_getsnp(dsquery, chr, start, stop) {
	/*
    hardcoded to query first vcf track
    */

	const x = dsquery.checkvcf.tracks[0]
	const vobj = {
		file: x.file,
		url: x.url,
		indexURL: x.indexURL,
		dir: x.dir,
		nochr: x.nochr,
		samples: x.samples,
		info: dsquery.checkvcf.info,
		format: x.format
	}

	const lines = await tabix_getlines(
		vobj.file ? path.join(serverconfig.tpmasterdir, vobj.file) : vobj.url,
		(vobj.nochr ? chr.replace('chr', '') : chr) + ':' + start + '-' + stop,
		vobj.dir
	)

	const allsnps = []

	for (const line of lines || []) {
		const [badinfo, mlst, altinvalid] = vcf.vcfparseline(line, vobj)

		for (const m of mlst) {
			if (!common.basecolor[m.ref] || !common.basecolor[m.alt]) {
				// is not snp
				continue
			}
			if (!m.sampledata) continue
			allsnps.push(m)
		}
	}
	return allsnps
}

function handle_mdssvcnv_groupsample(ds, dsquery, data_cnv, data_vcf, sample2item, filter_sampleset) {
	// multi sample

	if (dsquery.hideLOHwithCNVoverlap) {
		// XXX this should be a query parameter instead, so this behavior is controllable on frontend
		mdssvcnv_do_copyneutralloh(sample2item)
	}

	// group sample by available attributes
	const samplegroups = []

	if (filter_sampleset) {
		// custom sample set

		const key2group = new Map()
		// key: group name, v: list of samples from that group

		for (const [n, items] of sample2item) {
			const groupname = filter_sampleset.sample2group.get(n)
			if (!key2group.has(groupname)) key2group.set(groupname, [])
			key2group.get(groupname).push({
				samplename: n, // hardcoded
				items: items
			})
		}

		if (data_vcf) {
			// has vcf data and not custom track
			for (const m of data_vcf) {
				if (m.dt == common.dtsnvindel) {
					for (const s of m.sampledata) {
						let notfound = true
						const groupname = filter_sampleset.sample2group.get(s.sampleobj.name)
						if (!key2group.has(groupname)) key2group.set(groupname, [])
						if (!key2group.get(groupname).find(i => i.samplename == s.sampleobj.name)) {
							key2group.get(groupname).push({
								samplename: s.sampleobj.name,
								items: []
							})
						}
					}
					continue
				}

				console.log('unknown dt when grouping samples from vcf: ' + m.dt)
			}
		}
		for (const [name, samples] of key2group) {
			samplegroups.push({ name, samples })
		}
	} else if (ds.cohort && ds.cohort.annotation && dsquery.groupsamplebyattr) {
		/**** group samples by predefined annotation attributes
        only for official ds

        when vcf data is present, must include them samples in the grouping too, but not the variants

        expression samples don't participate in grouping
        */

		const key2group = new Map()
		// k: group name string
		// v: [] list of samples

		// head-less samples
		const headlesssamples = []

		//// group the sv-cnv samples
		for (const [samplename, items] of sample2item) {
			mdssvcnv_grouper(samplename, items, key2group, headlesssamples, ds, dsquery)
		}

		if (data_vcf) {
			// group the vcf samples
			for (const m of data_vcf) {
				if (m.dt == common.dtsnvindel) {
					for (const s of m.sampledata) {
						mdssvcnv_grouper(s.sampleobj.name, [], key2group, headlesssamples, ds, dsquery)
					}
					continue
				}

				console.log('unknown dt when grouping samples from vcf data: ' + m.dt)
			}
		}

		// done grouping all samples

		for (const g of key2group.values()) {
			samplegroups.push(g)
			// add precomputed total count for each group
			if (dsquery.groupsamplebyattr.key2group) {
				const o = dsquery.groupsamplebyattr.key2group.get(g.name)
				if (o) g.sampletotalnum = o.samples.length
			}
		}

		if (headlesssamples.length) {
			samplegroups.push({
				name: 'Unannotated',
				samples: headlesssamples
			})
		}

		///////// FIXME jinghui nbl cell line mixed into st/nbl, to identify that this sample is cell line on client
		for (const g of samplegroups) {
			for (const s of g.samples) {
				if (ds.cohort.annotation[s.samplename]) {
					s.sampletype = ds.cohort.annotation[s.samplename].sample_type
				}
			}
		}
	} else {
		// custom track or no annotation, lump all in one group

		// cnv
		const samples = []
		for (const [n, items] of sample2item) {
			samples.push({
				samplename: n, // hardcoded
				items: items
			})
		}

		if (data_vcf) {
			// has vcf data and not custom track
			for (const m of data_vcf) {
				if (m.dt == common.dtsnvindel) {
					for (const s of m.sampledata) {
						let notfound = true
						for (const s2 of samples) {
							if (s2.samplename == s.sampleobj.name) {
								notfound = false
								break
							}
						}
						if (notfound) {
							samples.push({
								samplename: s.sampleobj.name,
								items: []
							})
						}
					}
					continue
				}

				console.log('unknown dt when grouping samples from vcf: ' + m.dt)
			}
		}

		if (samples.length) {
			samplegroups.push({ samples: samples })
		}
	}
	return samplegroups
}

function handle_mdssvcnv_addexprank(result, ds, expressionrangelimit, gene2sample2obj) {
	// assign expression rank for all samples listed in samplegroup
	// no returned value
	if (expressionrangelimit) {
		// view range too big above limit set by official track, no checking expression
		result.expressionrangelimit = expressionrangelimit
		return
	}
	if (gene2sample2obj) {
		// report coordinates for each gene back to client
		result.gene2coord = {}
		for (const [n, g] of gene2sample2obj) {
			result.gene2coord[n] = { chr: g.chr, start: g.start, stop: g.stop }
		}

		if (result.samplegroups.length == 0) {
			// got no samples from dna query
			return
		}

		if (result.getallsamples) {
			// QUICK FIX - only for custom track
			// merge all fpkm samples into result.samplegroups[0], so all samples will show
			const hassamples = new Set(result.samplegroups[0].samples.map(i => i.samplename))
			const toaddsamples = new Set()
			for (const [n, g] of gene2sample2obj) {
				for (const sample of g.samples.keys()) {
					if (hassamples.has(sample)) continue
					toaddsamples.add(sample)
				}
			}
			for (const sample of toaddsamples) {
				result.samplegroups[0].samples.push({ samplename: sample, items: [] })
			}
		}

		for (const g of result.samplegroups) {
			// expression ranking is within each sample group
			// collect expression data for each gene for all samples of this group
			const gene2allvalues = new Map()
			// k: gene, v: [ obj ]

			for (const [gene, tmp] of gene2sample2obj) {
				gene2allvalues.set(gene, [])

				for (const [sample, obj] of tmp.samples) {
					if (g.attributes && ds.cohort && ds.cohort.annotation) {
						/*
                        a group from official track could still be unannotated, skip them
                        */
						const anno = ds.cohort.annotation[sample]
						if (!anno) continue
						let annomatch = true
						for (const attr of g.attributes) {
							if (anno[attr.k] != attr.kvalue) {
								annomatch = false
								break
							}
						}
						if (annomatch) {
							gene2allvalues.get(gene).push(obj)
						}
					} else {
						// custom track, just one group for all samples
						gene2allvalues.get(gene).push(obj)
					}
				}
			}

			// for each gene, sort samples
			for (const [gene, lst] of gene2allvalues) {
				lst.sort((i, j) => i.value - j.value)
			}

			// for each sample, compute rank within its group
			for (const sample of g.samples) {
				sample.expressionrank = {}
				for (const [gene, allvalue] of gene2allvalues) {
					// allvalue is expression of this gene in all samples of this group
					// for this gene
					// expression value of this gene in this sample
					const thisobj = gene2sample2obj.get(gene).samples.get(sample.samplename)
					if (thisobj == undefined) {
						// not expressed
						continue
					}

					const rank = get_rank_from_sortedarray(thisobj.value, allvalue)
					sample.expressionrank[gene] = { rank: rank }

					for (const k in thisobj) {
						sample.expressionrank[gene][k] = thisobj[k]
					}
				}
			}
		}
	}
}

function handle_mdssvcnv_end(ds, result) {
	if (ds.cohort && ds.cohort.sampleAttribute && ds.cohort.sampleAttribute.attributes && ds.cohort.annotation) {
		result.sampleannotation = {}

		const useattrkeys = [] // some attr keys are hidden from client
		for (const key in ds.cohort.sampleAttribute.attributes) {
			const a = ds.cohort.sampleAttribute.attributes[key]
			if (!a.clientnoshow) useattrkeys.push(key)
		}

		for (const g of result.samplegroups) {
			for (const sample of g.samples) {
				const anno = ds.cohort.annotation[sample.samplename]
				if (anno) {
					const toclient = {} // annotations to client
					let hasannotation = false
					for (const key of useattrkeys) {
						const value = anno[key]
						if (value != undefined) {
							hasannotation = true
							toclient[key] = value
						}
					}
					if (hasannotation) {
						// ony pass on if this sample has valid annotation
						result.sampleannotation[sample.samplename] = toclient
					}
				}
			}
		}
	}
}

async function handle_mdssvcnv_vcf(
	genome,
	ds,
	dsquery,
	req,
	filteralleleattr,
	filterlocusattr,
	hiddendt,
	hiddenmattr,
	hiddensampleattr,
	filter_sampleset
) {
	let vcfquery
	if (dsquery.iscustom) {
		vcfquery = dsquery.checkvcf
	} else {
		// official
		if (dsquery.vcf_querykey) {
			if (ds.queries[dsquery.vcf_querykey]) {
				vcfquery = ds.queries[dsquery.vcf_querykey]
			}
		}
	}
	if (!vcfquery) {
		// no vcf query
		return [null, null]
	}

	if (req.query.singlesample && vcfquery.singlesamples) {
		const tmp = vcfquery.singlesamples.samples[req.query.singlesample]
		if (tmp) {
			// has a vcf file for this sample, query this instead
			const thisvcf = {
				file: path.join(serverconfig.tpmasterdir, tmp)
			}

			try {
				await fs.promises.stat(thisvcf.file)
			} catch (e) {
				// invalid file
				return [null, null]
			}

			// meta and header
			const mlines = await tabix_getvcfmeta(thisvcf.file)

			const [info, format, samples, err] = vcf.vcfparsemeta(mlines)
			if (err) throw err
			thisvcf.info = info
			thisvcf.format = format
			thisvcf.samples = samples
			thisvcf.nochr = await utils.tabix_is_nochr(thisvcf.file, null, genome)
			return handle_mdssvcnv_vcf_singlesample(
				req,
				ds,
				thisvcf,
				filteralleleattr,
				hiddendt,
				hiddenmattr,
				hiddensampleattr
			)
		}
	}

	// query cohort vcf files for both cohort and sample view
	// TODO separate range limits, above 1mb, do not show noncoding ones; above 3mb, do not show coding ones
	// also show alert message on client

	let viewrangeupperlimit = vcfquery.viewrangeupperlimit
	if (!viewrangeupperlimit && dsquery.iscustom) {
		// no limit set for custom track
		if (features.customMdsSingleSampleVcfNoRangeLimit) {
			// this server has no range limit
			viewrangeupperlimit = 0
		} else {
			// set a hard limit
			viewrangeupperlimit = 2000000
		}
	}

	if (req.query.singlesample) {
		// still limit in singlesample
		viewrangeupperlimit *= 5
	}

	if (viewrangeupperlimit) {
		const len = req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0)
		if (len >= viewrangeupperlimit) {
			return [viewrangeupperlimit, null]
		}
	}

	const tracktasks = []

	for (const vcftk of vcfquery.tracks) {
		const thistracktask = Promise.resolve()
			.then(() => {
				// for custom url the index has already been cached at initial load
				// still need to get cache dir for loading index
				if (vcftk.file) return ''
				return utils.cache_index(vcftk.url, vcftk.indexURL)
			})
			.then(dir => {
				vcftk.dir = dir // reuse in rnabam

				// get vcf data
				const variants = []

				const tasks = []
				for (const r of req.query.rglst) {
					const task = new Promise((resolve, reject) => {
						const ps = spawn(
							tabix,
							[
								vcftk.file ? path.join(serverconfig.tpmasterdir, vcftk.file) : vcftk.url,
								(vcftk.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop
							],
							{ cwd: dir }
						)
						const rl = readline.createInterface({
							input: ps.stdout
						})
						rl.on('line', line => {
							if (vcftk.type == common.mdsvcftype.vcf) {
								// bgzip vcf file

								const [badinfok, mlst, altinvalid] = vcf.vcfparseline(line, {
									nochr: vcftk.nochr,
									samples: vcftk.samples,
									info: vcfquery.info,
									format: vcftk.format
								})

								for (const m of mlst) {
									if (!m.sampledata) {
										// do not allow
										continue
									}

									if (filteralleleattr) {
										// filter using allele INFO

										let todrop = false

										for (const key in filteralleleattr) {
											const value = m.altinfo[key]
											if (value == undefined) {
												// no value
												todrop = true
												break
											}

											const attr = filteralleleattr[key]
											if (attr.cutoffvalue != undefined) {
												// is a numeric cutoff

												if (!Number.isFinite(value)) {
													// value of this mutation is not a number
													todrop = true
													break
												}

												if (attr.keeplowerthan) {
													if (value > attr.cutoffvalue) {
														todrop = true
														break
													}
												} else {
													if (value < attr.cutoffvalue) {
														todrop = true
														break
													}
												}
											} else {
												// categorical
												if (attr.includes(value)) {
													todrop = true
													break
												}
											}
										}
										if (todrop) {
											// drop this variant
											continue
										}
									}
									if (filterlocusattr) {
										// filter using allele INFO

										let todrop = false

										for (const key in filterlocusattr) {
											const _value = m.info[key]
											if (_value == undefined) {
												// no value
												todrop = true
												break
											}
											let value = _value
											if (Array.isArray(_value)) {
												value = _value[0]
												if (value == '.') {
													// no value
													todrop = true
													break
												}
											}

											const attr = filterlocusattr[key]
											if (attr.cutoffvalue != undefined) {
												// is a numeric cutoff

												if (!Number.isFinite(value)) {
													// value of this mutation is not a number
													todrop = true
													break
												}

												if (attr.keeplowerthan) {
													if (value > attr.cutoffvalue) {
														todrop = true
														break
													}
												} else {
													if (value < attr.cutoffvalue) {
														todrop = true
														break
													}
												}
											} else {
												// categorical
												if (attr.includes(value)) {
													todrop = true
													break
												}
											}
										}
										if (todrop) {
											// drop this variant
											continue
										}
									}

									{
										// for germline track:
										const lst = []
										for (const s of m.sampledata) {
											if (s.gtallref) {
												// drop ref/ref sample, should only happen for germline vcf
												continue
											}

											if (s.__gtalleles) {
												// germline - m.sampledata[] always have all the samples due to the old vcf processing
												// even if the sample does not carry m's alt allele
												if (s.__gtalleles.indexOf(m.alt) == -1) {
													continue
												}
												delete s.__gtalleles
											}

											lst.push(s)
										}
										if (lst.length == 0) {
											continue
										}
										m.sampledata = lst
									}

									// filters on samples

									if (req.query.singlesample) {
										let thissampleobj = null
										for (const s of m.sampledata) {
											if (s.sampleobj.name == req.query.singlesample) {
												thissampleobj = s
												break
											}
										}
										if (!thissampleobj) {
											// this variant is not in this sample
											continue
										}
										// alter
										m.sampledata = [thissampleobj]
									} else if (filter_sampleset) {
										const lst = m.sampledata.filter(s => filter_sampleset.set.has(s.sampleobj.name))
										if (lst.length) {
											m.sampledata = lst
										} else {
											continue
										}
									}

									if (hiddenmattr) {
										const samplesnothidden = []
										for (const s of m.sampledata) {
											let nothidden = true
											for (const key in hiddenmattr) {
												// attribute keys are FORMAT fields
												let value = s[key]
												if (value == undefined) {
													value = common.not_annotated
												}
												if (hiddenmattr[key].has(value)) {
													nothidden = false
													break
												}
											}
											if (nothidden) {
												samplesnothidden.push(s)
											}
										}
										if (samplesnothidden.length == 0) {
											// skip this variant
											continue
										}
										m.sampledata = samplesnothidden
									}

									if (hiddensampleattr && ds.cohort && ds.cohort.annotation) {
										/*
									drop sample by annotation
									FIXME this is not efficient
									ideally should identify samples from this vcf file to be dropped, the column # of them
									after querying the vcf file, cut these columns away
									*/
										const samplesnothidden = []
										for (const s of m.sampledata) {
											const sanno = ds.cohort.annotation[s.sampleobj.name]
											if (!sanno) {
												// sample has no annotation?
												continue
											}
											let nothidden = true
											for (const key in hiddensampleattr) {
												const value = sanno[key]
												if (hiddensampleattr[key].has(value)) {
													nothidden = false
													break
												}
											}
											if (nothidden) {
												samplesnothidden.push(s)
											}
										}
										if (samplesnothidden.length == 0) {
											// skip this variant
											continue
										}
										m.sampledata = samplesnothidden
									}

									// delete the obsolete attr
									for (const sb of m.sampledata) {
										delete sb.allele2readcount
									}

									delete m._m
									delete m.vcf_ID
									delete m.name

									m.dt = common.dtsnvindel
									variants.push(m)
									// mclass and rest will be determined at client, according to whether in gmmode and such
								}
							} else {
								console.error('unknown "type" from a vcf file')
							}
						})
						const errout = []
						ps.stderr.on('data', i => errout.push(i))
						ps.on('close', code => {
							const e = errout.join('')
							if (e && !tabixnoterror(e)) {
								reject(e)
								return
							}
							resolve()
						})
					})
					tasks.push(task)
				}

				return Promise.all(tasks).then(() => {
					return variants
				})
			})

		tracktasks.push(thistracktask)
	}

	return Promise.all(tracktasks).then(vcffiles => {
		// snv/indel data aggregated from multiple tracks
		const mmerge = []

		for (const eachvcf of vcffiles) {
			for (const m of eachvcf) {
				if (m.dt == common.dtsnvindel) {
					// snv/indel all follows vcf matrix, using sampledata[]

					if (!m.sampledata) {
						// no sample data, won't show
						continue
					}
					let notfound = true
					for (const m2 of mmerge) {
						if (m.chr == m2.chr && m.pos == m2.pos && m.ref == m2.ref && m.alt == m2.alt) {
							for (const s of m.sampledata) {
								m2.sampledata.push(s)
							}
							notfound = false
							break
						}
					}
					if (notfound) {
						mmerge.push(m)
					}
					continue
				}

				console.error('unknown dt: ' + m.dt)
			}
		}

		// variants may come from multiple files, sort again to avoid curious batch effect
		mmerge.sort((i, j) => i.pos - j.pos)

		return [null, mmerge]
	})
}

function handle_mdssvcnv_vcf_singlesample(req, ds, thisvcf, filteralleleattr, hiddendt, hiddenmattr, hiddensampleattr) {
	/*
query variants for a single sample, from a single vcf file

bad repetition
*/
	const variants = []

	const tasks = []
	for (const r of req.query.rglst) {
		const task = new Promise((resolve, reject) => {
			const ps = spawn(tabix, [
				thisvcf.file,
				(thisvcf.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop
			])
			const rl = readline.createInterface({ input: ps.stdout })
			rl.on('line', line => {
				const [badinfok, mlst, altinvalid] = vcf.vcfparseline(line, thisvcf)

				for (const m of mlst) {
					if (!m.sampledata) {
						// do not allow
						continue
					}

					// restrict to queried sample
					const thissampleobj = m.sampledata.find(i => i.sampleobj.name == req.query.singlesample)
					if (!thissampleobj) {
						// this variant is not in this sample
						continue
					}
					// delete the obsolete attr
					delete thissampleobj.allele2readcount
					// alter
					m.sampledata = [thissampleobj]

					if (filteralleleattr) {
						// filter using allele INFO

						let todrop = false

						for (const key in filteralleleattr) {
							const value = m.altinfo[key]
							if (value == undefined) {
								// no value
								todrop = true
								break
							}

							const attr = filteralleleattr[key]
							if (attr.cutoffvalue != undefined) {
								// is a numeric cutoff

								if (!Number.isFinite(value)) {
									// value of this mutation is not a number
									todrop = true
									break
								}

								if (attr.keeplowerthan) {
									if (value > attr.cutoffvalue) {
										todrop = true
										break
									}
								} else {
									if (value < attr.cutoffvalue) {
										todrop = true
										break
									}
								}
							}
						}
						if (todrop) {
							// drop this variant
							continue
						}
					}

					// TODO filter with locus INFO

					// for germline track:
					if (thissampleobj.gtallref) {
						// drop ref/ref sample, should only happen for germline vcf
						continue
					}
					if (thissampleobj.__gtalleles) {
						// germline - m.sampledata[] always have all the samples due to the old vcf processing
						// even if the sample does not carry m's alt allele
						if (thissampleobj.__gtalleles.indexOf(m.alt) == -1) {
							continue
						}
						delete thissampleobj.__gtalleles
					}

					if (hiddenmattr) {
						const samplesnothidden = []
						for (const s of m.sampledata) {
							let nothidden = true
							for (const key in hiddenmattr) {
								// attribute keys are FORMAT fields
								let value = s[key]
								if (value == undefined) {
									value = common.not_annotated
								}
								if (hiddenmattr[key].has(value)) {
									nothidden = false
									break
								}
							}
							if (nothidden) {
								samplesnothidden.push(s)
							}
						}
						if (samplesnothidden.length == 0) {
							// skip this variant
							continue
						}
						m.sampledata = samplesnothidden
					}

					if (hiddensampleattr && ds.cohort && ds.cohort.annotation) {
						/*
                        drop sample by annotation
                        FIXME this is not efficient
                        ideally should identify samples from this vcf file to be dropped, the column # of them
                        after querying the vcf file, cut these columns away
                        */
						const samplesnothidden = []
						for (const s of m.sampledata) {
							const sanno = ds.cohort.annotation[s.sampleobj.name]
							if (!sanno) {
								// sample has no annotation?
								continue
							}
							let nothidden = true
							for (const key in hiddensampleattr) {
								const value = sanno[key]
								if (hiddensampleattr[key].has(value)) {
									nothidden = false
									break
								}
							}
							if (nothidden) {
								samplesnothidden.push(s)
							}
						}
						if (samplesnothidden.length == 0) {
							// skip this variant
							continue
						}
						m.sampledata = samplesnothidden
					}

					delete m._m
					delete m.vcf_ID
					delete m.name

					m.dt = common.dtsnvindel
					variants.push(m)
				}
			})
			const errout = []
			ps.stderr.on('data', i => errout.push(i))
			ps.on('close', code => {
				const e = errout.join('')
				if (e && !tabixnoterror(e)) {
					reject(e)
					return
				}
				resolve()
			})
		})
		tasks.push(task)
	}

	return Promise.all(tasks).then(() => {
		return [null, variants]
	})
}

function handle_mdssvcnv_cnv(ds, dsquery, req, hiddendt, hiddensampleattr, hiddenmattr, filter_sampleset) {
	if (!dsquery.file && !dsquery.url) {
		// svcnv file is optional now
		return []
	}

	const tasks = []

	for (const r of req.query.rglst) {
		const task = new Promise((resolve, reject) => {
			const data = []
			const ps = spawn(
				tabix,
				[
					dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
					r.chr + ':' + r.start + '-' + r.stop
				],
				{ cwd: dsquery.dir }
			)
			const rl = readline.createInterface({
				input: ps.stdout
			})

			rl.on('line', line => {
				const l = line.split('\t')
				const start0 = Number.parseInt(l[1])
				const stop0 = Number.parseInt(l[2])

				let j
				try {
					j = JSON.parse(l[3])
				} catch (e) {
					// invalid json, todo: report error
					return
				}

				if (j.dt == undefined) {
					// todo: report bad lines
					return
				}

				if (hiddendt && hiddendt.has(j.dt)) {
					return
				}

				///// data-type specific handling and filtering

				if (j.dt == common.dtloh) {
					// loh
					if (j.segmean && req.query.segmeanValueCutoff && j.segmean < req.query.segmeanValueCutoff) {
						return
					}
					if (req.query.lohLengthUpperLimit) {
						if (stop0 - start0 > req.query.lohLengthUpperLimit) {
							return
						}
					}
					j.chr = l[0]
					j.start = start0
					j.stop = stop0
				} else if (j.dt == common.dtfusionrna || j.dt == common.dtsv) {
					// sv
					j._chr = l[0]
					j._pos = start0
					if (j.chrA) {
						j.chrB = l[0]
						j.posB = start0
					} else {
						j.chrA = l[0]
						j.posA = start0
					}
				} else if (j.dt == common.dtcnv) {
					// cnv
					if (req.query.hide_cnvloss && j.value < 0) return
					if (req.query.hide_cnvgain && j.value > 0) return

					if (req.query.valueCutoff) {
						if (Math.abs(j.value) < req.query.valueCutoff) {
							return
						}
					}
					if (req.query.bplengthUpperLimit) {
						if (stop0 - start0 > req.query.bplengthUpperLimit) {
							return
						}
					}
					j.chr = l[0]
					j.start = start0
					j.stop = stop0
				} else if (j.dt == common.dtitd) {
					j.chr = l[0]
					j.start = start0
					j.stop = stop0
				} else {
					console.error('unknown dt from svcnv file: ' + j.dt)
					return
				}

				if (req.query.singlesample) {
					// in single-sample mode
					if (j.sample != req.query.singlesample) {
						return
					}
				} else if (filter_sampleset) {
					if (!filter_sampleset.set.has(j.sample)) return
				} else if (j.sample && ds.cohort && ds.cohort.annotation) {
					// not single-sample
					// only for official ds

					// may apply sample annotation filtering
					const anno = ds.cohort.annotation[j.sample]
					if (!anno) {
						// this sample has no annotation at all, since it's doing filtering, will drop it
						return
					}

					// only check this here, because it requires sample annotation
					if (hiddensampleattr) {
						for (const key in hiddensampleattr) {
							const samplevalue = anno[key]
							if (hiddensampleattr[key].has(samplevalue)) {
								// this sample has hidden annotation
								return
							}
						}
					}
				}

				if (hiddenmattr) {
					// check mutation-level annotation
					for (const key in hiddenmattr) {
						let itemvalue = j.mattr ? j.mattr[key] : undefined
						if (itemvalue == undefined) {
							itemvalue = common.not_annotated
						}

						if (hiddenmattr[key].has(itemvalue)) {
							// this item has hidden annotation
							return
						}
					}
				}

				// this item is acceptable
				data.push(j)
			})

			const errout = []
			ps.stderr.on('data', i => errout.push(i))
			ps.on('close', code => {
				const e = errout.join('')
				if (e && !tabixnoterror(e)) {
					reject(e)
					return
				}
				resolve(data)
			})
		})
		tasks.push(task)
	}
	return Promise.all(tasks)
}

function mdssvcnv_do_sample2item(data_cnv) {
	/*
    transform data_cnv[] to sample2item

    to dedup, as the same cnv event may be retrieved multiple times by closeby regions, also gets set of samples for summary
    k: sample
    v: list of sv, cnv, loh

    do not include snvindel from vcf
    the current data_vcf is variant-2-sample
    if snvindel is spread across samples, the variant annotation must be duplicated too
    just pass the lot to client, there each variant will sort out annotation, then spread to samples while keeping pointers in sample-m to original m

    yet further complexity due to the need of grouping samples by server-side annotation
    which will require vcf samples all to be included in samplegroups

    expression rank will be assigned to samples in all groups
    for vcf samples to get expression rank, it also require them to be grouped!
    */
	const sample2item = new Map()

	for (const tmp of data_cnv) {
		for (const item of tmp) {
			if (!item.sample) {
				// must have sample
				continue
			}
			const sn = item.sample
			if (!sample2item.has(sn)) {
				sample2item.set(sn, [])
			}

			if (item._chr) {
				// sv, no checking against coordset
				sample2item.get(sn).push(item)
				continue
			}

			// new event
			delete item.sample
			delete item.sampletype
			sample2item.get(sn).push(item)
		}
	}
	return sample2item
}

function mdssvcnv_do_showonlycnvwithsv(sample2item) {
	/*
!!!do not use!!!!
for a cnv with both ends out of view range, there is no way to query the sv at its boundary regions so no way to know if "sv-supported"

arg is a map of sample to list of items
in each sample, for a cnv to be displayed, its ends must 
*/
	// if a sv breakpoint falls within this distance to a cnv boundary, will say this boundary is "sv-supported"
	//const maxsupportdist = 1000

	for (const [sample, lst] of sample2item) {
		const svchr2pos = {}
		// k: sv chr
		// v: set of sv breakpoint positions
		for (const j of lst) {
			if (j.dt == common.dtsv) {
				if (!svchr2pos[j.chrA]) {
					svchr2pos[j.chrA] = new Set()
				}
				svchr2pos[j.chrA].add(j.posA)
				if (!svchr2pos[j.chrB]) {
					svchr2pos[j.chrB] = new Set()
				}
				svchr2pos[j.chrB].add(j.posB)
			}
		}

		const keepitems = []
		for (const j of lst) {
			if (j._chr || j.loh) {
				keepitems.push(j)
				continue
			}
			if (!svchr2pos[j.chr]) continue

			let match = false
			for (const pos of svchr2pos[j.chr]) {
				if (pos >= j.start - 1000 && pos <= j.stop + 1000) {
					match = true
					break
				}
			}
			if (match) {
				keepitems.push(j)
			}
		}
		if (keepitems.length) {
			sample2item.set(sample, keepitems)
		} else {
			sample2item.delete(sample)
		}
	}
}

function mdssvcnv_do_copyneutralloh(sample2item) {
	/*
decide what's copy neutral loh
only keep loh with no overlap with cnv

quick fix: only do this filter when hideLOHwithCNVoverlap is true on the server-side mdssvcnv query object
*/
	for (const [sample, lst] of sample2item) {
		// put cnv and loh into respective maps, keyed by chr
		const chr2loh = new Map()
		const chr2cnv = new Map()
		const thissampleitems = []
		for (const i of lst) {
			if (i.dt == common.dtloh) {
				if (!chr2loh.has(i.chr)) chr2loh.set(i.chr, [])
				chr2loh.get(i.chr).push(i)
				continue
			}
			if (i.dt == common.dtcnv) {
				if (!chr2cnv.has(i.chr)) chr2cnv.set(i.chr, [])
				chr2cnv.get(i.chr).push(i)
			}
			thissampleitems.push(i)
		}

		if (chr2loh.size == 0) continue

		for (const [chr, lohlst] of chr2loh) {
			const cnvlst = chr2cnv.get(chr)
			if (!cnvlst) {
				// this sample has no cnv in view range, use all loh as copy neutral
				for (const i of lohlst) thissampleitems.push(i)
				continue
			}

			for (const loh of lohlst) {
				// for each loh
				let nocnvmatch = true
				for (const cnv of cnvlst) {
					if (Math.max(loh.start, cnv.start) < Math.min(loh.stop, cnv.stop)) {
						// this loh overlaps with a cnv, then it isn't copy neutral
						nocnvmatch = false
						break
					}
				}
				if (nocnvmatch) thissampleitems.push(loh)
			}
		}

		sample2item.set(sample, thissampleitems)
	}
}

function mdssvcnv_customtk_altersg_server(result, gene2sample2obj) {
	/*
    call this when there is vcf file for custom track
    will add all expression samples to sg
    */
	const allsamplenames = new Set()
	for (const [gene, tmp] of gene2sample2obj) {
		for (const [sample, o] of tmp.samples) {
			allsamplenames.add(sample)
		}
	}

	if (!result.samplegroups[0]) {
		// not a group, add all
		result.samplegroups[0] = { samples: [] }
		for (const s of allsamplenames) {
			result.samplesgroups[0].samples.push({
				samplename: s,
				items: []
			})
		}
		return
	}

	// add missing
	for (const s of allsamplenames) {
		if (!result.samplegroups[0].samples.find(s2 => s2.samplename == s)) {
			result.samplegroups[0].samples.push({
				samplename: s,
				items: []
			})
		}
	}
}

function mdssvcnv_grouper(samplename, items, key2group, headlesssamples, ds, dsquery) {
	/*
    helper function, used by both cnv and vcf
    to identify which group a sample is from, insert the group, then insert the sample
    */

	const sanno = ds.cohort.annotation[samplename]
	if (!sanno) {
		// this sample has no annotation
		headlesssamples.push({
			samplename: samplename, // hardcoded attribute name
			items: items
		})
		return
	}

	const headname = sanno[dsquery.groupsamplebyattr.attrlst[0].k]
	if (headname == undefined) {
		// head-less
		headlesssamples.push({
			samplename: samplename, // hardcoded
			items: items
		})
		return
	}

	const attrnames = []
	for (let i = 1; i < dsquery.groupsamplebyattr.attrlst.length; i++) {
		const v = sanno[dsquery.groupsamplebyattr.attrlst[i].k]
		if (v == undefined) {
			break
		}
		attrnames.push(v)
	}

	attrnames.unshift(headname)

	const groupname = attrnames.join(dsquery.groupsamplebyattr.attrnamespacer)

	if (!key2group.has(groupname)) {
		/*
        a new group
        need to get available full name for each attribute value for showing on client
        if attr.full is not available, just use key value
        */
		const attributes = []
		for (const attr of dsquery.groupsamplebyattr.attrlst) {
			const v = sanno[attr.k]
			if (v == undefined) {
				// ordered list, look no further
				break
			}
			const a = { k: attr.k, kvalue: v }
			if (attr.full) {
				a.full = attr.full
				a.fullvalue = sanno[attr.full]
			}
			attributes.push(a)
		}

		// to be replaced
		const levelnames = []
		for (const attr of dsquery.groupsamplebyattr.attrlst) {
			const v = sanno[attr.k]
			if (v == undefined) {
				break
			}
			const lname = (attr.full ? sanno[attr.full] : null) || v
			levelnames.push(lname)
		}

		key2group.set(groupname, {
			name: groupname,
			samples: [],
			attributes: attributes
		})
	}

	let notfound = true
	for (const s of key2group.get(groupname).samples) {
		if (s.samplename == samplename) {
			// same sample, can happen for vcf samples
			// combine data, actually none for vcf
			for (const m of items) {
				s.items.push(m)
			}
			notfound = false
			break
		}
	}

	if (notfound) {
		key2group.get(groupname).samples.push({
			samplename: samplename, // hardcoded
			items: items
		})
	}
}

function ase_testarg(q) {
	if (!Number.isFinite(q.dna_mintotalreads)) return 'invalid value for dna_mintotalreads'
	if (!Number.isFinite(q.rna_mintotalreads)) return 'invalid value for rna_mintotalreads'
	if (!Number.isFinite(q.hetsnp_minbaf)) return 'invalid value for hetsnp_minbaf'
	if (!Number.isFinite(q.hetsnp_maxbaf)) return 'invalid value for hetsnp_maxbaf'
	if (!Number.isFinite(q.rnapileup_q)) return 'invalid value for rnapileup_q'
	if (!Number.isFinite(q.rnapileup_Q)) return 'invalid value for rnapileup_Q'
}

async function handle_ase(req, res) {
	const q = req.query

	const fpkmrangelimit = 3000000
	const covplotrangelimit = 500000

	try {
		const genome = genomes[q.genome]
		if (!genome) throw 'invalid genome'
		if (!q.samplename) throw 'samplename missing'
		if (!q.chr) throw 'no chr'
		if (!q.start || !q.stop) throw 'no start/stop'
		if (!q.rnabarheight) throw 'no rnabarheight'
		if (!q.dnabarheight) throw 'no dnabarheight'
		if (!Number.isInteger(q.barypad)) throw 'invalid barypad'
		if (q.rnamax && !Number.isFinite(q.rnamax)) throw 'invalid value for rnamax'
		if (!q.checkrnabam) throw '.checkrnabam{} missing'
		const e = ase_testarg(q.checkrnabam)
		if (e) throw e

		if (!q.refcolor) q.refcolor = 'blue'
		if (!q.altcolor) q.altcolor = 'red'

		if (!genome.tracks) throw 'genome.tracks[] missing'

		// may designate specific gene track

		const genetk = genome.tracks.find(i => i.__isgene)
		if (!genetk) throw 'no gene track from this genome'

		await handle_ase_prepfiles(q, genome)

		const genes = await handle_ase_getgenes(genome, genetk, q.chr, q.start, q.stop)
		// k: symbol, v: {start,stop,exonlength}

		const result = {}

		if (q.stop - q.start < fpkmrangelimit) {
			for (const [n, g] of genes) {
				const b = {
					file: q.rnabamfile,
					url: q.rnabamurl,
					dir: q.rnabamurl_dir,
					nochr: q.rnabam_nochr
				}
				let count
				if (q.rnabamispairedend) {
					count = await handle_mdssvcnv_rnabam_genefragcount(b, q.chr, g)
				} else {
					count = await handle_mdssvcnv_rnabam_genereadcount(b, q.chr, g)
				}
				g.fpkm = (count * 1000000000) / (q.rnabamtotalreads * g.exonlength)
			}
		} else {
			// range too big for fpkm
			result.fpkmrangelimit = fpkmrangelimit
		}

		const [searchstart, searchstop, renderstart, renderstop] = handle_ase_definerange(q, genes)

		// all
		const snps = await handle_ase_getsnps(q, genome, genes, searchstart, searchstop)

		for (const m of snps) {
			m.rnacount = {
				nocoverage: 1
			}
		}

		let rnamax
		let plotter

		if (renderstop - renderstart >= covplotrangelimit) {
			// range too big for cov plot
			result.covplotrangelimit = covplotrangelimit
		} else {
			if (q.rnamax) {
				// fixed max
				rnamax = q.rnamax
			} else {
				rnamax = await handle_ase_bamcoverage1stpass(q, renderstart, renderstop)
				result.rnamax = rnamax
			}
			// plot coverage
			plotter = await handle_ase_bamcoverage2ndpass(q, renderstart, renderstop, snps, rnamax)
		}

		// check rna bam and plot markers
		result.coveragesrc = await handle_ase_pileup_plotsnp(
			q,
			snps,
			searchstart,
			searchstop,
			renderstart,
			renderstop,
			plotter,
			rnamax
		)

		// binom test
		await handle_ase_binom(snps, q)

		result.genes = handle_ase_generesult(snps, genes, q)

		// find dna max coverage for snps in plot range
		let dnamax = 0
		for (const m of snps) {
			if (m.dnacount && m.pos >= renderstart && m.pos <= renderstop) {
				dnamax = Math.max(dnamax, m.dnacount.ref + m.dnacount.alt)
			}
		}
		result.dnamax = dnamax

		res.send(result)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

async function handle_ase_binom(snps, q) {
	if (snps.length == 0) return
	const rnasnp = [] // should have suffcient coverage
	for (const m of snps) {
		if (m.rnacount.nocoverage) continue
		if (m.rnacount.ref + m.rnacount.alt < q.checkrnabam.rna_mintotalreads) continue
		rnasnp.push(m)
	}
	if (rnasnp.length == 0) return
	const snpfile = await handle_ase_binom_write(rnasnp)
	const pfile = await handle_ase_binom_test(snpfile)
	await handle_ase_binom_result(snps, pfile)
	fs.unlink(snpfile, () => {})
	fs.unlink(pfile, () => {})
}

function handle_ase_binom_result(snps, pfile) {
	return new Promise((resolve, reject) => {
		fs.readFile(pfile, 'utf8', (err, data) => {
			if (err) reject('cannot read binom pvalue')
			if (!data) resolve()
			for (const line of data.trim().split('\n')) {
				const l = line.split('\t')
				const m = snps.find(i => l[0] == i.pos + '.' + i.ref + '.' + i.alt)
				if (m) {
					m.rnacount.pvalue = Number.parseFloat(l[10])
				}
			}
			resolve()
		})
	})
}

function handle_ase_binom_test(snpfile) {
	const pfile = snpfile + '.pvalue'
	return new Promise((resolve, reject) => {
		const sp = spawn('Rscript', [path.join(serverconfig.binpath, 'utils/binom.R'), snpfile, pfile])
		sp.on('close', () => {
			resolve(pfile)
		})
		sp.on('error', e => {
			reject(`cannot do binom test: ${e}`)
		})
		sp.stderr.on('data', e => {
			reject(`cannot do binom test: ${e}`)
		})
	})
}

function handle_ase_binom_write(snps) {
	const snpfile = path.join(serverconfig.cachedir, Math.random().toString()) + '.snp'
	const data = []
	for (const s of snps) {
		if (s.rnacount.nocoverage) continue
		if (s.rnacount.ref == undefined || s.rnacount.alt == undefined) continue
		data.push(s.pos + '.' + s.ref + '.' + s.alt + '\t\t\t\t\t\t\t\t' + s.rnacount.ref + '\t' + s.rnacount.alt)
	}
	return new Promise((resolve, reject) => {
		fs.writeFile(snpfile, data.join('\n') + '\n', err => {
			if (err) {
				reject('cannot write')
			}
			resolve(snpfile)
		})
	})
}

function handle_ase_definerange(q, genes) {
	// may alter search start/stop by gene range

	let searchstart = q.start,
		searchstop = q.stop
	for (const [name, g] of genes) {
		searchstart = Math.min(searchstart, g.start)
		searchstop = Math.max(searchstop, g.stop)
	}

	const renderstart = q.start,
		renderstop = q.stop

	return [searchstart, searchstop, renderstart, renderstop]
}

function handle_ase_generesult(snps, genes, q) {
	/*
    snps
    genes
    k: symbol, v: {start,stop}
    */
	const out = []
	for (const [symbol, gene] of genes) {
		out.push(gene)

		const thissnps = snps.filter(m => m.pos >= gene.start && m.pos <= gene.stop)
		if (thissnps.length == 0) {
			gene.nosnp = 1
			continue
		}

		gene.snps = thissnps

		const rnasnp = thissnps.filter(i => i.rnacount.pvalue != undefined)
		if (rnasnp.length == 0) {
			gene.nornasnp = 1
			continue
		}
		const deltasum = rnasnp.reduce((i, j) => i + Math.abs(j.rnacount.f - 0.5), 0)

		// geometric mean
		let mean = null
		let ase_markers = 0
		for (const s of rnasnp) {
			if (mean == null) mean = s.rnacount.pvalue
			else mean *= s.rnacount.pvalue
			if (s.rnacount.pvalue <= q.checkrnabam.binompvaluecutoff) {
				ase_markers++
			}
		}
		gene.ase = {
			markers: thissnps.filter(i => i.dnacount.ishet).length,
			ase_markers: ase_markers,
			mean_delta: deltasum / rnasnp.length,
			geometricmean: Math.pow(mean, 1 / rnasnp.length)
		}
	}

	return out
}

async function handle_ase_bamcoverage1stpass(q, start, stop) {
	/*
    1st pass: get max
    */
	let m = 0
	await utils.get_lines_bigfile({
		isbam: true,
		args: [
			'depth',
			'-r',
			(q.rnabam_nochr ? q.chr.replace('chr', '') : q.chr) + ':' + (start + 1) + '-' + (stop + 1),
			'-g',
			'DUP',
			q.rnabamurl || q.rnabamfile
		],
		dir: q.rnabamurl_dir,
		callback: line => {
			const l = line.split('\t')
			if (l.length != 3) return
			const v = Number.parseInt(l[2])
			if (!Number.isInteger(v)) return
			m = Math.max(m, v)
		}
	})
	return m
}

async function handle_ase_bamcoverage2ndpass(q, start, stop, snps, rnamax) {
	/*
    2nd pass: plot coverage bar at each covered bp
    */

	// snps default to be no coverage in rna
	// for those in viewrange and covered in rna, record bar h
	const pos2snp = new Map()
	for (const m of snps) {
		if (!m.dnacount.ishet) {
			// not het
			continue
		}
		if (m.pos >= start && m.pos <= stop) {
			// in render range
			pos2snp.set(m.pos, m)
		}
	}

	const canvas = createCanvas(
		q.width * q.devicePixelRatio,
		(q.rnabarheight + q.barypad + q.dnabarheight) * q.devicePixelRatio
	)
	const ctx = canvas.getContext('2d')
	if (q.devicePixelRatio > 1) {
		ctx.scale(q.devicePixelRatio, q.devicePixelRatio)
	}

	let isbp = false,
		binbpsize,
		binpxw
	if (stop - start <= q.width) {
		// each bin is one bp
		isbp = true
		binbpsize = 1
		binpxw = q.width / (stop - start)
		ctx.lineWidth = binpxw
	} else {
		// each bin is one px
		binpxw = 1
		binbpsize = (stop - start) / q.width
		// line width is 1 by default
	}

	await utils.get_lines_bigfile({
		isbam: true,
		args: [
			'depth',
			'-r',
			(q.rnabam_nochr ? q.chr.replace('chr', '') : q.chr) + ':' + (start + 1) + '-' + (stop + 1),
			'-g',
			'DUP',
			q.rnabamurl || q.rnabamfile
		],
		dir: q.rnabamurl_dir,
		callback: line => {
			const l = line.split('\t')
			if (l.length != 3) return

			const pos = Number.parseInt(l[1]) - 1
			if (!Number.isInteger(pos)) return
			const v = Number.parseInt(l[2])
			if (!Number.isInteger(v)) return

			const h = (q.rnabarheight * Math.min(v, rnamax)) / rnamax
			const x = isbp ? (pos - start) * binpxw : (pos - start) / binbpsize
			ctx.strokeStyle = '#ccc'
			ctx.beginPath()
			ctx.moveTo(x + binpxw / 2, q.rnabarheight)
			ctx.lineTo(x + binpxw / 2, q.rnabarheight - h)
			ctx.stroke()
			ctx.closePath()
			if (v > rnamax) {
				ctx.strokeStyle = 'blue'
				ctx.beginPath()
				ctx.moveTo(x + binpxw / 2, 0)
				ctx.lineTo(x + binpxw / 2, 2)
				ctx.stroke()
				ctx.closePath()
			}
			const m = pos2snp.get(pos)
			if (m) {
				// matching a snp, record bar h
				m.rnacount.h = h
			}
		}
	})
	return {
		canvas,
		ctx,
		isbp,
		binpxw,
		binbpsize
	}
}

function handle_ase_pileup_plotsnp(q, snps, searchstart, searchstop, renderstart, renderstop, plotter, rnamax) {
	/*
q {}
.refcolor  .altcolor
.rnabam_nochr
.checkrnabam{}
*/

	const snpstr = [] // het only
	for (const m of snps) {
		if (!m.dnacount.ishet) {
			// not het
			continue
		}
		snpstr.push((q.rnabam_nochr ? q.chr.replace('chr', '') : q.chr) + ':' + (m.pos + 1) + '-' + (m.pos + 1))
	}

	return new Promise((resolve, reject) => {
		const sp = spawn(
			bcftools,
			[
				'mpileup',
				'-q',
				q.checkrnabam.rnapileup_q,
				'-Q',
				q.checkrnabam.rnapileup_Q,
				'--no-reference',
				'-a',
				'INFO/AD',
				'-d',
				999999,
				'-r',
				snpstr.join(','),
				q.rnabamurl || q.rnabamfile
			],
			{ cwd: q.rnabamurl_dir }
		)

		const rl = readline.createInterface({ input: sp.stdout })
		rl.on('line', line => {
			if (line[0] == '#') return

			const m0 = mpileup_parsevcf_dp_ad(line)
			if (!m0) return

			let renderx // for this nt; if set, means this nt is plotted

			if (m0.pos >= renderstart && m0.pos <= renderstop && m0.DP) {
				// in render range
			}

			const m = snps.find(m => m.pos == m0.pos)
			if (m) {
				// a het snp from query range, but may not in render range
				m.__x = renderx // could be undefined

				const c1 = m0.allele2count[m.ref] || 0
				const c2 = m0.allele2count[m.alt] || 0

				if (c1 + c2 > 0) {
					// has rna coverage at this snp
					delete m.rnacount.nocoverage
					m.rnacount.ref = c1
					m.rnacount.alt = c2
					m.rnacount.f = c2 / (c1 + c2)
				}
			}
		})

		sp.on('close', () => {
			if (!plotter) {
				// won't do plotting, beyond range
				resolve()
				return
			}

			const { canvas, ctx, binpxw } = plotter
			ctx.lineWidth = Math.max(3, binpxw) // temp fix to make snp bar thicker

			// done piling up, plot all snps in view range
			let dnamax = 0
			for (const m of snps) {
				if (!m.dnacount) continue
				if (m.pos < renderstart || m.pos > renderstop) continue
				m.__x = (q.width * (m.pos - renderstart)) / (renderstop - renderstart)
				dnamax = Math.max(dnamax, m.dnacount.ref + m.dnacount.alt)
			}

			for (const m of snps) {
				if (m.__x == undefined) continue

				if (!m.rnacount.nocoverage) {
					// rna
					// h is computed in 1st pass so could be missing...
					if (m.rnacount.h == undefined) {
						m.rnacount.h = (q.rnabarheight * (m.rnacount.ref + m.rnacount.alt)) / rnamax
					}
					ctx.strokeStyle = q.refcolor
					ctx.beginPath()
					ctx.moveTo(m.__x + binpxw / 2, q.rnabarheight)
					ctx.lineTo(m.__x + binpxw / 2, q.rnabarheight - (1 - m.rnacount.f) * m.rnacount.h)
					ctx.stroke()
					ctx.closePath()
					ctx.strokeStyle = q.altcolor
					ctx.beginPath()
					ctx.moveTo(m.__x + binpxw / 2, q.rnabarheight - (1 - m.rnacount.f) * m.rnacount.h)
					ctx.lineTo(m.__x + binpxw / 2, q.rnabarheight - m.rnacount.h)
					ctx.stroke()
					ctx.closePath()
				}

				// dna
				const h = (q.dnabarheight * (m.dnacount.ref + m.dnacount.alt)) / dnamax
				if (m.dnacount.ishet) {
					ctx.strokeStyle = q.refcolor
					ctx.beginPath()
					ctx.moveTo(m.__x + binpxw / 2, q.rnabarheight + q.barypad)
					ctx.lineTo(m.__x + binpxw / 2, q.rnabarheight + q.barypad + (1 - m.dnacount.f) * h)
					ctx.stroke()
					ctx.closePath()
					ctx.strokeStyle = q.altcolor
					ctx.beginPath()
					ctx.moveTo(m.__x + binpxw / 2, q.rnabarheight + q.barypad + (1 - m.dnacount.f) * h)
					ctx.lineTo(m.__x + binpxw / 2, q.rnabarheight + q.barypad + h)
					ctx.stroke()
					ctx.closePath()
				} else {
					/*
                    // not het, do not plot for now, should make it optional on UI
                    ctx.strokeStyle = '#ccc'
                    ctx.beginPath()
                    ctx.moveTo(m.__x + binpxw / 2, q.rnabarheight + q.barypad)
                    ctx.lineTo(m.__x + binpxw / 2, q.rnabarheight + q.barypad + h)
                    ctx.stroke()
                    ctx.closePath()
                    */
				}
				delete m.__x
			}

			resolve(canvas.toDataURL())
		})
	})
}

function mpileup_parsevcf_dp_ad(line) {
	// quick dirty, no header
	// hardcoded for AD DP
	// <ID=DP,Number=1,Type=Integer,Description="Raw read depth">
	// <ID=AD,Number=R,Type=Integer,Description="Total allelic depths">
	// 1	47838652	.	N	G,A,<*>	0	.	DP=200;AD=0,97,97,0;I16=0,0,125,69,

	const l = line.split('\t')
	if (l.length < 8) return

	const m = {
		pos: Number.parseInt(l[1]) - 1
	}
	const alleles = [l[3], ...l[4].split(',')]
	const info = {}
	for (const s of l[7].split(';')) {
		const k = s.split('=')
		info[k[0]] = k[1]
	}
	if (info.DP) m.DP = Number.parseInt(info.DP)
	if (info.AD) {
		m.allele2count = {}
		const lst = info.AD.split(',')
		for (const [i, allele] of alleles.entries()) {
			m.allele2count[allele] = Number.parseInt(lst[i])
		}
	}
	return m
}

async function handle_bamnochr(req, res) {
	const q = req.query
	try {
		const genome = genomes[q.genome]
		if (!genome) throw 'invalid genome'
		if (q.file) {
			q.file = path.join(serverconfig.tpmasterdir, q.file)
		} else {
			if (!q.url) throw 'no bam file or url'
			q.url_dir = await utils.cache_index(q.url, q.indexURL || q.url + '.bai')
		}

		const nochr = await utils.bam_ifnochr(q.file || q.url, genome, q.url_dir)
		res.send({ nochr: nochr })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

async function handle_ase_prepfiles(q, genome) {
	if (q.rnabamfile) {
		q.rnabamfile = path.join(serverconfig.tpmasterdir, q.rnabamfile)
	} else {
		if (!q.rnabamurl) throw 'no file or url for rna bam'
		q.rnabamurl_dir = await utils.cache_index(q.rnabamurl, q.rnabamindexURL || q.rnabamurl + '.bai')
	}

	q.rnabam_nochr = await utils.bam_ifnochr(q.rnabamfile || q.rnabamurl, genome, q.rnabamurl_dir)

	if (q.vcffile) {
		q.vcffile = path.join(serverconfig.tpmasterdir, q.vcffile)
	} else {
		if (!q.vcfurl) throw 'no file or url for vcf'
		q.vcfurl_dir = await utils.cache_index(q.vcfurl, q.vcfindexURL)
	}
	q.vcf_nochr = await utils.tabix_is_nochr(q.vcffile || q.vcfurl, q.vcfurl_dir, genome)
}

async function handle_ase_getsnps(q, genome, genes, searchstart, searchstop) {
	/*
    get all for showing in cov plot
    q:
    .checkrnabam{}
    .samplename
    .vcffile
    .vcfurl
    .vcfindexURL
    .chr
    */
	const mlines = await tabix_getvcfmeta(q.vcffile || q.vcfurl, q.vcfurl_dir)

	const [info, format, samples, err] = vcf.vcfparsemeta(mlines)
	if (err) throw err

	const vcfobj = {
		info: info,
		format: format,
		samples: samples
	}

	const lines = await tabix_getlines(
		q.vcffile || q.vcfurl,
		(q.vcf_nochr ? q.chr.replace('chr', '') : q.chr) + ':' + searchstart + '-' + searchstop,
		q.vcfurl_dir
	)

	const allsnps = []

	for (const line of lines || []) {
		const [badinfo, mlst, altinvalid] = vcf.vcfparseline(line, vcfobj)

		for (const m of mlst) {
			// if is snp
			if (!common.basecolor[m.ref] || !common.basecolor[m.alt]) {
				continue
			}
			// find sample
			if (!m.sampledata) continue

			const m2 = handle_ase_hetsnp4sample(m, q.samplename, q.checkrnabam)
			if (m2) {
				allsnps.push(m2)
			}
		}
	}

	const genesnps = []
	for (const m of allsnps) {
		for (const [g, p] of genes) {
			if (m.pos >= p.start && m.pos <= p.stop) {
				genesnps.push(m)
				break
			}
		}
	}

	return genesnps
}

function handle_ase_hetsnp4sample(m, samplename, arg) {
	/*
    cutoff values in arg{} must have all been validated
    always return a snp
    */

	const sobj = m.sampledata.find(i => i.sampleobj.name == samplename)
	if (!sobj) return

	if (sobj.AD) {
		const refcount = sobj.AD[m.ref] || 0
		const altcount = sobj.AD[m.alt] || 0
		const m2 = {
			chr: m.chr,
			pos: m.pos,
			ref: m.ref,
			alt: m.alt,
			dnacount: {
				ref: refcount,
				alt: altcount
			}
		}
		if (altcount + refcount == 0) {
			m2.dnacount.f = 0
		} else {
			m2.dnacount.f = altcount / (altcount + refcount)
		}

		if (refcount + altcount >= arg.dna_mintotalreads) {
			if (m2.dnacount.f >= arg.hetsnp_minbaf && m2.dnacount.f <= arg.hetsnp_maxbaf) {
				m2.dnacount.ishet = true
			}
		}
		return m2
	}

	// GT?

	return null
}

async function handle_ase_getgenes(genome, genetk, chr, start, stop) {
	// if not native track, must test chr
	const lines = await tabix_getlines(path.join(serverconfig.tpmasterdir, genetk.file), chr + ':' + start + '-' + stop)

	const symbol2lst = new Map()
	// k: symbol, v: list of isoforms

	if (lines) {
		for (const line of lines) {
			const l = line.split('\t')
			const j = JSON.parse(l[3])
			const start = Number.parseInt(l[1])
			const stop = Number.parseInt(l[2])
			if (symbol2lst.has(j.name)) {
				const s = symbol2lst.get(j.name)
				s.start = Math.min(s.start, start)
				s.stop = Math.max(s.stop, stop)
			} else {
				symbol2lst.set(j.name, {
					gene: j.name,
					start: start,
					stop: stop,
					exonunion: []
				})
			}

			const g = symbol2lst.get(j.name)

			if (j.exon) {
				// exon union
				for (const e of j.exon) {
					const e2 = g.exonunion.find(i => Math.max(i[0], e[0]) < Math.min(i[1], e[1]))
					if (e2) {
						e2[0] = Math.min(e[0], e2[0])
						e2[1] = Math.max(e[1], e2[1])
					} else {
						g.exonunion.push([e[0], e[1]])
					}
				}
			}
		}
	}

	// sum exon total length
	for (const [n, g] of symbol2lst) {
		g.exonlength = g.exonunion.reduce((i, j) => i + j[1] - j[0], 0)
	}

	return symbol2lst
}

async function tabix_getlines(file, coord, dir) {
	return new Promise((resolve, reject) => {
		const sp = spawn(tabix, [file, coord], { cwd: dir })
		const out = [],
			out2 = []
		sp.stdout.on('data', i => out.push(i))
		sp.stderr.on('data', i => out2.push(i))
		sp.on('close', () => {
			const err = out2.join('')
			if (err) reject(err)
			const str = out.join('').trim()
			if (!str) resolve()
			resolve(str.split('\n'))
		})
	})
}

function tabix_getvcfmeta(file, dir) {
	return new Promise((resolve, reject) => {
		const sp = spawn(tabix, ['-H', file], { cwd: dir })
		const out = [],
			out2 = []
		sp.stdout.on('data', i => out.push(i))
		sp.stderr.on('data', i => out2.push(i))
		sp.on('close', () => {
			const err = out2.join('')
			if (err) reject(err)
			const str = out.join('').trim()
			if (!str) reject('cannot list vcf meta lines')
			resolve(str.split('\n'))
		})
	})
}

function get_rank_from_sortedarray(v, lst) {
	// [ { value: v } ]
	// lst must be sorted ascending
	const i = lst.findIndex(j => j.value >= v)
	if (i == -1 || i == lst.length - 1) return 100
	if (i == 0) return 0
	return Math.ceil((100 * i) / lst.length)
}

function handle_mdsexpressionrank(req, res) {
	/*
    for a given sample, check expression rank of its gene expression as compared with its cohort
    similar task done in svcnv

    where is the data?
    - custom file
    - official ds, a query of flag isgenenumeric

    sample: req.query.sample
    range: req.query.coord
    cohort: for official, defined by req.query.attributes
            for custom, will use all available samples other than this one
    */
	let gn,
		ds,
		dsquery,
		samples = new Set() // to record all samples seen and report the total number

	Promise.resolve()
		.then(() => {
			if (!req.query.rglst) throw 'rglst missing'
			if (req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0) > 10000000)
				throw 'Zoom in below 10 Mb to show expression rank'
			if (!req.query.sample) throw 'sample missing'

			if (req.query.iscustom) {
				gn = genomes[req.query.genome]
				if (!gn) throw 'invalid genome'
				if (!req.query.file && !req.query.url) throw 'no file or url for expression data'
				ds = {}
				dsquery = {
					file: req.query.file,
					url: req.query.url,
					indexURL: req.query.indexURL
				}
			} else {
				// official
				const [err, gn1, ds1, dsquery1] = mds_query_arg_check(req.query)
				if (err) throw err
				gn = gn1
				ds = ds1
				dsquery = dsquery1

				if (!dsquery.samples) throw 'total samples missing from server config'
				// check if the said sample exists
				if (dsquery.samples.indexOf(req.query.sample) == -1) throw { nodata: 1 }
			}

			if (dsquery.viewrangeupperlimit) {
				if (req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0) > dsquery.viewrangeupperlimit)
					throw 'zoom in under ' + common.bplen(dsquery.viewrangeupperlimit) + ' to view data'
			}

			if (req.query.levelkey) {
				// only for official ds
				if (!req.query.levelvalue) throw 'levelvalue is required when levelkey is used'
				if (!ds.cohort || !ds.cohort.annotation) throw '.cohort.annotation missing from dataset'
			}

			if (dsquery.file) return
			if (!dsquery.url) throw 'file or url missing'

			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			const tasks = []

			for (const r of req.query.rglst) {
				tasks.push(
					new Promise((resolve, reject) => {
						const ps = spawn(
							tabix,
							[
								dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
								r.chr + ':' + r.start + '-' + r.stop
							],
							{ cwd: dir }
						)

						const rl = readline.createInterface({
							input: ps.stdout
						})

						const gene2value = new Map()

						rl.on('line', line => {
							const l = line.split('\t')
							const j = JSON.parse(l[3])

							if (!j.gene) return

							if (!j.sample) return

							if (!Number.isFinite(j.value)) return

							const chr = l[0]
							const start = Number.parseInt(l[1])
							const stop = Number.parseInt(l[2])

							if (j.sample == req.query.sample) {
								// a gene for the current sample
								if (!gene2value.has(j.gene)) {
									gene2value.set(j.gene, {
										chr: chr,
										start: start,
										stop: stop,
										allvalues: []
									})
								}
								gene2value.get(j.gene).thisvalue = j.value

								// additional stats about gene expression
								/* XXX OHE!!
                                if (j.outlier) {
                                	gene2value.get(j.gene).outlier = j.outlier
                                }
                                */
								if (j.ase) {
									gene2value.get(j.gene).ase = j.ase
								}
								return
							}

							if (req.query.attributes) {
								// official only,
								// filter for samples of the same cohort
								const sanno = ds.cohort.annotation[j.sample]
								if (!sanno) {
									// sample has no annotation
									return
								}
								for (const attr of req.query.attributes) {
									if (attr.k && attr.kvalue) {
										if (attr.kvalue != sanno[attr.k]) {
											// not a sample for this cohort
											return
										}
									}
								}
							}

							// now it is a sample for the group

							samples.add(j.sample)

							if (!gene2value.has(j.gene)) {
								gene2value.set(j.gene, {
									chr: chr,
									start: start,
									stop: stop,
									allvalues: []
								})
							}
							gene2value.get(j.gene).allvalues.push({
								value: j.value
							})
						})

						const errout = []
						ps.stderr.on('data', i => errout.push(i))
						ps.on('close', code => {
							const e = errout.join('')
							if (e && !tabixnoterror(e)) reject({ message: e })
							resolve(gene2value)
						})
					})
				)
			}

			return Promise.all(tasks)
		})
		.then(results => {
			const lst = []
			for (const gene2value of results) {
				for (const [gene, o] of gene2value) {
					if (o.thisvalue == undefined) continue

					o.allvalues.sort((i, j) => i.value - j.value)
					o.rank = get_rank_from_sortedarray(o.thisvalue, o.allvalues)
					delete o.allvalues

					o.gene = gene
					lst.push(o)
				}
			}
			res.send({
				result: lst,
				samplecount: samples.size
			})
		})
		.catch(err => {
			if (err.stack) console.log(err)
			if (err.nodata) {
				res.send({ nodata: 1 })
			} else {
				res.send({ error: err.message ? err.message : err })
			}
		})
}

function mdssvcnv_exit_gettrack4singlesample(req, res, ds) {
	/*
    getting track for single sample from server config
    only for official dataset
    */
	const samplename = req.query.gettrack4singlesample
	if (req.query.iscustom) {
		// not supported
		return res.send({ error: 'no server-side config available for custom track' })
	}
	if (!ds.sampleAssayTrack) {
		// not available
		return res.send({})
	}
	return res.send({
		tracks: ds.sampleAssayTrack.samples.get(samplename)
	})
}

function mdssvcnv_exit_ifsamplehasvcf(req, res, gn, ds, dsquery) {
	if (req.query.iscustom) return res.send({ no: 1 })
	if (!dsquery.vcf_querykey) {
		// no vcf query, should be speedy and allow
		return res.send({ yes: 1 })
	}
	const vcfq = ds.queries[dsquery.vcf_querykey]
	if (!vcfq) return res.send({ error: 'vcf query missing' })
	res.send(vcfq.singlesamples ? { yes: 1 } : { no: 1 })
}

function mdssvcnv_exit_getsample4disco(req, res, gn, ds) {
	/*
    a text file for a single sample
    only for official dataset
    */
	if (req.query.iscustom) return res.send({ error: 'not for custom track' })
	if (!ds.singlesamplemutationjson)
		return res.send({ error: 'singlesamplemutationjson not available for this dataset' })
	const samplename = req.query.getsample4disco
	// NOTE: this acts as a whitelist for samplename, will not allow loading
	// arbitrary file paths so no need to check with utils.illegalpath()
	const f0 = ds.singlesamplemutationjson.samples[samplename]
	if (!f0) return res.send({ error: 'no data' })
	const file = path.join(serverconfig.tpmasterdir, f0)
	fs.readFile(file, { encoding: 'utf8' }, (err, data) => {
		if (err) return res.send({ error: 'error getting data for this sample' })
		res.send({ text: data })
	})
}

async function mdssvcnv_exit_getexpression4gene(req, res, gn, ds, dsquery) {
	/*
    get expression data for a gene

    gene name up/lower case confusion here
    - query name
    - gene name in fpkm file
    - in rnabam mode, gene name in gene track
    */

	try {
		const q = req.query.getexpression4gene
		if (!q.chr) throw 'chr missing'
		if (!Number.isFinite(q.start)) throw 'invalid start pos'
		if (!Number.isFinite(q.stop)) throw 'invalid stop pos'
		if (!q.name) throw 'unknown gene name'

		if (dsquery.checkrnabam) {
			// need to construct the gene obj
			const genome = genomes[req.query.genome]
			const genetk = genome.tracks.find(i => i.__isgene)
			const genes = await handle_ase_getgenes(genome, genetk, q.chr, q.start, q.stop)
			const gene = genes.get(q.name)
			if (!gene) throw 'no gene matching with ' + q.name

			const tmp = {}
			await handle_mdssvcnv_rnabam_do(new Map([[q.name, gene]]), q.chr, q.start, q.stop, dsquery, tmp)
			const sample2rnabam = {}
			for (const s of tmp.checkrnabam) {
				if (s.genes) {
					const g = s.genes.find(i => i.gene == q.name)
					if (g) {
						sample2rnabam[s.sample] = g
					}
				}
			}
			res.send({ sample2rnabam: sample2rnabam })
			return
		}

		let _c
		if (dsquery.iscustom) {
			_c = dsquery.checkexpressionrank
		} else {
			if (dsquery.expressionrank_querykey) {
				_c = ds.queries[dsquery.expressionrank_querykey]
			}
		}
		if (!_c) throw 'missing expression data source'

		const dir = _c.file ? null : await utils.cache_index(_c.url, _c.indexURL)

		const values = []
		await utils.get_lines_bigfile({
			args: [_c.file ? path.join(serverconfig.tpmasterdir, _c.file) : _c.url, q.chr + ':' + q.start + '-' + q.stop],
			dir,
			callback: line => {
				const l = line.split('\t')
				let j
				try {
					j = JSON.parse(l[3])
				} catch (e) {
					reject('invalid json from expression data')
				}
				if (!j.sample) return
				if (!j.gene) return
				if (!Number.isFinite(j.value)) return
				delete j.outlier // XXX OHE
				if (j.gene.toLowerCase() == q.name.toLowerCase()) {
					values.push(j)
				}
			}
		})

		// convert to rank
		const sample2rank = mdssvcnv_exit_getexpression4gene_rank(ds, dsquery, values)

		res.send({ sample2rank: sample2rank })
	} catch (err) {
		if (err.stack) console.error(err.stack)
		res.send({ error: err.message || err })
	}
}

function mdssvcnv_exit_getexpression4gene_rank(ds, dsquery, values) {
	/*
    values: [ {sample, value, ase, outlier } ]
    for each value, convert to rank

    if native, may group samples by attr
    otherwise, use all samples as a group
    */

	const sample2rank = {}

	if (ds && ds.cohort && ds.cohort.annotation && dsquery.groupsamplebyattr && dsquery.groupsamplebyattr.attrlst) {
		// native, and with required attr

		const groups = new Map()

		for (const vo of values) {
			// vo: {value, ase, outlier, sample}

			const anno = ds.cohort.annotation[vo.sample]
			if (!anno) continue

			const tmp = []
			for (const a of dsquery.groupsamplebyattr.attrlst) {
				tmp.push(anno[a.k])
			}
			const grouplabel = tmp.join(',') // won't be shown on client

			if (!groups.has(grouplabel)) groups.set(grouplabel, [])

			groups.get(grouplabel).push(vo)
		}

		for (const lst of groups.values()) {
			// each group
			lst.sort((a, b) => a.value - b.value)
			for (const vo of lst) {
				vo.rank = get_rank_from_sortedarray(vo.value, lst)
				sample2rank[vo.sample] = vo
			}
		}
	} else {
		// anything else, include all samples into one group
		values.sort((a, b) => a.value - b.value)
		for (const vo of values) {
			vo.rank = get_rank_from_sortedarray(vo.value, values)
			sample2rank[vo.sample] = vo
		}
	}

	return sample2rank
}

function mdssvcnv_exit_findsamplename(req, res, ds) {
	/*
    find sample names by matching with input string
    only for official dataset
    */
	if (req.query.iscustom) {
		// not supported
		return res.send({ error: 'cannot search sample by name in custom track' })
	}
	const str = req.query.findsamplename.toLowerCase()

	// must return grouping attributes for launching expression rank
	const result = []

	if (!ds.cohort.__samplelst) {
		// array of lower case sample names
		// only init once
		ds.cohort.__samplelst = []
		for (const name in ds.cohort.annotation) {
			ds.cohort.__samplelst.push({
				name,
				low: name.toLowerCase()
			})
		}
	}
	findadd(ds.cohort.__samplelst)

	// list of samples ready to be returned to client
	// now append attributes to found samples

	// get the svcnv query for checking stuff
	for (const k in ds.queries) {
		const q = ds.queries[k]
		if (q.type == common.tkt.mdssvcnv) {
			if (q.groupsamplebyattr) {
				for (const s of result) {
					const a = ds.cohort.annotation[s.name]
					if (!a) continue
					const lst = []
					for (const attr of q.groupsamplebyattr.attrlst) {
						const v = a[attr.k]
						if (v) {
							lst.push({
								k: attr.k,
								kvalue: v
							})
						}
					}
					if (lst.length) {
						s.attributes = lst
						s.grouplabel = lst.map(i => i.kvalue).join(q.groupsamplebyattr.attrnamespacer)
					}
				}
			}
		}
	}

	if (ds.cohort && ds.cohort.sampleAttribute && ds.cohort.sampleAttribute.attributes && ds.cohort.annotation) {
		for (const sample of result) {
			const anno = ds.cohort.annotation[sample.name]
			if (!anno) continue
			const toclient = [] // annotations to client
			for (const key in ds.cohort.sampleAttribute.attributes) {
				if (ds.cohort.sampleAttribute.attributes[key].clientnoshow) {
					continue
				}
				const value = anno[key]
				if (value != undefined) {
					toclient.push({ k: key, v: value })
				}
			}
			if (toclient.length) {
				sample.attr = toclient
			}
		}
	}

	if (ds.sampleAssayTrack) {
		for (const sample of result) {
			const a = ds.sampleAssayTrack.samples.get(sample.name)
			if (a) {
				sample.num_assay_tracks = a.length
			}
		}
	}

	if (ds.cohort && ds.cohort.mutation_signature) {
		for (const k in ds.cohort.mutation_signature.sets) {
			const s = ds.cohort.mutation_signature.sets[k]
			if (s.samples) {
				for (const ss of result) {
					if (s.samples.map.has(ss.name)) {
						ss.mutation_signature = 1
					}
				}
			}
		}
	}

	if (ds.singlesamplemutationjson) {
		// if has disco
		for (const s of result) {
			if (ds.singlesamplemutationjson.samples[s.name]) {
				s.disco = 1
			}
		}
	}

	return res.send({ result })

	function findadd(samples) {
		for (const s of samples) {
			if (result.length > 10) return

			if (s.low.indexOf(str) == -1) continue

			if (result.find(i => i.name == s.name)) {
				// already found it
				continue
			}
			result.push(s)
		}
	}
}

async function handle_mdsgenevalueonesample(req, res) {
	/*
.genes[]
.dslabel
.querykey
.iscustom
.file
.url
.sample
*/
	const q = req.query

	try {
		if (!q.sample) throw '.sample missing'
		if (!q.genes) throw '.genes[] missing'

		let gn, ds, dsquery

		if (req.query.iscustom) {
			gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'
			if (!q.file && !q.url) throw 'no file or url for expression data'
			ds = {}
			dsquery = {
				file: q.file,
				url: q.url,
				indexURL: q.indexURL
			}
		} else {
			const [err, gn1, ds1, dsquery1] = mds_query_arg_check(q)
			if (err) throw err
			gn = gn1
			ds = ds1
			dsquery = dsquery1
		}
		const dir = dsquery.file ? null : await utils.cache_index(dsquery.url, dsquery.indexURL)

		const gene2value = {}
		let nodata = true
		for (const gene of q.genes) {
			let v
			await utils.get_lines_bigfile({
				args: [
					dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
					gene.chr + ':' + gene.start + '-' + gene.stop
				],
				dir,
				callback: line => {
					const l = line.split('\t')
					if (!l[3]) return
					const j = JSON.parse(l[3])
					if (j.gene == gene.gene && j.sample == q.sample) {
						v = j.value
					}
				}
			})
			if (Number.isFinite(v)) {
				gene2value[gene.gene] = v
				nodata = false
			}
		}
		if (nodata) {
			res.send({ nodata: 1 })
		} else {
			res.send({ result: gene2value })
		}
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

export function boxplot_getvalue(lst) {
	/* ascending order
    each element: {value}
    */
	const l = lst.length
	if (l < 5) {
		// less than 5 items, won't make boxplot
		return { out: lst }
	}
	const p50 = lst[Math.floor(l / 2)].value
	const p25 = lst[Math.floor(l / 4)].value
	const p75 = lst[Math.floor((l * 3) / 4)].value
	const p05 = lst[Math.floor(l * 0.05)].value
	const p95 = lst[Math.floor(l * 0.95)].value
	const p01 = lst[Math.floor(l * 0.01)].value
	const iqr = p75 - p25

	let w1, w2
	if (iqr == 0) {
		w1 = 0
		w2 = 0
	} else {
		const i = lst.findIndex(i => i.value > p25 - iqr * 1.5)
		w1 = lst[i == -1 ? 0 : i].value
		const j = lst.findIndex(i => i.value > p75 + iqr * 1.5)
		w2 = lst[j == -1 ? l - 1 : j - 1].value
	}
	const out = lst.filter(i => i.value < p25 - iqr * 1.5 || i.value > p75 + iqr * 1.5)
	return { w1, w2, p05, p25, p50, p75, p95, iqr, out }
}

function mds_tkquery_parse_permanentHierarchy(query, ds) {
	/*
    only for subtrack of mds
    a permanent restrain using one sample attribute from a hierarchy
    	.hierarchyname
    	.levelidx
    	.valuekey

    will set cohortOnlyAttr{}, all the rest of samples are not used
    note: cohortOnlyAttr supports multiple attribute keys & multi-value for each attribute, for hierarchy-subtrack it's using just one attribute and one value

    */
	if (!ds.cohort) return '.cohort missing from ds'
	if (!ds.cohort.hierarchies) return '.hierarchies missing from ds.cohort'
	if (!ds.cohort.hierarchies.lst) return '.hierarchies.lst[] missing from ds.cohort'
	const hierarchy = ds.cohort.hierarchies.lst.find(i => i.name == query.permanentHierarchy.hierarchyname)
	if (!hierarchy) return 'unknown hierarchy ' + query.permanentHierarchy.hierarchyname
	if (!hierarchy.levels) return '.levels[] missing in hierarchy ' + hierarchy.name
	const level = hierarchy.levels[query.permanentHierarchy.levelidx]
	if (!level) return 'level not found by array idx ' + query.permanentHierarchy.levelidx
	const key = level.k
	delete query.cohortHiddenAttr
	query.cohortOnlyAttr = {}
	query.cohortOnlyAttr[key] = {}
	query.cohortOnlyAttr[key][query.permanentHierarchy.valuekey] = 1
	// for this to work, level.k and permanentHierarchy.valuekey are now independent of hierarchy, and are annotation attributes directly associated with samples
	return null
}

function mds_tkquery_samplesummary(ds, dsquery, samples) {
	/*
    mds tk query resulted in a bunch of samples showing data in view range
    now to make cohort annotation summary for these samples, pass to client for making legend

    summarizes for:
    	ds.cohort.attributes
    	ds.cohort.hierarchies

    also incorporates total counts for each category of attributes/hierarchies which was summarized before

    for junction:
    	only needs to count # of samples for each category

    for cnv:
    	need to report two number of samples: gain & loss
    	but the input is the union of gain/loss samples, no identification of gain/loss
    	in that case, need to report the actual list of sample names for each category, but rather just the number
    	so that later can use that list to get gain/loss number for each category

    thus, will report sample sets for each category

    returned data:
    	attributeSummary [ attr ]
    		.key
    		.label
    		.values [ value ]
    			.name
    			.label, color, desc (depends on ds config)
    			.sampleset  Set
    			.totalCount

    	hierarchySummary {}
    		k: hierarchy.name
    		v: [ node ]
    			.id
    			.name
    			.label
    			.depth
    			.isleaf
    			.sampleset  Set
    			.totalCount
    		root node is useless, it's depth=0 and won't have sampleset

    */

	if (!ds.cohort || !ds.cohort.annotation || samples.length == 0) return [null, null]

	const samplelst = [] // list of sample annotations retrieved from ds.cohort.annotation
	for (const n of samples) {
		const a = ds.cohort.annotation[n]
		if (!a) {
			// the sample is unannotated, don't deal with it for now
			continue
		}
		samplelst.push(a)
	}
	if (samplelst.length == 0) {
		return [null, null]
	}

	let attributeSummary
	let hierarchySummary

	if (ds.cohort.attributes) {
		attributeSummary = []
		for (const attr of ds.cohort.attributes.lst) {
			// to push to result[]
			const attr2 = {
				label: attr.label,
				key: attr.key
			}

			if (attr.isNumeric) {
				attr2.isNumeric = true
				/*
                    TODO numeric
                    */
				continue
			}

			const categories = new Map()
			let samplecount_noannotation = 0

			for (const anno of samplelst) {
				const value = anno[attr.key]

				// categorical
				if (value == undefined) {
					samplecount_noannotation++
					continue
				}
				if (!categories.has(value)) {
					categories.set(value, new Set())
				}
				categories.get(value).add(anno[ds.cohort.samplenamekey])
			}
			const lst = [...categories]

			if (samplecount_noannotation) {
				lst.push([infoFilter_unannotated, samplecount_noannotation])
			}

			lst.sort((i, j) => j[1] - i[1])

			attr2.values = []
			for (const [name, sampleset] of lst) {
				const value = {
					name: name,
					sampleset: sampleset
				}
				if (attr.values && attr.values[name]) {
					// pass over attr about this value, from ds object
					for (const k in attr.values[name]) {
						value[k] = attr.values[name][k]
					}
				}
				if (dsquery.attributeSummary) {
					if (dsquery.attributeSummary[attr.key] && dsquery.attributeSummary[attr.key][name]) {
						value.totalCount = dsquery.attributeSummary[attr.key][name]
					}
				}
				attr2.values.push(value)
			}
			attributeSummary.push(attr2)
		}
	}
	if (ds.cohort.hierarchies) {
		hierarchySummary = {}
		for (const hierarchy of ds.cohort.hierarchies.lst) {
			const root = d3stratify()(stratinput(samplelst, hierarchy.levels))
			root.sum(i => i.value)
			const nodes = []
			root.eachBefore(i => {
				const n2 = {
					id: i.data.id,
					name: i.data.name,
					label: i.data.full,
					depth: i.depth
				}
				if (i.data.lst) {
					// graciously provided by stratinput, not available for root node
					n2.sampleset = new Set()
					for (const sample of i.data.lst) {
						n2.sampleset.add(sample[ds.cohort.samplenamekey])
					}
				}
				if (!i.children) {
					n2.isleaf = 1
				}
				if (dsquery.hierarchySummary && dsquery.hierarchySummary[hierarchy.name]) {
					n2.totalCount = dsquery.hierarchySummary[hierarchy.name][i.id]
				}
				nodes.push(n2)
			})
			hierarchySummary[hierarchy.name] = nodes
		}
	}
	return [attributeSummary, hierarchySummary]
}

async function handle_mdssamplescatterplot(req, res) {
	try {
		const gn = genomes[req.query.genome]
		if (!gn) throw 'invalid genome'
		const ds = gn.datasets[req.query.dslabel]
		if (!ds) throw 'invalid dataset'
		if (!ds.cohort) throw 'no cohort for dataset'
		if (!ds.cohort.annotation) throw 'cohort.annotation missing for dataset'
		const sp = ds.cohort.scatterplot
		if (!sp) throw 'scatterplot not supported for this dataset'

		const dots = []
		for (const sample in ds.cohort.annotation) {
			const anno = ds.cohort.annotation[sample]
			if (req.query.subsetkey) {
				if (anno[req.query.subsetkey] != req.query.subsetvalue) continue
			}
			const x = anno[sp.x.attribute]
			if (!Number.isFinite(x)) continue
			const y = anno[sp.y.attribute]
			if (!Number.isFinite(y)) continue
			dots.push({
				sample,
				x,
				y,
				s: anno
			})
		}
		res.send({
			colorbyattributes: sp.colorbyattributes, // optional
			colorbygeneexpression: sp.colorbygeneexpression, // optional
			querykey: sp.querykey,
			dots: dots,
			// optional, quick fix for showing additional tracks when launching single sample view by clicking a dot
			tracks: sp.tracks
		})
	} catch (e) {
		if (e.stack) console.error(e.stack)
		res.send({ error: e.message || e })
	}
}

function handle_mdssamplesignature(req, res) {
	try {
		const q = req.query
		if (!q.sample) throw '.sample missing'
		const gn = genomes[q.genome]
		if (!gn) throw 'invalid genome'
		const ds = gn.datasets[q.dslabel]
		if (!ds) throw 'invalid dataset'
		if (!ds.cohort) throw 'no cohort for dataset'
		if (!ds.cohort.mutation_signature) throw 'no mutation_signature for cohort'
		const lst = []
		for (const k in ds.cohort.mutation_signature.sets) {
			const s = ds.cohort.mutation_signature.sets[k]
			if (!s.samples) continue
			const v = s.samples.map.get(q.sample)
			if (!v) continue
			const l = []
			for (const x in s.signatures) {
				if (v[x]) {
					l.push({ k: x, v: v[x] })
				}
			}
			if (l.length) {
				lst.push({
					key: k,
					valuename: s.samples.valuename,
					annotation: l.sort((i, j) => j.v - i.v)
				})
			}
		}
		res.send({ lst: lst })
	} catch (err) {
		if (err.stack) console.error(err.stack)
		res.send({ error: err.message || err })
	}
}

async function handle_mdssurvivalplot_dividesamples_genevalue_get(samples, q, ds) {
	if (!ds.queries) throw '.queries{} missing from ds'
	let genenumquery // gene numeric value query
	for (const k in ds.queries) {
		if (ds.queries[k].isgenenumeric) {
			genenumquery = ds.queries[k]
		}
	}
	if (!genenumquery) throw 'no gene numeric query from ds'

	const dir = genenumquery.url ? await utils.cache_index(genenumquery.url, genenumquery.indexURL) : null

	const st = q.samplerule.set

	const sample2genevalue = await mds_genenumeric_querygene(genenumquery, dir, st.chr, st.start, st.stop, st.gene)

	const samplewithvalue = []
	for (const s of samples) {
		if (sample2genevalue.has(s.name)) {
			s.genevalue = sample2genevalue.get(s.name)
			samplewithvalue.push(s)
		}
	}
	samplewithvalue.sort((a, b) => a.genevalue - b.genevalue)
	return [genenumquery, samplewithvalue]
}

async function mds_genenumeric_querygene(query, dir, chr, start, stop, gene) {
	return new Promise((resolve, reject) => {
		const ps = spawn(
			tabix,
			[query.file ? path.join(serverconfig.tpmasterdir, query.file) : query.url, chr + ':' + start + '-' + stop],
			{ cwd: dir }
		)

		const sample2genevalue = new Map()
		const rl = readline.createInterface({ input: ps.stdout })
		rl.on('line', line => {
			const j = JSON.parse(line.split('\t')[3])
			if (!j.sample || !Number.isFinite(j.value) || j.gene != gene) return
			sample2genevalue.set(j.sample, j.value)
		})
		ps.on('close', code => {
			resolve(sample2genevalue)
		})
	})
}

async function handle_isoformbycoord(req, res) {
	try {
		const genome = genomes[req.query.genome]
		if (!genome) throw 'invalid genome'
		if (!req.query.chr) throw 'chr missing'
		const pos = Number(req.query.pos)
		if (!Number.isInteger(pos)) throw 'pos must be positive integer'

		const genetk = genome.tracks.find(i => i.__isgene)
		if (!genetk) reject('no gene track')
		const isoforms = []
		await utils.get_lines_bigfile({
			args: [path.join(serverconfig.tpmasterdir, genetk.file), req.query.chr + ':' + pos + '-' + pos],
			callback: line => {
				const str = line.split('\t')[3]
				if (!str) return
				const j = JSON.parse(str)
				if (!j.isoform) return
				const j2 = { isoform: j.isoform }
				const tmp = genome.genedb.getjsonbyisoform.get(j.isoform)
				if (tmp) {
					j2.name = JSON.parse(tmp.genemodel).name
					j2.isdefault = tmp.isdefault
				}
				isoforms.push(j2)
			}
		})
		res.send({ lst: isoforms })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

function isoformbycoord_tabix(genome, chr, pos) {
	return new Promise((resolve, reject) => {
		const ps = spawn('tabix', [path.join(serverconfig.tpmasterdir, genetk.file), chr + ':' + pos + '-' + pos])
		const out = [],
			out2 = []
		ps.stdout.on('data', d => out.push(d))
		ps.stderr.on('data', d => out2.push(d))
		ps.on('close', () => {
			const err = out2.join('')
			if (err && !tabixnoterror(err)) reject(err)
			const str = out.join('').trim()
			if (!str) resolve([])
			const lst = []
			for (const line of str.split('\n')) {
				const js = line.split('\t')[3]
				if (js) {
					const j = JSON.parse(js)
					if (j.isoform) lst.push({ isoform: j.isoform })
				}
			}
			resolve(lst)
		})
	})
}

/***********  __smat ************/

function handle_samplematrix(req, res) {
	/*
    fetch values for a set of features, over a common set of samples
    for singular feature, the datatype & file format is implied
    for feature spanning multiple data types, will need to query multiple data tracks, each track must be identified with "type" e.g. common.tkt.mdsvcf
    */

	Promise.resolve()
		.then(() => {
			const gn = genomes[req.query.genome]
			if (!gn) throw 'invalid genome'

			let ds

			if (req.query.iscustom) {
				if (!req.query.querykey2tracks) throw 'querykey2tracks{} missing for custom dataset'
				ds = { queries: {} }

				for (const key in req.query.querykey2tracks) {
					// the key is arbitrary

					const tk = req.query.querykey2tracks[key]

					if (!tk.type) throw 'missing "type" for a data track'

					if (tk.type == common.tkt.mdsvcf) {
						// special treatment for vcf
						const tk = req.query.querykey2tracks[key]
						tk.type = common.mdsvcftype.vcf

						ds.queries[key] = {
							type: common.tkt.mdsvcf,
							info: tk.info, // comply with multi-vcf track mds
							tracks: [tk]
						}
					} else if (tk.type == common.tkt.mdssvcnv) {
						ds.queries[key] = tk
					} else if (tk.type == common.tkt.mdsexpressionrank) {
						// gene expression is currently not used in custom track...
						ds.queries[key] = tk
					} else {
						throw 'unknown type of data track: ' + tk.type
					}
				}
			} else {
				// from native dataset
				if (!gn.datasets) throw 'genome is not equipped with datasets'
				if (!req.query.dslabel) throw 'dslabel missing'
				ds = gn.datasets[req.query.dslabel]
				if (!ds) throw 'invalid dslabel'
				if (!ds.queries) throw 'dataset is not equipped with queries'
			}

			/*
		impose certain limits to restrict to a set of samples
		merge different logic of limits into one set
		share in different feature processor
		*/
			let usesampleset

			if (req.query.sampleset) {
				usesampleset = new Set(req.query.sampleset)
			} else if (req.query.limitsamplebyeitherannotation) {
				// must be official ds
				if (!ds.cohort) throw 'limitsamplebyeitherannotation but no cohort in ds'
				if (!ds.cohort.annotation) throw 'limitsamplebyeitherannotation but no cohort.annotation in ds'
				usesampleset = new Set()
				for (const n in ds.cohort.annotation) {
					const a = ds.cohort.annotation[n]
					for (const filter of req.query.limitsamplebyeitherannotation) {
						if (a[filter.key] == filter.value) {
							// use this sample
							usesampleset.add(n)
							break
						}
					}
				}
			}

			const tasks = []

			for (const feature of req.query.features) {
				let dsquery
				let dsquerylst = []

				// allow other types of query, e.g. checking sample metadata

				if (feature.querykey) {
					if (!ds.queries) throw 'using querykey for a feature but no ds.queries'
					dsquery = ds.queries[feature.querykey]
					if (!dsquery) throw 'unknown dsquery by key ' + feature.querykey
				} else if (feature.querykeylst) {
					if (!ds.queries) throw 'using querykeylst for a feature but no ds.queries'
					for (const k of feature.querykeylst) {
						const q = ds.queries[k]
						if (!q) throw 'unknown key "' + k + '" from querykeylst'
						dsquerylst.push(q)
					}
					if (dsquerylst.length == 0) throw 'no valid keys in querykeylst'
				} else if (feature.issampleattribute) {
					// no need for dsquery
				} else {
					throw 'unknown way to query a feature'
				}

				// types of feature/query

				if (feature.isgenevalue) {
					const [err, q] = samplematrix_task_isgenevalue(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with isgenevalue: ' + err
					tasks.push(q)
				} else if (feature.iscnv) {
					const [err, q] = samplematrix_task_iscnv(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with iscnv: ' + err
					tasks.push(q)
				} else if (feature.isloh) {
					const [err, q] = samplematrix_task_isloh(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with isloh: ' + err
					tasks.push(q)
				} else if (feature.isvcf) {
					const [err, q] = samplematrix_task_isvcf(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with isvcf: ' + err
					tasks.push(q)
				} else if (feature.isitd) {
					const [err, q] = samplematrix_task_isitd(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with isitd: ' + err
					tasks.push(q)
				} else if (feature.issvfusion) {
					const [err, q] = samplematrix_task_issvfusion(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with issvfusion: ' + err
					tasks.push(q)
				} else if (feature.issvcnv) {
					const [err, q] = samplematrix_task_issvcnv(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with issvcnv: ' + err
					tasks.push(q)
				} else if (feature.ismutation) {
					const [err, q] = samplematrix_task_ismutation(feature, ds, dsquerylst, usesampleset)
					if (err) throw 'error with ismutation: ' + err
					tasks.push(q)
				} else if (feature.issampleattribute) {
					const [err, q] = samplematrix_task_issampleattribute(feature, ds, usesampleset)
					if (err) throw 'error with issampleattribute: ' + err
					tasks.push(q)
				} else {
					throw 'unknown type of feature'
				}
			}

			return Promise.all(tasks)
		})
		.then(results => {
			res.send({ results: results })
		})
		.catch(err => {
			res.send({ error: typeof err == 'string' ? err : err.message })
			if (err.stack) console.error(err.stack)
		})
}

function samplematrix_task_issampleattribute(feature, ds, usesampleset) {
	if (!feature.key) return ['.key missing']
	if (!ds.cohort) return ['ds.cohort missing']
	if (!ds.cohort.annotation) return ['ds.cohort.annotation missing']
	const q = Promise.resolve().then(() => {
		const items = []
		for (const samplename in ds.cohort.annotation) {
			if (usesampleset && !usesampleset.has(samplename)) continue

			const anno = ds.cohort.annotation[samplename]

			const value = anno[feature.key]
			if (value == undefined) continue
			items.push({
				sample: samplename,
				value: value
			})
		}
		return {
			id: feature.id,
			items: items
		}
	})
	return [null, q]
}

function samplematrix_task_isgenevalue(feature, ds, dsquery, usesampleset) {
	if (!feature.genename) return ['genename missing']
	const genename = feature.genename.toLowerCase()
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['gene feature too long (> 10Mb)']

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = spawn(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})

				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (!j.gene) return
					if (j.gene.toLowerCase() != genename) return

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_iscnv(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']
	if (feature.valuecutoff != undefined) {
		if (!Number.isFinite(feature.valuecutoff)) return ['invalid value for valuecutoff']
	}
	if (feature.focalsizelimit != undefined) {
		if (!Number.isInteger(feature.focalsizelimit)) return ['invalid value for focalsizelimit']
	}

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = spawn(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					// loh and sv data could be present in same file
					if (j.dt != common.dtcnv) return

					if (feature.valuecutoff && Math.abs(j.value) < feature.valuecutoff) return

					j.chr = l[0]
					j.start = Number.parseInt(l[1])
					j.stop = Number.parseInt(l[2])

					if (feature.focalsizelimit && j.stop - j.start >= feature.focalsizelimit) return

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_isloh(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']
	if (feature.valuecutoff != undefined) {
		if (!Number.isFinite(feature.valuecutoff)) return ['invalid value for valuecutoff']
	}
	if (feature.focalsizelimit != undefined) {
		if (!Number.isInteger(feature.focalsizelimit)) return ['invalid value for focalsizelimit']
	}

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = spawn(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (j.dt != common.dtloh) return

					if (feature.valuecutoff && j.segmean < feature.valuecutoff) return

					j.chr = l[0]
					j.start = Number.parseInt(l[1])
					j.stop = Number.parseInt(l[2])

					if (feature.focalsizelimit && j.stop - j.start >= feature.focalsizelimit) return

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_isitd(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = spawn(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (j.dt != common.dtitd) return

					j.chr = l[0]
					j.start = Number.parseInt(l[1])
					j.stop = Number.parseInt(l[2])

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_issvfusion(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = spawn(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (j.dt != common.dtsv && j.dt != common.dtfusionrna) return

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					j._chr = l[0]
					j._pos = Number.parseInt(l[1])
					if (j.chrA) {
						j.chrB = j._chr
						j.posB = j._pos
					} else {
						j.chrA = j._chr
						j.posA = j._pos
					}

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_issvcnv(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = spawn(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					// keep all data and return

					if (j.dt == common.dtsv || j.dt == common.dtfusionrna) {
						if (j.dt == common.dtsv && feature.sv && feature.sv.hidden) return

						if (j.dt == common.dtfusionrna && feature.fusion && feature.fusion.hidden) return

						j._chr = l[0]
						j._pos = Number.parseInt(l[1])
						if (j.chrA) {
							j.chrB = j._chr
							j.posB = j._pos
						} else {
							j.chrA = j._chr
							j.posA = j._pos
						}
					} else if (j.dt == common.dtcnv) {
						if (feature.cnv && feature.cnv.hidden) return

						if (feature.cnv && feature.cnv.valuecutoff && Math.abs(j.value) < feature.cnv.valuecutoff) return
						j.chr = l[0]
						j.start = Number.parseInt(l[1])
						j.stop = Number.parseInt(l[2])
						if (feature.cnv && feature.cnv.focalsizelimit && j.stop - j.start >= feature.cnv.focalsizelimit) return
					} else if (j.dt == common.dtloh) {
						if (feature.loh && feature.loh.hidden) return

						if (feature.loh && feature.loh.valuecutoff && j.segmean < feature.loh.valuecutoff) return
						j.chr = l[0]
						j.start = Number.parseInt(l[1])
						j.stop = Number.parseInt(l[2])
						if (feature.loh && feature.loh.focalsizelimit && j.stop - j.start >= feature.loh.focalsizelimit) return
					} else if (j.dt == common.dtitd) {
						if (feature.itd && feature.itd.hidden) return

						j.chr = l[0]
						j.start = Number.parseInt(l[1])
						j.stop = Number.parseInt(l[2])
					} else {
						console.error('unknown datatype', j.dt)
						return
					}

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}

					const sample2item = new Map()
					for (const i of data) {
						if (!sample2item.has(i.sample)) sample2item.set(i.sample, [])
						sample2item.get(i.sample).push(i)
					}

					if (dsquery.hideLOHwithCNVoverlap) {
						mdssvcnv_do_copyneutralloh(sample2item)
					}

					const newlst = []
					for (const [n, lst] of sample2item) {
						for (const i of lst) {
							newlst.push(i)
						}
					}

					resolve({
						id: feature.id,
						items: newlst
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_ismutation(feature, ds, dsquerylst, usesampleset) {
	/*
    load mutation of any type:
    	snvindel from vcf file
    	cnv/loh/sv/fusion/itd from svcnv file

    no expression data here

    */
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']

	const tasks = []

	for (const query of dsquerylst) {
		if (query.type == common.tkt.mdsvcf) {
			const [err, q] = samplematrix_task_isvcf(feature, ds, query, usesampleset)
			if (err) return [err]
			tasks.push(q)
		} else if (query.type == common.tkt.mdssvcnv) {
			const [err, q] = samplematrix_task_issvcnv(feature, ds, query, usesampleset)
			if (err) return [err]
			tasks.push(q)
		} else {
			return ['unsupported track type: ' + query.type]
		}
	}

	return [
		null,
		Promise.all(tasks).then(results => {
			const items = []
			for (const r of results) {
				for (const i of r.items) {
					items.push(i)
				}
			}
			return {
				id: results[0].id,
				items: items
			}
		})
	]
}

function samplematrix_task_isvcf(feature, ds, dsquery, usesampleset) {
	/*
    if is custom, will pass the lines to client for processing
    */
	if (!dsquery.tracks) return 'tracks[] missing from dsquery'
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 3000000) return ['look range too big (>3Mb)']

	const tasks = []

	for (const tk of dsquery.tracks) {
		const q = Promise.resolve()
			.then(() => {
				if (tk.file) return
				return utils.cache_index(tk.url, tk.indexURL)
			})
			.then(dir => {
				return new Promise((resolve, reject) => {
					const data = []
					const ps = spawn(
						tabix,
						[
							tk.file ? path.join(serverconfig.tpmasterdir, tk.file) : tk.url,
							(tk.nochr ? feature.chr.replace('chr', '') : feature.chr) + ':' + feature.start + '-' + (feature.stop + 1)
							// must add 1 to stop so to get snv data
						],
						{ cwd: dir }
					)
					const rl = readline.createInterface({
						input: ps.stdout
					})
					rl.on('line', line => {
						if (dsquery.iscustom) {
							// info/format are at client, pass them over
							data.push(line)
							return
						}

						if (tk.type == common.mdsvcftype.vcf) {
							// snv/indel

							const [badinfok, mlst, altinvalid] = vcf.vcfparseline(line, {
								nochr: tk.nochr,
								samples: tk.samples,
								info: dsquery.info,
								format: tk.format
							})

							for (const m of mlst) {
								if (!m.sampledata) {
									// do not allow
									continue
								}

								// extract class/mname from vep csq etc, must be done here but not on client
								common.vcfcopymclass(m, {})

								if (feature.snvindel) {
									if (feature.snvindel.excludeclasses && feature.snvindel.excludeclasses[m.class]) {
										// m class is one of excluded
										continue
									}
								}

								// filters on samples

								if (usesampleset) {
									const samplesnothidden = []
									for (const s of m.sampledata) {
										if (usesampleset.has(s.sampleobj.name)) {
											samplesnothidden.push(s)
										}
									}
									if (samplesnothidden.length == 0) {
										continue
									}
									m.sampledata = samplesnothidden
								}

								// delete the obsolete attr
								for (const sb of m.sampledata) {
									delete sb.allele2readcount
								}

								delete m._m
								delete m.vcf_ID
								delete m.name

								m.dt = common.dtsnvindel

								data.push(m)
							}
						} else {
							console.error('type not one of mdsvcftype: ' + tk.type)
						}
					})

					const errout = []
					ps.stderr.on('data', i => errout.push(i))
					ps.on('close', code => {
						const e = errout.join('')
						if (e && !tabixnoterror(e)) {
							reject(e)
							return
						}
						resolve(data)
					})
				})
			})
		tasks.push(q)
	}

	return [
		null,
		Promise.all(tasks).then(results => {
			const lst = []
			for (const i of results) {
				for (const m of i) {
					lst.push(m)
				}
			}
			return {
				id: feature.id,
				items: lst
			}
		})
	]
}

/***********  __smat ends ************/

async function handle_vcfheader(req, res) {
	// get header for a single custom vcf track
	try {
		if (!req.query.genome) throw 'genome missing'
		const g = genomes[req.query.genome]
		if (!g) throw 'invalid genome'
		const [e, file, isurl] = utils.fileurl(req)
		if (e) throw e
		const dir = isurl ? await utils.cache_index(file, req.query.indexURL) : null
		res.send({
			metastr: (await utils.get_header_tabix(file, dir)).join('\n'),
			nochr: await utils.tabix_is_nochr(file, dir, g)
		})
	} catch (e) {
		if (e.stack) console.error(e.stack)
		res.send({ error: e.message || e })
	}
}

async function handle_vcf(req, res) {
	// single vcf
	try {
		const [e, file, isurl] = utils.fileurl(req)
		if (e) throw e
		const dir = isurl ? await utils.cache_index(file, req.query.indexURL) : null
		if (!req.query.rglst) throw 'rglst missing'
		const lines = []
		for (const r of req.query.rglst) {
			await utils.get_lines_bigfile({
				args: [file, r.chr + ':' + r.start + '-' + r.stop],
				dir,
				callback: line => lines.push(line)
			})
		}
		res.send({ linestr: lines.join('\n') })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

async function handle_translategm(req, res) {
	try {
		const g = genomes[req.query.genome]
		if (!g) throw 'invalid genome'
		const gm = req.query.gm
		if (!gm) throw 'missing gm{}'
		if (!gm.chr) throw 'gm.chr missing'
		if (!gm.start) throw 'gm.start missing'
		if (!Number.isInteger(gm.start)) throw 'gm.start not integer'
		if (!gm.stop) throw 'gm.stop missing'
		if (!Number.isInteger(gm.stop)) throw 'gm.stop not integer'
		const seq = await utils.get_fasta(g, gm.chr + ':' + (gm.start + 1) + '-' + gm.stop)
		const frame = common.fasta2gmframecheck(gm, seq)
		res.send({ frame })
	} catch (e) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}

/****************************************************************************************************/

/* __tp__ */

/***************************   __util   **/

function validate_tabixfile(file) {
	if (!file.endsWith('.gz')) return ['no .gz suffix (file should be compressed by bgzip)']
	const gzfile = path.join(serverconfig.tpmasterdir, file)
	if (!fs.existsSync(gzfile)) return ['.gz file not found']
	if (fs.existsSync(gzfile + '.tbi')) {
		// using tbi
		return [null, gzfile]
	}
	if (fs.existsSync(gzfile + '.csi')) {
		// using csi
		return [null, gzfile]
	}
	return ['.tbi/.csi index missing']
}

var binOffsets = [512 + 64 + 8 + 1, 64 + 8 + 1, 8 + 1, 1, 0]

export const illegalpath = utils.illegalpath
export const fileurl = utils.fileurl

function downloadFile(url, tofile, cb) {
	const f = fs.createWriteStream(tofile)

	f.on('finish', () => {
		f.close(cb)
	})
	;(url.startsWith('https') ? https : http)
		.get(url, response => {
			response.pipe(f)
		})
		.on('error', err => {
			cb(err.message)
		})
}

function parse_textfilewithheader(text) {
	/*
    for sample annotation file, first line is header, skip lines start with #
    parse each line as an item
    */
	const lines = text.split(/\r?\n/)
	/*
        if(lines.length<=1) return ['no content']
        if(lines[0] == '') return ['empty header line']
        */

	// allow empty file
	if (lines.length <= 1 || !lines[0]) return [null, []]

	const header = lines[0].split('\t')
	const items = []
	for (let i = 1; i < lines.length; i++) {
		if (lines[i][0] == '#') continue
		const l = lines[i].split('\t')
		const item = {}
		for (let j = 0; j < header.length; j++) {
			const value = l[j]
			if (value) {
				item[header[j]] = value
			}
		}
		items.push(item)
	}
	return [null, items]
}

/***************************   end of __util   **/

/* when starting pp server process with "npm start" or "node server.js"
pp_init() runs first to load all genomes supported on this server,
and load all datasets supported in each genome
as encoded in file "serverconfig.json"
at the end it will 
*/
export async function pp_init(serverconfig) {
	// verify if tp directory is readable
	// ppr has this situation where its tp/ is from a nfs mount and can go down...
	try {
		await fs.promises.stat(serverconfig.tpmasterdir)
	} catch (e) {
		/* dir is inaccessible for some reason */
		const message = 'Error with ' + serverconfig.tpmasterdir + ': ' + e.code
		if (process.argv[2] == 'validate') {
			throw message
		} else {
			// allow the server process to boot
			// we want the node server to keep running so it can inform user with some meaningful msg rather than http error
			console.log('\n!!! ' + message + '\n')
			return
		}
	}

	checkDependenciesAndVersions()

	// date updated

	if (serverconfig.base_zindex != undefined) {
		const v = Number.parseInt(serverconfig.base_zindex)
		if (Number.isNaN(v) || v <= 0) throw 'base_zindex must be positive integer'
		serverconfig.base_zindex = v
	}
	if (serverconfig.jwt) {
		if (!serverconfig.jwt.secret) throw 'jwt.secret missing'
		if (!serverconfig.jwt.permissioncheck) throw 'jwt.permissioncheck missing'
	}
	if (!serverconfig.tpmasterdir) throw '.tpmasterdir missing'
	if (!serverconfig.cachedir) throw '.cachedir missing'

	// create sub directories under cachedir, and register path in serverconfig
	// to ensure temp files saved in previous server session are accessible in current session
	// must use consistent dir name but not random dir name that changes from last server boot
	serverconfig.cachedir_massSession = await mayCreateSubdirInCache('massSession')

	//DELETE THIS after process for deleting mass session files moved into production
	serverconfig.cachedir_massSessionTrash = await mayCreateSubdirInCache('massSessionTrash')

	serverconfig.cache_snpgt = {
		dir: await mayCreateSubdirInCache('snpgt'),
		fileNameRegexp: /[^\w]/, // client-provided cache file name matching with this are denied
		sampleColumn: 6 // in cache file, sample column starts from 7th column
	}
	serverconfig.cachedir_bam = await mayCreateSubdirInCache('bam')
	serverconfig.cachedir_genome = await mayCreateSubdirInCache('genome')
	serverconfig.cachedir_ssid = await mayCreateSubdirInCache('ssid')

	// NOTE: required or imported code files are only loaded once by Nodejs
	// and variables are static so that changes to common key-values will affect all
	// server-side code that import common.js
	if (serverconfig.commonOverrides) {
		common.applyOverrides(serverconfig.commonOverrides)
	}

	if (!serverconfig.genomes) throw '.genomes[] missing'
	if (!Array.isArray(serverconfig.genomes)) throw '.genomes[] not array'

	/*
	for genomes declared in serverconfig for this pp instance,
	load its built in genome javascript file to an in-mem object
	and apply overrides from serverconfig to modify this object
	keep the object in genomes{}
	*/
	for (const g of serverconfig.genomes) {
		if (!g.name) throw '.name missing from a genome: ' + JSON.stringify(g)
		if (!g.file) throw '.file missing from genome ' + g.name

		/*
			When using a Docker container, the mounted app directory
			may have an optional genome directory, which if present
			will be symlinked to the app directory and potentially override any
			similarly named genome js file that are part of the standard
			Proteinpaint packaged files[] 
		*/
		const overrideFile = path.join(process.cwd(), g.file)

		/* g is the object from serverconfig.json, for instance-specific customizations of this genome
		g2 is the standard-issue obj loaded from the js file
		settings in g will modify g2
		g2 is registered in the global "genomes"
		*/
		const g2module = __non_webpack_require__(fs.existsSync(overrideFile) ? overrideFile : g.file)
		const g2 = g2module.default || g2module
		genomes[g.name] = g2

		if (!g2.genomefile) throw '.genomefile missing from .js file of genome ' + g.name
		if (g2.genomefile == 'NA') {
			// not available
		} else {
			g2.genomefile = path.join(serverconfig.tpmasterdir, g2.genomefile)
		}

		// for testing if gene/isoform/chr/snp names have only allowed characters
		// test to true if name has extra characters which could be attack strings
		// allow for genome-specific pattern setting, otherwise default is used
		if (!g2.genomicNameRegexp) g2.genomicNameRegexp = /[^a-zA-Z0-9.:_-]/

		if (!g2.tracks) {
			g2.tracks = [] // must always have .tracks even if empty
		}
		if (g.tracks) {
			// supplement
			for (const t of g.tracks) {
				g2.tracks.push(t)
			}
		}
		if (g.datasets) {
			g2.rawdslst = g.datasets
		}
		if (g.snp) {
			// replace snp db
			g2.snp = g.snp
		}
		if (g.blat) {
			if (!g.blat.host) throw '.blat.host missing for ' + g.name
			if (!g.blat.port) throw '.blat.port missing for ' + g.name
			// gfServer must start with full path to 2bit file
			g2.blat = g.blat // enable blat
		}
		if (g.nosnp) {
			// no snp
			delete g2.snp
		}
		if (g.nohicenzyme) {
			delete g2.hicenzymefragment
		}
		if (g.nohicdomain) {
			delete g2.hicdomain
		}
		if (g2.genedb) {
			if (g.no_gene2canonicalisoform) delete g2.genedb.gene2canonicalisoform
		}

		if (g.updateAttr) {
			for (const row of g.updateAttr) {
				let pointer = g2
				for (const [i, field] of row.entries()) {
					// to guard against invalid keys, could be manual errors or updated dataset spec
					if (!pointer) continue

					if (typeof field == 'object') {
						// apply the key-value overrides to the object that is pointed to
						for (const k in field) {
							pointer[k] = field[k]
						}
					} else {
						if (typeof pointer[field] == 'string') {
							//terminal
							if (row[i + 1]) {
								pointer[field] = row[i + 1]
							}
							break
						}

						// reset the reference to a subnested object
						pointer = pointer[field]
					}
				}
			}
		}
	}

	if (serverconfig.defaultgenome) {
		if (genomes[serverconfig.defaultgenome]) {
			genomes[serverconfig.defaultgenome].isdefault = true
		}
	}

	for (const genomename in genomes) {
		/*
		validate each genome
		*/
		const g = genomes[genomename]
		if (!g.majorchr) throw genomename + ': majorchr missing'
		if (!g.defaultcoord) throw genomename + ': defaultcoord missing'

		// test samtools and genomefile
		await utils.get_fasta(g, g.defaultcoord.chr + ':' + g.defaultcoord.start + '-' + (g.defaultcoord.start + 1))

		if (!g.tracks) {
			g.tracks = []
		}
		if (typeof g.majorchr == 'string') {
			const lst = g.majorchr.trim().split(/[\s\t\n]+/)
			const hash = {}
			const chrorder = []
			for (let i = 0; i < lst.length; i += 2) {
				const chr = lst[i]
				const c = Number.parseInt(lst[i + 1])
				if (Number.isNaN(c)) throw genomename + ' majorchr invalid chr size for ' + chr + ' (' + lst[i + 1] + ')'
				hash[chr] = c
				chrorder.push(chr)
			}
			g.majorchr = hash
			g.majorchrorder = chrorder
		}
		g.chrlookup = {}
		// k: uppercase chr, v: {name:str, len:int, major:bool}
		for (const n in g.majorchr) {
			g.chrlookup[n.toUpperCase()] = { name: n, len: g.majorchr[n], major: true }
		}
		if (g.minorchr) {
			if (typeof g.minorchr == 'string') {
				const lst = g.minorchr.trim().split(/[\s\t\n]+/)
				const hash = {}
				for (let i = 0; i < lst.length; i += 2) {
					const c = Number.parseInt(lst[i + 1])
					if (Number.isNaN(c)) throw genomename + ' minorchr invalid chr size for ' + lst[i] + ' (' + lst[i + 1] + ')'
					hash[lst[i]] = c
				}
				g.minorchr = hash
			}
			for (const n in g.minorchr) {
				g.chrlookup[n.toUpperCase()] = { name: n, len: g.minorchr[n] }
			}
		}

		// genedb is optional
		if (g.genedb) {
			if (!g.genedb.dbfile) throw genomename + ': .genedb.dbfile missing'
			// keep reference of the connection (.db) so as to add dataset-specific query statements later
			try {
				console.log('Connecting', g.genedb.dbfile)
				g.genedb.db = utils.connect_db(g.genedb.dbfile)
			} catch (e) {
				throw `Cannot connect genedb: ${g.genedb.dbfile}: ${e}`
			}
			g.genedb.getnamebynameorisoform = g.genedb.db.prepare('select name from genes where name=? or isoform=?')
			g.genedb.getnamebyisoform = g.genedb.db.prepare('select distinct name from genes where isoform=?')
			g.genedb.getjsonbyname = g.genedb.db.prepare('select isdefault,genemodel from genes where name=?')
			g.genedb.getjsonbyisoform = g.genedb.db.prepare('select isdefault,genemodel from genes where isoform=?')
			g.genedb.getnameslike = g.genedb.db.prepare('select distinct name from genes where name like ? limit 20')

			/*
			optional tables in gene db:

			- genealias
			- gene2coord
			- ideogram
			- gene2canonicalisoform
			- refseq2ensembl
			- buildDate

			if present, create getter to this table and attach to g.genedb{}
			*/
			const tables = listDbTables(g.genedb.db)
			if (tables.has('genealias')) {
				g.genedb.getNameByAlias = g.genedb.db.prepare('select name from genealias where alias=?')
				// quick fix -- convert symbol to ENSG, to be used for gdc api query
				g.genedb.getAliasByName = g.genedb.db.prepare('select alias from genealias where name=?')
			}
			if (tables.has('gene2coord')) {
				g.genedb.getCoordByGene = g.genedb.db.prepare('select * from gene2coord where name=?')
			}
			if (tables.has('ideogram')) {
				g.genedb.hasIdeogram = true
				g.genedb.getIdeogramByChr = g.genedb.db.prepare('select * from ideogram where chromosome=?')
			} else {
				g.genedb.hasIdeogram = false
			}
			if (tables.has('gene2canonicalisoform')) {
				g.genedb.get_gene2canonicalisoform = g.genedb.db.prepare(
					'select isoform from gene2canonicalisoform where gene=?'
				)
			}
			if (tables.has('buildDate')) {
				g.genedb.get_buildDate = g.genedb.db.prepare('select date from buildDate')
			}

			// this table is only used for gdc dataset
			g.genedb.hasTable_refseq2ensembl = tables.has('refseq2ensembl')

			g.genedb.sqlTables = [...tables]
			g.genedb.tableSize = {}
			for (const table of tables) {
				if (table == 'buildDate') continue
				g.genedb.tableSize[table] = g.genedb.db.prepare(`select count(*) as size from ${table}`).get().size
			}
		}

		// termdbs{} is optional
		if (g.termdbs) {
			for (const key in g.termdbs) {
				server_init_db_queries(g.termdbs[key], features)
				console.log(`${key} initiated as ${genomename}-level termdb`)
			}
		}

		for (const tk of g.tracks) {
			if (!tk.__isgene) continue
			if (!tk.file) throw 'Tabix file missing for gene track: ' + JSON.stringify(tk)
			try {
				await utils.validate_tabixfile(path.join(serverconfig.tpmasterdir, tk.file))
			} catch (e) {
				throw 'Error with ' + tk.file + ': ' + e
			}
		}

		if (g.proteindomain) {
			if (!g.proteindomain.dbfile) throw genomename + '.proteindomain: missing dbfile for sqlite db'
			if (!g.proteindomain.statement) throw genomename + '.proteindomain: missing statement for sqlite db'
			let db
			try {
				console.log('Connecting', g.proteindomain.dbfile)
				db = utils.connect_db(g.proteindomain.dbfile)
			} catch (e) {
				throw 'Error with ' + g.proteindomain.dbfile + ': ' + e
			}
			g.proteindomain.getbyisoform = db.prepare(g.proteindomain.statement)
		}

		if (g.snp) {
			if (!g.snp.bigbedfile) throw genomename + '.snp: missing bigBed file'
			g.snp.bigbedfile = path.join(serverconfig.tpmasterdir, g.snp.bigbedfile)
			await utils.file_is_readable(g.snp.bigbedfile)
		}

		if (g.fimo_motif) {
			if (!g.fimo_motif.db) throw genomename + '.fimo_motif: db file missing'
			g.fimo_motif.db = path.join(serverconfig.tpmasterdir, g.fimo_motif.db)
			if (g.fimo_motif.annotationfile) {
				const [err, items] = parse_textfilewithheader(
					fs.readFileSync(path.join(serverconfig.tpmasterdir, g.fimo_motif.annotationfile), { encoding: 'utf8' }).trim()
				)
				g.fimo_motif.tf2attr = {}
				for (const i of items) {
					g.fimo_motif.tf2attr[i.Model.split('_')[0]] = i
				}
			}
		}

		if (g.hicenzymefragment) {
			if (!Array.isArray(g.hicenzymefragment)) throw 'hicenzymefragment should be an array'
			for (const frag of g.hicenzymefragment) {
				if (!frag.enzyme) throw '.enzyme missing for one element of hicenzymefragment[]'
				if (!frag.file) throw '.file missing for one element of hicenzymefragment[]'
				try {
					await utils.validate_tabixfile(path.join(serverconfig.tpmasterdir, frag.file))
				} catch (e) {
					throw 'Error with ' + frag.file + ': ' + e
				}
			}
		}

		if (g.hicdomain) {
			if (!g.hicdomain.groups) throw '.groups{} missing from hicdomain'
			for (const groupname in g.hicdomain.groups) {
				const grp = g.hicdomain.groups[groupname]
				if (!grp.name) throw '.name missing from hicdomain ' + groupname
				if (!grp.sets) throw '.set{} missing from hicdomain ' + groupname
				for (const setname in grp.sets) {
					const hs = grp.sets[setname]
					if (!hs.name) throw '.name missing from hicdomain ' + groupname + ' > ' + setname
					if (!hs.file) throw '.file missing from hicdomain ' + groupname + ' > ' + setname
					hs.file = path.join(serverconfig.tpmasterdir, hs.file) // replace with full path, keep on server side
					try {
						await utils.validate_tabixfile(hs.file)
					} catch (e) {
						throw 'Error with ' + hs.file + ': ' + e
					}
				}
			}
		}

		if (!g.rawdslst) {
			// allow to have no ds
			continue
		}

		/*
	done everything except dataset
	*/

		g.datasets = {}
		for (const d of g.rawdslst) {
			/*
		for each raw dataset
		*/
			if (d.skip) continue
			if (!d.name) throw 'a nameless dataset from ' + genomename
			if (g.datasets[d.name]) throw genomename + ' has duplicating dataset name: ' + d.name
			if (!d.jsfile) throw 'jsfile not available for dataset ' + d.name + ' of ' + genomename

			/*
				When using a Docker container, the mounted app directory
				may have an optional dataset directory, which if present
				will be symlinked to the app directory and potentially override any
				similarly named dataset js file that are part of the standard
				Proteinpaint packaged files[] 
			*/
			const overrideFile = path.join(process.cwd(), d.jsfile)
			const _ds = __non_webpack_require__(fs.existsSync(overrideFile) ? overrideFile : d.jsfile)
			const ds =
				typeof _ds == 'function'
					? _ds(common)
					: typeof _ds?.default == 'function'
					? _ds.default(common)
					: _ds.default || _ds

			// !!! TODO: is this unnecessarily repeated at a later time? !!!
			server_updateAttr(ds, d)
			ds.noHandleOnClient = d.noHandleOnClient
			ds.label = d.name
			ds.genomename = genomename
			g.datasets[ds.label] = ds

			if (ds.isMds3) {
				try {
					await mds3_init.init(ds, g, d, app, basepath)
				} catch (e) {
					if (e.stack) console.log(e.stack)
					throw 'Error with mds3 dataset ' + ds.label + ': ' + e
				}
				continue
			}
			if (ds.isMds) {
				try {
					await mds_init(ds, g, d)
				} catch (e) {
					throw 'Error with mds dataset ' + ds.label + ': ' + e
				}
				continue
			}

			initLegacyDataset(ds, g)
		}

		deleteSessionFiles()

		delete g.rawdslst
	}
}

async function deleteSessionFiles() {
	//Delete mass session files older than the massSessionDuration in serverconfig or 30 days default
	const files = await fs.promises.readdir(serverconfig.cachedir_massSession)
	try {
		files.forEach(async file => {
			//Return creation Time
			const stats = await fs.promises.stat(path.join(serverconfig.cachedir_massSession, file))
			const sessionCreationDate = stats.birthtime

			//Determine file age against massSessionDuration
			const today = new Date()
			const fileDate = new Date(sessionCreationDate)
			const massSessionDuration = serverconfig.features.massSessionDuration || 30
			const sessionDaysElapsed = Math.round((today.getTime() - fileDate.getTime()) / (1000 * 3600 * 24))
			if (sessionDaysElapsed > massSessionDuration) {
				// Move file to massSessionTrash
				// Process in place until users get use to it
				await fs.promises.copyFile(
					path.join(serverconfig.cachedir_massSession, file),
					path.join(serverconfig.cachedir_massSessionTrash, file)
				)
				// Delete file out of massSession
				await fs.promises.unlink(path.join(serverconfig.cachedir_massSession, file))

				console.log('File deleted: ', file, sessionCreationDate)
			}
		})
	} catch (e) {
		throw `Error: ${e}`
	}
}

function checkDependenciesAndVersions() {
	if (serverconfig.features.skip_checkDependenciesAndVersions) {
		console.log('SKIPPED checkDependenciesAndVersions()')
		return
	}

	// test if R has all required libraries
	const rlibraries = ['jsonlite', 'cmprsk', 'hwde', 'lmtest']
	for (const lib of rlibraries) {
		const ps = child_process.spawnSync(
			serverconfig.Rscript,
			['-e', `suppressPackageStartupMessages(library("${lib}"))`],
			{ encoding: 'utf8' }
		)
		if (ps.stderr.trim()) throw ps.stderr
	}

	// samtools and bcftools usually have similar installed versions
	const htslibMinorVer = 10
	{
		const lines = child_process
			.execSync(serverconfig.samtools + ' --version', { encoding: 'utf8' })
			.trim()
			.split('\n')
		// first line should be "samtools 1.14"
		const [name, v] = lines[0].split(' ')
		if (name != 'samtools' || !v) throw 'cannot run "samtools version"'
		const [major, minor] = v.split('.')
		if (major != '1') throw 'samtools not 1.*'
		const i = Number(minor)
		if (i < htslibMinorVer) throw `samtools not >= 1.${htslibMinorVer}`
	}
	{
		const lines = child_process
			.execSync(serverconfig.bcftools + ' -v', { encoding: 'utf8' })
			.trim()
			.split('\n')
		// first line should be "bcftools 1.14"
		const [name, v] = lines[0].split(' ')
		if (name != 'bcftools' || !v) throw 'cannot run "bcftools version"'
		const [major, minor] = v.split('.')
		if (major != '1') throw 'bcftools not 1.*'
		const i = Number(minor)
		if (i < htslibMinorVer) throw `bcftools not >= 1.${htslibMinorVer}`
	}
}

function initLegacyDataset(ds, genome) {
	/* old official dataset */
	if (ds.dbfile) {
		/* this dataset has a db */
		try {
			console.log('Connecting', ds.dbfile)
			ds.newconn = utils.connect_db(ds.dbfile)
		} catch (e) {
			throw 'Error with ' + ds.dbfile + ': ' + e
		}
	}

	if (ds.snvindel_attributes) {
		for (const at of ds.snvindel_attributes) {
			if (at.lst) {
				for (const a2 of at.lst) {
					a2.get = a2.get.toString()
				}
			} else {
				at.get = at.get.toString()
			}
		}
	}

	if (ds.cohort) {
		// a dataset with cohort

		if (ds.cohort.levels) {
			if (!Array.isArray(ds.cohort.levels)) throw 'cohort.levels must be array for ' + ds.genomename + '.' + ds.label
			if (ds.cohort.levels.length == 0) throw 'levels is blank array for cohort of ' + ds.genomename + '.' + ds.label
			for (const i of ds.cohort.levels) {
				if (!i.k) throw '.k key missing in one of the levels, .cohort, in ' + ds.genomename + '.' + ds.label
			}
		}

		if (ds.cohort.fromdb) {
			/*
		cohort content to be loaded lazily from db
		*/
			if (!ds.cohort.fromdb.sql) throw '.sql missing from ds.cohort.fromdb in ' + ds.genomename + '.' + ds.label
			const rows = ds.newconn.prepare(ds.cohort.fromdb.sql).all()
			delete ds.cohort.fromdb
			ds.cohort.raw = rows ///// backward compatible
			console.log(rows.length + ' rows retrieved for ' + ds.label + ' sample annotation')
		}

		if (ds.cohort.files) {
			// sample annotation load directly from text files, in sync
			let rows = []
			for (const file of ds.cohort.files) {
				if (!file.file) throw '.file missing from one of cohort.files[] for ' + ds.genomename + '.' + ds.label
				const txt = fs.readFileSync(path.join(serverconfig.tpmasterdir, file.file), 'utf8').trim()
				if (!txt) throw file.file + ' is empty for ' + ds.genomename + '.' + ds.label
				rows = [...rows, ...d3dsv.tsvParse(txt)]
			}
			delete ds.cohort.files
			if (ds.cohort.raw) {
				ds.cohort.raw = [...ds.cohort.raw, ...rows]
			} else {
				ds.cohort.raw = rows
			}
			console.log(rows.length + ' rows retrieved for ' + ds.label + ' sample annotation')
		}
		if (ds.cohort.tosampleannotation) {
			// a directive to tell client to convert cohort.raw[] to cohort.annotation{}, key-value hash
			if (!ds.cohort.tosampleannotation.samplekey)
				throw '.samplekey missing from .cohort.tosampleannotation for ' + ds.genomename + '.' + ds.label
			if (!ds.cohort.key4annotation)
				throw (
					'.cohort.key4annotation missing when .cohort.tosampleannotation is on for ' + ds.genomename + '.' + ds.label
				)
			// in fact, it still requires ds.cohort.raw, but since db querying is async, not checked
		}
	}

	if (!ds.queries) throw '.queries missing from dataset ' + ds.label + ', ' + ds.genomename
	if (!Array.isArray(ds.queries)) throw ds.label + '.queries is not array'
	for (const q of ds.queries) {
		const err = legacyds_init_one_query(q, ds, genome)
		if (err) throw 'Error parsing a query in "' + ds.label + '": ' + err
	}

	if (ds.vcfinfofilter) {
		const err = common.validate_vcfinfofilter(ds.vcfinfofilter)
		if (err) throw ds.label + ': vcfinfofilter error: ' + err
	}

	if (ds.url4variant) {
		for (const u of ds.url4variant) {
			if (!u.makelabel) throw 'makelabel() missing for one item of url4variant from ' + ds.label
			if (!u.makeurl) throw 'makeurl() missing for one item of url4variant from ' + ds.label
			u.makelabel = u.makelabel.toString()
			u.makeurl = u.makeurl.toString()
		}
	}
}

async function mayCreateSubdirInCache(subdir) {
	const dir = path.join(serverconfig.cachedir, subdir)
	try {
		await fs.promises.stat(dir)
	} catch (e) {
		if (e.code == 'ENOENT') {
			try {
				await fs.promises.mkdir(dir)
			} catch (e) {
				throw 'cannot make dir'
			}
		} else {
			throw 'error stating dir'
		}
	}
	return dir
}

function legacyds_init_one_query(q, ds, genome) {
	/* parse a query from legacy ds.queries[]
	 */
	if (!q.name) return '.name missing'

	if (q.dsblocktracklst) {
		/*
        not sure if still in use!

        one or more block track available from this query
        quick-fix for cohort junction, replace-by-mds
        */
		if (!Array.isArray(q.dsblocktracklst)) return 'dsblocktracklst not an array in ' + ds.label
		for (const tk of q.dsblocktracklst) {
			if (!tk.type) return 'missing type for a blocktrack of ' + ds.label
			if (!tk.file && !tk.url) return 'neither file or url given for a blocktrack of ' + ds.label
		}
		return
	}

	if (q.vcffile) {
		// single vcf
		const meta = child_process
			.execSync(tabix + ' -H ' + path.join(serverconfig.tpmasterdir, q.vcffile), { encoding: 'utf8' })
			.trim()
		if (meta == '') return 'no meta lines in VCF file ' + q.vcffile + ' of query ' + q.name
		const [info, format, samples, errs] = vcf.vcfparsemeta(meta.split('\n'))
		if (errs) return 'error parsing VCF meta lines of ' + q.vcffile + ': ' + errs.join('; ')
		q.vcf = {
			vcfid: Math.random().toString(),
			info: info,
			format: format,
			samples: samples
		}
		if (q.hlinfo) {
			q.vcf.hlinfo = q.hlinfo
			delete q.hlinfo
		}
		if (q.infopipejoin) {
			q.vcf.infopipejoin = q.infopipejoin
			delete q.infopipejoin
		}
		const tmp = child_process
			.execSync(tabix + ' -l ' + path.join(serverconfig.tpmasterdir, q.vcffile), { encoding: 'utf8' })
			.trim()
		if (tmp == '') return 'tabix -l found no chromosomes/contigs in ' + q.vcffile + ' of query ' + q.name
		q.vcf.nochr = common.contigNameNoChr(genome, tmp.split('\n'))
		let infoc = 0
		if (info) {
			for (const n in info) infoc++
		}
		console.log(
			'Parsed vcf meta from ' +
				q.vcffile +
				': ' +
				infoc +
				' INFO, ' +
				samples.length +
				' sample, ' +
				(q.vcf.nochr ? 'no "chr"' : 'has "chr"')
		)
		return
	}

	if (q.makequery) {
		if (q.isgeneexpression) {
			if (!q.config) return 'config object missing for gene expression query of ' + q.name
			if (q.config.maf) {
				q.config.maf.get = q.config.maf.get.toString()
			}
		}
		return
	}

	return 'do not know how to parse query: ' + q.name
}

/////////////////// __MDS

async function mds_init(ds, genome, _servconfig) {
	/*
    ds: loaded from datasets/what.js
    genome: obj {}
    _servconfig: the entry in "datasets" array from serverconfig.json
    */
	if (ds.isMds2 || ds.isMds3 || ds.isMds) {
		// !!! TODO: does this repeat an earlier server_updateAttr? !!!
		server_updateAttr(ds, _servconfig)
	} //else console.log('not mds', ds.label)

	if (ds.assayAvailability) {
		if (!ds.assayAvailability.file) throw '.assayAvailability.file missing'
		if (!ds.assayAvailability.assays) throw '.assayAvailability.assays[] missing'
		Object.freeze(ds.assayAvailability.assays)
		ds.assayAvailability.samples = new Map()
		for (const line of fs
			.readFileSync(path.join(serverconfig.tpmasterdir, ds.assayAvailability.file), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			const [sample, t] = line.split('\t')
			ds.assayAvailability.samples.set(sample, JSON.parse(t))
		}
		console.log(ds.assayAvailability.samples.size + ' samples with assay availability (' + ds.label + ')')
	}

	if (ds.gene2mutcount) {
		if (!ds.gene2mutcount.dbfile) throw '.gene2mutcount.dbfile missing'
		try {
			console.log('Connecting', ds.gene2mutcount.dbfile)
			ds.gene2mutcount.db = utils.connect_db(ds.gene2mutcount.dbfile)
			console.log('DB connected for ' + ds.label + ': ' + ds.gene2mutcount.dbfile)
		} catch (e) {
			throw `Error connecting db at ${ds.gene2mutcount.dbfile}` //fix for inspecific error message
		}
	}

	if (ds.sampleAssayTrack) {
		if (!ds.sampleAssayTrack.file) throw '.file missing from sampleAssayTrack'
		ds.sampleAssayTrack.samples = new Map()

		let count = 0

		let unannotated = new Set()

		for (const line of fs
			.readFileSync(path.join(serverconfig.tpmasterdir, ds.sampleAssayTrack.file), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			if (!line) continue
			if (line[0] == '#') continue

			const [sample, assay, jsontext] = line.split('\t')
			if (!assay || !jsontext) continue

			if (!ds.sampleAssayTrack.samples.has(sample)) {
				// new sample
				if (ds.cohort && ds.cohort.annotation) {
					if (!ds.cohort.annotation[sample]) {
						// this sample is unannotated
						unannotated.add(sample)
						continue
					}
				}

				ds.sampleAssayTrack.samples.set(sample, [])
			}

			const tk = JSON.parse(jsontext)
			// TODO validate track
			if (!common.tkt[tk.type]) throw 'invalid type from a sample track: ' + jsontext
			if (!tk.name) {
				tk.name = sample + ' ' + assay
			}

			tk.assayName = assay

			ds.sampleAssayTrack.samples.get(sample).push(tk)
			count++
		}

		console.log(count + ' assay-tracks from ' + ds.sampleAssayTrack.samples.size + ' samples (' + ds.label + ')')
		if (unannotated.size) {
			console.log(
				'Error: ' + unannotated.size + ' samples with assay tracks are unannotated: ' + [...unannotated].join(' ')
			)
		}
	}

	if (ds.singlesamplemutationjson) {
		const m = ds.singlesamplemutationjson
		if (!m.file) throw '.file missing from singlesamplemutationjson'
		m.samples = {}
		let count = 0
		for (const line of fs
			.readFileSync(path.join(serverconfig.tpmasterdir, m.file), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			if (!line) continue
			if (line[0] == '#') continue
			const [sample, file] = line.split('\t')
			if (sample && file) {
				count++
				m.samples[sample] = file
			}
		}
		console.log(count + ' samples for disco plot')
	}

	if (ds.cohort && ds.cohort.db && ds.cohort.termdb) {
		await mds2_init.init_db(ds, app, basepath)
	}

	if (ds.cohort && ds.cohort.files) {
		/*
        *********** legacy mds *************

        following all loads sample attributes from text files
        and store in ds.cohort.annotation
        */

		if (!Array.isArray(ds.cohort.files)) throw '.cohort.files is not array'

		if (!ds.cohort.tohash) throw '.tohash() missing from cohort'
		if (typeof ds.cohort.tohash != 'function') throw '.cohort.tohash is not function'
		if (!ds.cohort.samplenamekey) throw '.samplenamekey missing'

		// should allow both sample/individual level as key
		ds.cohort.annotation = {}

		if (ds.cohort.mutation_signature) {
			const s = ds.cohort.mutation_signature
			if (!s.sets) throw '.mutation_signature.sets missing'
			for (const k in s.sets) {
				const ss = s.sets[k]
				if (!ss.name) ss.name = k
				if (!ss.signatures) throw '.signatures{} missing from a signature set'
				if (ss.samples) {
					if (!ss.samples.file) throw '.samples.file missing from a signature set'
					const [err, items] = parse_textfilewithheader(
						fs.readFileSync(path.join(serverconfig.tpmasterdir, ss.samples.file), { encoding: 'utf8' }).trim()
					)
					ss.samples.map = new Map()
					for (const i of items) {
						const sample = i[ds.cohort.samplenamekey]
						if (!sample) throw ds.cohort.samplenamekey + ' missing in file ' + ss.samples.file
						ss.samples.map.set(sample, i)

						// parse to float
						for (const sk in ss.signatures) {
							if (i[sk]) {
								const v = Number.parseFloat(i[sk])
								if (Number.isNaN(v)) throw 'mutation signature value is not float: ' + i[sk] + ' from sample ' + sample
								if (ss.samples.skipzero && v == 0) {
									delete i[sk]
								} else {
									i[sk] = v
								}
							}
						}
					}
				}
			}
		}

		if (ds.cohort.attributes) {
			if (!ds.cohort.attributes.lst) throw '.lst[] missing for cohort.attributes'
			if (!Array.isArray(ds.cohort.attributes.lst)) return '.cohort.attributes.lst is not array'
			for (const attr of ds.cohort.attributes.lst) {
				if (!attr.key) throw '.key missing from one of the .cohort.attributes.lst[]'
				if (!attr.label) throw '.label missing from one of the .cohort.attributes.lst[]'
				if (!attr.values) throw '.values{} missing from ' + attr.label + ' of .cohort.attributes.lst'
				for (const value in attr.values) {
					if (!attr.values[value].label)
						throw '.label missing from one value of ' + attr.label + ' in .cohort.attributes.lst'
				}
			}
			if (ds.cohort.attributes.defaulthidden) {
				// allow attributes hidden by default
				for (const key in ds.cohort.attributes.defaulthidden) {
					const hideattr = ds.cohort.attributes.lst.find(i => i.key == key)
					if (!hideattr) throw 'invalid defaulthidden key: ' + key
					for (const value in ds.cohort.attributes.defaulthidden[key]) {
						if (!hideattr.values[value]) throw 'invalid defaulthidden value ' + value + ' for ' + key
					}
				}
			}
		}

		if (ds.cohort.hierarchies) {
			if (!ds.cohort.hierarchies.lst) throw '.lst[] missing from .cohort.hierarchies'
			if (!Array.isArray(ds.cohort.hierarchies.lst)) throw '.cohort.hierarchies.lst is not array'
			for (const h of ds.cohort.hierarchies.lst) {
				if (!h.name) throw '.name missing from one hierarchy'
				if (!h.levels) throw '.levels[] missing from one hierarchy'
				if (!Array.isArray(h.levels)) throw '.levels is not array from one hierarchy'
				for (const l of h.levels) {
					if (!l.k) throw '.k missing from one level in hierarchy ' + h.name
				}
			}
		}

		if (ds.cohort.sampleAttribute) {
			if (!ds.cohort.sampleAttribute.attributes) throw 'attributes{} missing from cohort.sampleAttribute'
			for (const key in ds.cohort.sampleAttribute.attributes) {
				const a = ds.cohort.sampleAttribute.attributes[key]
				if (!a.label) throw '.label missing for key ' + key + ' from cohort.sampleAttribute.attributes'
				if (a.values) {
					// optional
					for (const v in a.values) {
						const b = a.values[v]
						if (typeof b != 'object') throw 'value "' + v + '" not pointing to {} from sampleAttribute'
						if (!b.name) b.name = v
					}
				}
				if (a.showintrack) {
					if (!a.isinteger && !a.isfloat) throw a.label + ': .showintrack requires .isinteger or .isfloat'
				}
			}
		}

		if (ds.cohort.scatterplot) {
			if (!ds.cohort.sampleAttribute) throw '.sampleAttribute missing but required for .cohort.scatterplot'

			const sp = ds.cohort.scatterplot

			// querykey is required
			if (!sp.querykey) throw '.querykey missing from .cohort.scatterplot'
			{
				if (!ds.queries) throw '.cohort.scatterplot.querykey in use but ds.queries{} missing'
				const tk = ds.queries[sp.querykey]
				if (!tk) throw 'unknown query by .cohort.scatterplot.querykey: ' + sp.querykey
				if (tk.type != common.tkt.mdssvcnv)
					throw 'type is not ' + common.tkt.mdssvcnv + ' of the track pointed to by .cohort.scatterplot.querykey'
			}

			if (sp.colorbygeneexpression) {
				if (!sp.colorbygeneexpression.querykey) throw 'querykey missing from .cohort.scatterplot.colorbygeneexpression'
				if (!ds.queries) throw '.cohort.scatterplot.colorbygeneexpression in use but ds.queries{} missing'
				const tk = ds.queries[sp.colorbygeneexpression.querykey]
				if (!tk)
					throw (
						'unknown query by .cohort.scatterplot.colorbygeneexpression.querykey: ' + sp.colorbygeneexpression.querykey
					)
				if (!tk.isgenenumeric)
					throw 'isgenenumeric missing from the track pointed to by .cohort.scatterplot.colorbygeneexpression.querykey'
			}

			if (sp.tracks) {
				// a common set of tracks to be shown in single sample browser upon clicking a dot
				// must label them as custom otherwise they won't be listed
				// TODO validate the tracks
			}

			// TODO support multiple plots
			if (!sp.x) throw '.x missing from .cohort.scatterplot'
			if (!sp.x.attribute) throw '.attribute missing from .cohort.scatterplot.x'
			const x = ds.cohort.sampleAttribute.attributes[sp.x.attribute]
			if (!x) throw 'scatterplot.x.attribute is not defined in sampleAttribute'
			if (!x.isfloat) throw 'scatterplot.x is not "isfloat"'
			if (!sp.y) throw '.y missing from .cohort.scatterplot'
			if (!sp.y.attribute) throw '.attribute missing from .cohort.scatterplot.y'
			const y = ds.cohort.sampleAttribute.attributes[sp.y.attribute]
			if (!y) throw 'scatterplot.y.attribute is not defined in sampleAttribute'
			if (!y.isfloat) throw 'scatterplot.y is not "isfloat"'
			if (sp.colorbyattributes) {
				for (const attr of sp.colorbyattributes) {
					if (!attr.key) throw '.key missing from one of scatterplot.colorbyattributes'
					const attrreg = ds.cohort.sampleAttribute.attributes[attr.key]
					if (!attrreg) throw 'unknown attribute by key ' + attr.key + ' from scatterplot.colorbyattributes'
					attr.label = attrreg.label
					attr.values = attrreg.values
				}
			}
		}

		for (const file of ds.cohort.files) {
			if (!file.file) throw '.file missing from one of .cohort.files'
			const [err, items] = parse_textfilewithheader(
				fs.readFileSync(path.join(serverconfig.tpmasterdir, file.file), { encoding: 'utf8' }).trim()
			)
			if (err) throw 'cohort annotation file "' + file.file + '": ' + err
			//if(items.length==0) return 'no content from sample annotation file '+file.file
			console.log(ds.label + ': ' + items.length + ' samples loaded from annotation file ' + file.file)
			items.forEach(i => {
				// may need to parse certain values into particular format

				for (const k in i) {
					let attr
					if (ds.cohort.sampleAttribute) {
						attr = ds.cohort.sampleAttribute.attributes[k]
					}
					if (!attr) {
						if (ds.cohort.termdb && ds.cohort.termdb.termjson && ds.cohort.termdb.termjson.map) {
							attr = ds.cohort.termdb.termjson.map.get(k)
						}
					}
					if (attr) {
						if (attr.isfloat) {
							i[k] = Number.parseFloat(i[k])
						} else if (attr.isinteger) {
							i[k] = Number.parseInt(i[k])
						}
					}
				}

				ds.cohort.tohash(i, ds)
			})
		}
		ds.cohort.annorows = Object.values(ds.cohort.annotation)
		console.log(ds.label + ': total samples from sample table: ' + ds.cohort.annorows.length)

		if (ds.cohort.survivalplot) {
			// ds.cohort.annotation needs to be loaded for initing survival
			const sp = ds.cohort.survivalplot
			if (!sp.plots) throw '.plots{} missing from survivalplot'

			// make the object for initiating client
			sp.init = {
				plottypes: []
			}

			for (const k in sp.plots) {
				const p = sp.plots[k]
				if (!p.name) throw '.name missing from survivalplot ' + k
				if (!p.serialtimekey) throw '.serialtimekey missing from survivalplot ' + k
				if (!p.iscensoredkey) throw '.iscensoredkey missing from survivalplot ' + k
				if (!p.timelabel) throw '.timelabel missing from survivalplot ' + k
				p.key = k

				sp.init.plottypes.push({
					key: k,
					name: p.name,
					timelabel: p.timelabel
				})
			}

			if (sp.samplegroupattrlst) {
				sp.init.samplegroupings = []
				for (const a of sp.samplegroupattrlst) {
					if (!a.key) throw '.key missing from an attr of samplegroupattrlst for survival'

					const attr = ds.cohort.sampleAttribute.attributes[a.key]
					if (!attr) throw 'unknown attribute key "' + a.key + '" from survival samplegroupattrlst'

					const value2count = new Map()
					for (const samplename in ds.cohort.annotation) {
						const sobj = ds.cohort.annotation[samplename]
						const v = sobj[a.key]
						if (v == undefined) {
							// sample not annotated by it
							continue
						}

						let hasoutcome = false
						// if the sample has info in any plot, will count it
						for (const k in sp.plots) {
							if (sobj[sp.plots[k].serialtimekey] != undefined) {
								hasoutcome = true
								break
							}
						}

						if (hasoutcome) {
							if (value2count.has(v)) {
								value2count.set(v, value2count.get(v) + 1)
							} else {
								value2count.set(v, 1)
							}
						}
					}
					if (value2count.size == 0) throw 'no value found for "' + a.key + '" from survival samplegroupattrlst'

					const lst = []
					for (const [v, c] of value2count) {
						lst.push({ value: v, count: c })
					}
					sp.init.samplegroupings.push({
						key: a.key,
						label: attr.label,
						values: lst
					})
				}
			}
		}
	}

	if (ds.mutationAttribute) {
		/*
        mutation-level attributes
        for items in svcnv track:
        	.mattr{}
        for vcf:
        	FORMAT
        */
		if (!ds.mutationAttribute.attributes) throw 'attributes{} missing from mutationAttribute'
		for (const key in ds.mutationAttribute.attributes) {
			const a = ds.mutationAttribute.attributes[key]
			if (!a.label) throw '.label missing for key ' + key + ' from mutationAttribute.attributes'
			if (a.appendto_link) {
				// this is pmid, no .values{}
				continue
			}
			if (a.values) {
				for (const v in a.values) {
					const b = a.values[v]
					if (!b.name) throw '.name missing for value ' + v + ' of key ' + key + ' from mutationAttribute.attributes'
				}
			} else {
				// allow values{} missing
			}
		}
	}

	if (ds.alleleAttribute) {
		/*
        vcf info field, allele-level
        */
		if (!ds.alleleAttribute.attributes) throw 'attributes{} missing from alleleAttribute'
		for (const key in ds.alleleAttribute.attributes) {
			const a = ds.alleleAttribute.attributes[key]
			if (!a.label) throw '.label missing for key ' + key + ' from alleleAttribute.attributes'
			if (a.isnumeric) {
				continue
			}
			// not numeric value
			if (!a.values) throw '.values{} missing for non-numeric key ' + key + ' from alleleAttribute.attributes'
			for (const v in a.values) {
				const b = a.values[v]
				if (!b.name) throw '.name missing for value ' + v + ' of key ' + key + ' from alleleAttribute.attributes'
			}
		}
	}

	if (ds.locusAttribute) {
		/*
        vcf info field, locus-level
        */
		if (!ds.locusAttribute.attributes) throw 'attributes{} missing from locusAttribute'
		for (const key in ds.locusAttribute.attributes) {
			const a = ds.locusAttribute.attributes[key]
			if (!a.label) throw '.label missing for key ' + key + ' from locusAttribute.attributes'
			if (a.isnumeric) {
				continue
			}
			if (a.appendto_link) {
				// no .values{}
				continue
			}
			// not numeric value
			if (!a.values) throw '.values{} missing for non-numeric key ' + key + ' from locusAttribute.attributes'
			for (const v in a.values) {
				const b = a.values[v]
				if (!b.name) throw '.name missing for value ' + v + ' of key ' + key + ' from locusAttribute.attributes'
			}
		}
	}

	if (ds.queries) {
		// ds.queries is the 1st generation track

		for (const querykey in ds.queries) {
			// server may choose to remove it
			if (_servconfig.remove_queries && _servconfig.remove_queries.indexOf(querykey) != -1) {
				delete ds.queries[querykey]
				continue
			}

			const query = ds.queries[querykey]

			// server may choose to hide some queries
			if (_servconfig.hide_queries && _servconfig.hide_queries.indexOf(querykey) != -1) {
				// this query will be hidden on client
				query.hideforthemoment = 1
			}

			if (query.istrack) {
				if (!query.type) throw '.type missing for track query ' + querykey

				if (query.viewrangeupperlimit) {
					if (!Number.isInteger(query.viewrangeupperlimit))
						throw '.viewrangeupperlimit should be integer for track query ' + querykey
				}

				if (query.type == common.tkt.mdsjunction) {
					const err = mds_init_mdsjunction(query, ds, genome)
					if (err) throw querykey + ' (mdsjunction) error: ' + err
				} else if (query.type == common.tkt.mdscnv) {
					// obsolete

					const err = mds_init_mdscnv(query, ds, genome)
					if (err) throw querykey + ' (mdscnv) error: ' + err
				} else if (query.type == common.tkt.mdssvcnv) {
					// replaces mdscnv

					const err = mds_init_mdssvcnv(query, ds, genome)
					if (err) throw querykey + ' (svcnv) error: ' + err
				} else if (query.type == common.tkt.mdsvcf) {
					// snvindel

					const err = await mds_init_mdsvcf(query, ds, genome)
					if (err) throw querykey + ' (vcf) error: ' + err
				} else {
					throw 'unknown track type for a query: ' + query.type + ' ' + querykey
				}

				mds_mayPrecompute_grouptotal(query, ds)
			} else if (query.isgenenumeric) {
				const err = mds_init_genenumeric(query, ds, genome)
				if (err) throw querykey + ' (genenumeric) error: ' + err
			} else {
				throw 'unknown type of query from ' + querykey
			}
		}
	}

	if (ds.track) {
		await mds2_init.init_track(ds, genome)
	}

	if (ds.annotationsampleset2matrix) {
		if (!ds.cohort) throw 'ds.cohort misssing when annotationsampleset2matrix is in use'
		if (!ds.cohort.annotation) throw 'ds.cohort.annotation misssing when annotationsampleset2matrix is in use'
		if (!ds.queries) throw 'ds.queries misssing when annotationsampleset2matrix is in use'
		if (!ds.annotationsampleset2matrix.key) throw '.key STR missing in annotationsampleset2matrix'
		if (!ds.annotationsampleset2matrix.groups) throw '.groups{} missing in annotationsampleset2matrix'
		if (typeof ds.annotationsampleset2matrix.groups != 'object')
			throw 'ds.annotationsampleset2matrix.groups{} not an object'
		for (const groupvalue in ds.annotationsampleset2matrix.groups) {
			const thisgroup = ds.annotationsampleset2matrix.groups[groupvalue]
			// a group will have 1 or more smaller groups, each is samples from a study
			if (!thisgroup.groups || !Array.isArray(thisgroup.groups) || thisgroup.groups.length == 0)
				throw '.groups[] must be nonempty array in ' + groupvalue
			for (const group of thisgroup.groups) {
				if (!group.name) throw '.name missing from one of .groups[] in ' + groupvalue
				const smat = group.matrixconfig
				if (!smat) throw '.matrixconfig missing from one of .groups[] of ' + groupvalue
				if (!smat.features) throw '.features[] missing from group ' + groupvalue
				if (!Array.isArray(smat.features)) throw '.features[] should be array from group ' + groupvalue
				if (smat.features.length == 0) throw '.features[] zero length from group ' + groupvalue
				for (const feature of smat.features) {
					if (ds.annotationsampleset2matrix.commonfeatureattributes) {
						// apply common attributes to each feature
						for (const k in ds.annotationsampleset2matrix.commonfeatureattributes) {
							// not to overwrite predefined value
							if (feature[k] == undefined) {
								feature[k] = ds.annotationsampleset2matrix.commonfeatureattributes[k]
							}
						}
					}
					if (feature.ismutation) {
						if (!feature.position)
							throw 'position missing from feature ' + JSON.stringify(feature) + ' from group ' + groupvalue
						if (!feature.querykeylst) throw '.querykeylst[] missing from ismutation feature from group ' + groupvalue
						if (!Array.isArray(feature.querykeylst))
							throw '.querykeylst[] not an array from ismutation feature from group ' + groupvalue
						if (feature.querykeylst.length == 0)
							throw '.querykeylst[] zero length from ismutation feature from group ' + groupvalue
						for (const querykey of feature.querykeylst) {
							if (!ds.queries[querykey])
								throw 'unknown query key "' + querykey + '" from ismutation feature of group ' + groupvalue
						}
						continue
					}
					return 'unknown feature type from group ' + groupvalue
				}
				if (!smat.limitsamplebyeitherannotation)
					throw '.limitsamplebyeitherannotation[] missing from group ' + groupvalue
				if (!Array.isArray(smat.limitsamplebyeitherannotation))
					throw '.limitsamplebyeitherannotation[] should be array from group ' + groupvalue
				if (smat.limitsamplebyeitherannotation.length == 0)
					throw '.limitsamplebyeitherannotation[] zero length from group ' + groupvalue
				for (const lim of smat.limitsamplebyeitherannotation) {
					if (!lim.key) throw 'key missing from one of limitsamplebyeitherannotation from group ' + groupvalue
					if (!lim.value) throw 'value missing from one of limitsamplebyeitherannotation from group ' + groupvalue
				}
			}
		}
		delete ds.annotationsampleset2matrix.commonfeatureattributes
	}
}

function mds_mayPrecompute_grouptotal(query, ds) {
	if (!query.groupsamplebyattr) return
	query.groupsamplebyattr.key2group = new Map()
	for (const samplename in ds.cohort.annotation) {
		mdssvcnv_grouper(samplename, [], query.groupsamplebyattr.key2group, [], ds, query)
	}
}

function mds_init_mdsjunction(query, ds, genome) {
	// mdsjunction only allows single track

	if (query.readcountCutoff) {
		if (!Number.isInteger(query.readcountCutoff) || query.readcountCutoff < 1)
			return 'readcountCutoff must be positive integer'
	}

	let cwd = null
	let _file

	if (query.file) {
		const [err, tmp] = validate_tabixfile(query.file)
		if (err) return 'tabix file error: ' + err
		query.file = tmp // replace with full path
		_file = tmp
	} else if (query.url) {
		// TODO cache_index sync
		// need to set query.usedir to cache path
		_file = query.url
	} else {
		return 'no file or url given for mdsjunction ' + query.name
	}

	const arg = { encoding: 'utf8' }
	if (cwd) {
		arg.cwd = cwd
	}

	const header = child_process.execSync(tabix + ' -H ' + _file, arg).trim()
	if (header) {
		// has header, get samples
		const lines = header.split('\n')
		if (lines.length != 1) return 'mdsjunction file has multiple header lines (begin with #), but should have just 1'
		const lst = lines[0].split('\t')
		// #chr \t start \t stop \t strand \t type \t samples ...
		if (lst[5]) {
			query.samples = lst.slice(5)
			query.attributeSummary = mds_query_attrsum4samples(query.samples, ds)
			query.hierarchySummary = mds_query_hierarchy4samples(query.samples, ds)
			for (const name in query.hierarchySummary) {
				let levelcount = 0
				for (const k in query.hierarchySummary[name]) levelcount++
				console.log(levelcount + ' ' + name + ' hierarchy levels for ' + query.name)
			}
		}
	}

	{
		const tmp = child_process.execSync(tabix + ' -l ' + _file, arg).trim()
		if (!tmp) return 'no chromosomes found'
		query.nochr = common.contigNameNoChr(genome, tmp.split('\n'))
	}

	console.log(
		'(mdsjunction) ' +
			query.name +
			': ' +
			(query.samples ? query.samples.length : 0) +
			' samples, ' +
			(query.nochr ? 'no "chr"' : 'has "chr"')
	)

	if (!query.infoFilter) return '.infoFilter{} missing'
	if (!query.infoFilter.lst) return '.lst[] missing from .infoFilter'
	// currently infoFilter contains Type (column 5) and splice events, both are categorical
	for (const info of query.infoFilter.lst) {
		if (!info.key) return '.key missing from one of infoFilter'
		if (!info.label) return '.label missing from one of infoFilter'
		if (!info.categories) return '.categories missing from one of infoFilter'
		for (const k in info.categories) {
			if (!info.categories[k].label) return '.label missing from one category of ' + info.label
			if (!info.categories[k].color) return '.color missing from on category of ' + info.label
		}
		if (info.hiddenCategories) {
			// allow initially hidden categories
			for (const k in info.hiddenCategories) {
				if (!info.categories[k]) return 'invalid hidden key ' + k + ' of ' + info.label
			}
		} else {
			info.hiddenCategories = {}
		}
	}

	if (!query.singlejunctionsummary) return '.singlejunctionsummary missing but is currently required from ' + query.name
	if (query.singlejunctionsummary.readcountboxplotpercohort) {
		if (!query.singlejunctionsummary.readcountboxplotpercohort.groups)
			return '.groups[] missing from query.singlejunctionsummary.readcountboxplotpercohort for ' + query.name
		for (const g of query.singlejunctionsummary.readcountboxplotpercohort.groups) {
			if (!g.key) return '.key missing from one group of query.singlejunctionsummary.readcountboxplotpercohort.groups'
			if (!g.label)
				return '.label missing from one group of query.singlejunctionsummary.readcountboxplotpercohort.groups'
		}
	}
}

function mds_query_attrsum4samples(samples, ds) {
	/*
    summarizes a group of samples by list of attributes in ds.cohort.attributes.lst[]

    a query from mds has total list of samples, e.g. samples in mdsjunction represent those with RNA-seq
    for these samples, will sum up .totalCount for cohort annotation attributes/values (by ds.cohort.attributes)
    rather than computing .totalCount over all samples of the ds.cohort, so as to limit to relevant assays
    so on cohortFilter legend it will only show totalCount from those samples with RNA-seq etc
    */
	if (!ds.cohort || !ds.cohort.annotation || !ds.cohort.attributes || !samples) return

	const result = {}
	for (const attr of ds.cohort.attributes.lst) {
		// TODO numeric attribute?

		const v2c = {}
		for (const value in attr.values) {
			v2c[value] = 0
		}
		// go over samples look for this attribute
		for (const sample of samples) {
			const anno = ds.cohort.annotation[sample]
			if (!anno) {
				// this sample has no annotation
				continue
			}
			const thisvalue = anno[attr.key]
			if (thisvalue == undefined) {
				// this sample not annotated by this attribute
				continue
			}
			if (thisvalue in v2c) {
				v2c[thisvalue]++
			}
		}
		result[attr.key] = v2c
	}
	return result
}

function mds_query_hierarchy4samples(samples, ds) {
	/*
    given a list of sample names, generate hierarchy summary

    	key: hierarchy path (HM...BALL...ERG)
    	value: number of samples

    works for both initializing the sample sets from each ds query, and also for samples in view range in real-time track query
    */
	if (!ds.cohort || !ds.cohort.annotation || !ds.cohort.hierarchies || samples.length == 0) return
	const lst = []
	for (const n of samples) {
		const a = ds.cohort.annotation[n]
		if (!a) continue
		lst.push(a)
	}

	const results = {}

	for (const hierarchy of ds.cohort.hierarchies.lst) {
		const nodes = stratinput(lst, hierarchy.levels)
		const root = d3stratify()(nodes)
		root.sum(i => i.value)
		const id2count = {}
		root.eachBefore(i => {
			id2count[i.id] = i.value
		})
		results[hierarchy.name] = id2count
	}
	return results
}

function mds_init_mdscnv(query, ds, genome) {
	// mdscnv only allows single track

	let cwd = null
	let _file

	if (query.file) {
		const [err, tmp] = validate_tabixfile(query.file)
		if (err) return 'tabix file error: ' + err
		_file = tmp
	} else if (query.url) {
		// TODO cache_index sync
		// need to set query.usedir to cache path
		_file = query.url
	} else {
		return 'no file or url given for (mdscnv) ' + query.name
	}

	const arg = { encoding: 'utf8' }
	if (cwd) {
		arg.cwd = cwd
	}

	const header = child_process.execSync(tabix + ' -H ' + _file, arg).trim()
	if (header) {
		// has header, get samples
		const lines = header.split('\n')
		if (lines.length != 1) return 'mdscnv file has multiple header lines (begin with #), but should have just 1'
		const lst = lines[0].split('\t')
		query.samples = lst.slice(5)
		query.attributeSummary = mds_query_attrsum4samples(query.samples, ds)
		query.hierarchySummary = mds_query_hierarchy4samples(query.samples, ds)
		for (const name in query.hierarchySummary) {
			let levelcount = 0
			for (const k in query.hierarchySummary[name]) levelcount++
			console.log(levelcount + ' ' + name + ' hierarchy levels for ' + query.name)
		}
	}

	{
		const tmp = child_process.execSync(tabix + ' -l ' + _file, arg).trim()
		if (!tmp) return 'no chromosomes found'
		query.nochr = common.contigNameNoChr(genome, tmp.split('\n'))
	}

	console.log(
		'(' +
			query.type +
			') ' +
			query.name +
			': ' +
			(query.samples ? query.samples.length : 'no') +
			' samples, ' +
			(query.nochr ? 'no "chr"' : 'has "chr"')
	)
}

function mds_init_mdssvcnv(query, ds, genome) {
	// only allows single track, since there is no challenge merging multiple into one

	let cwd = null
	let _file

	if (query.file) {
		const [err, tmp] = validate_tabixfile(query.file)
		if (err) return 'tabix file error: ' + err
		_file = tmp
	} else if (query.url) {
		// TODO cache_index sync
		// need to set query.usedir to cache path
		_file = query.url
	} else {
		return 'no file or url given for (svcnv) ' + query.name
	}

	const arg = { encoding: 'utf8' }
	if (cwd) {
		arg.cwd = cwd
	}

	const header = child_process.execSync(tabix + ' -H ' + _file, arg).trim()
	if (header) {
		// has header, get samples
		const set = new Set()
		for (const line of header.split('\n')) {
			for (const s of line.split(' ').slice(1)) {
				set.add(s)
			}
		}
		if (set.size == 0) return 'no samples from the header line'
		query.samples = [...set]

		if (ds.cohort && ds.cohort.annotation) {
			// find & report unannotated samples
			const unknown = new Set()
			for (const sample of query.samples) {
				if (!ds.cohort.annotation[sample]) {
					unknown.add(sample)
				}
			}
			if (unknown.size) {
				console.log(
					'mdssvcnv unannotated samples: ' + (query.noprintunannotatedsamples ? unknown.size : [...unknown].join(' '))
				)
			}
		}

		/*
        // not used at the moment
        query.attributeSummary = mds_query_attrsum4samples(query.samples, ds)
        query.hierarchySummary = mds_query_hierarchy4samples(query.samples,ds)
        for(const hierarchyname in query.hierarchySummary) {
        	let levelcount=0
        	for(const k in query.hierarchySummary[ hierarchyname ]) levelcount++
        	console.log(levelcount+' '+hierarchyname+' hierarchy levels for '+query.name)
        }
        */
	}

	{
		const tmp = child_process.execSync(tabix + ' -l ' + _file, arg).trim()
		if (!tmp) return 'no chromosomes found'
		query.nochr = common.contigNameNoChr(genome, tmp.split('\n'))
	}

	if (query.expressionrank_querykey) {
		// check expression rank, data from another query
		const thatquery = ds.queries[query.expressionrank_querykey]
		if (!thatquery) return 'invalid key by expressionrank_querykey'
		if (!thatquery.isgenenumeric) return 'query ' + query.expressionrank_querykey + ' not tagged as isgenenumeric'
	}

	if (query.vcf_querykey) {
		// check expression rank, data from another query
		const thatquery = ds.queries[query.vcf_querykey]
		if (!thatquery) return 'invalid key by vcf_querykey'
		if (thatquery.type != common.tkt.mdsvcf) return 'query ' + query.vcf_querykey + ' not of mdsvcf type'
	}

	if (query.groupsamplebyattr) {
		if (!query.groupsamplebyattr.attrlst) return '.attrlst[] missing from groupsamplebyattr'
		if (query.groupsamplebyattr.attrlst.length == 0) return 'groupsamplebyattr.attrlst[] empty array'
		if (!ds.cohort) return 'groupsamplebyattr in use but ds.cohort missing'
		if (!ds.cohort.annotation) return 'groupsamplebyattr in use but ds.cohort.annotation missing'
		if (!ds.cohort.sampleAttribute) {
			ds.cohort.sampleAttribute = {}
		}
		if (!ds.cohort.sampleAttribute.attributes) {
			ds.cohort.sampleAttribute.attributes = {}
			console.log('cohort.sampleAttribute added when groupsamplebyattr is in use')
		}
		for (const attr of query.groupsamplebyattr.attrlst) {
			if (!attr.k) return 'k missing from one of groupsamplebyattr.attrlst[]'
			if (!ds.cohort.sampleAttribute.attributes[attr.k]) {
				ds.cohort.sampleAttribute.attributes[attr.k] = {
					label: attr.label || attr.k
				}
			}
		}
		if (query.groupsamplebyattr.sortgroupby) {
			if (!query.groupsamplebyattr.sortgroupby.key) return '.key missing from .sortgroupby'
			if (!query.groupsamplebyattr.sortgroupby.order) return '.order[] missing from .sortgroupby'
			if (!Array.isArray(query.groupsamplebyattr.sortgroupby.order)) return '.order must be an array'
			// values of order[] is not validated
		}
		if (!query.groupsamplebyattr.attrnamespacer) query.groupsamplebyattr.attrnamespacer = ', '
	}

	console.log(
		'(' +
			query.type +
			') ' +
			query.name +
			': ' +
			(query.samples ? query.samples.length : 'no') +
			' samples, ' +
			(query.nochr ? 'no "chr"' : 'has "chr"')
	)
}

function mds_init_genenumeric(query, ds, genome) {
	if (!query.datatype) return 'datatype missing'
	if (query.viewrangeupperlimit) {
		if (Number.isNaN(query.viewrangeupperlimit)) return 'invalid value for viewrangeupperlimit'
	}

	let cwd = null
	let _file
	if (query.file) {
		const [err, tmp] = validate_tabixfile(query.file)
		if (err) return 'tabix file error: ' + err
		_file = tmp
	} else {
		// no url support yet
		return 'file missing'
	}

	const arg = { cwd: cwd, encoding: 'utf8' }

	{
		const tmp = child_process.execSync(tabix + ' -H ' + _file, arg).trim()
		if (!tmp) return 'no header line (#sample <sample1> ...)'
		// allow multiple # lines
		const set = new Set()
		for (const line of tmp.split('\n')) {
			const l = line.split(' ')
			for (let i = 1; i < l.length; i++) {
				set.add(l[i])
			}
		}
		if (set.size == 0) return 'no sample names from header line'
		query.samples = [...set]
		console.log('(genenumeric) ' + query.name + ': ' + query.samples.length + ' samples')
	}
	if (query.boxplotbysamplegroup) {
		if (!query.boxplotbysamplegroup.attributes) return 'boxplotbysamplegroup.attributes missing'
		if (!Array.isArray(query.boxplotbysamplegroup.attributes)) return 'boxplotbysamplegroup.attributes should be array'
		for (const a of query.boxplotbysamplegroup.attributes) {
			if (!a.k) return 'k missing from one of boxplotbysamplegroup.attributes[]'
		}
	}
}

async function mds_init_mdsvcf(query, ds, genome) {
	/*
    mixture of snv/indel (vcf), ITD, and others
    that are not either cnv or sv
    has member tracks, each track of one type of data
    */

	if (!query.tracks) return 'tracks[] missing'
	if (!Array.isArray(query.tracks)) return 'tracks should be array'

	/*
    info from all member tracks are merged, this requires the same info shared across multiple tracks must be identical
    */
	query.info = {}

	for (const tk of query.tracks) {
		if (!tk.file) return 'file missing from a track (url not supported yet)'

		// will set tk.cwd for url

		const [err, _file] = validate_tabixfile(tk.file)
		if (err) return 'tabix file error: ' + err

		if (tk.type == common.mdsvcftype.vcf) {
			const arg = { cwd: tk.cwd, encoding: 'utf8' }

			const tmp = await utils.get_header_tabix(_file, tk.cwd)
			if (tmp.length == 0) return 'no meta/header lines for ' + _file
			const [info, format, samples, errs] = vcf.vcfparsemeta(tmp)
			if (errs) return 'error parsing vcf meta for ' + _file + ': ' + errs.join('\n')

			if (samples.length == 0) return 'vcf file has no sample: ' + _file

			for (const k in info) {
				query.info[k] = info[k]
			}

			tk.format = format

			if (tk.samplenameconvert) {
				if (typeof tk.samplenameconvert != 'function') return '.samplenameconvert must be function'
				for (const s of samples) {
					s.name = tk.samplenameconvert(s.name)
				}
			}

			tk.samples = samples
		} else {
			return 'invalid track type: ' + tk.type
		}

		if (ds.cohort && ds.cohort.annotation) {
			/*
            ds.cohort.annotation is sample-level, e.g. tumor
            if vcf encodes germline stuff on person, or need some kind of sample name conversion,
            need to identify such in this track
            */
			const notannotated = []
			for (const s of tk.samples) {
				if (!ds.cohort.annotation[s.name]) {
					notannotated.push(s.name)
				}
			}
			if (notannotated.length) {
				console.log(ds.label + ': VCF ' + tk.file + ' has unannotated samples: ' + notannotated.join(','))
			}
		}

		{
			const tmp = []
			await utils.get_lines_bigfile({
				args: ['-l', _file],
				dir: tk.cwd,
				callback: line => {
					tmp.push(line)
				}
			})
			if (tmp.length == 0) return 'no chr from ' + _file
			tk.nochr = common.contigNameNoChr(genome, tmp)
		}

		console.log(
			'(' + query.type + ') ' + _file + ': ' + tk.samples.length + ' samples, ' + (tk.nochr ? 'no chr' : 'has chr')
		)
	}

	if (query.singlesamples) {
		if (!query.singlesamples.tablefile) return '.singlesamples.tablefile missing for the VCF query'
		query.singlesamples.samples = {}
		let count = 0
		for (const line of fs
			.readFileSync(path.join(serverconfig.tpmasterdir, query.singlesamples.tablefile), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			if (!line) continue
			if (line[0] == '#') continue
			const l = line.split('\t')
			if (l[0] && l[1]) {
				query.singlesamples.samples[l[0]] = l[1]
				count++
			}
		}
		console.log(count + ' single-sample VCF files')
	}
}

////////////// end of __MDS

function handle_ideogram(req, res) {
	try {
		const g = genomes[req.query.genome]
		if (!g) throw 'invalid genome'
		if (!g.genedb.hasIdeogram) throw 'ideogram not supported on this genome'
		if (!req.query.chr) throw '.chr missing'
		const lst = g.genedb.getIdeogramByChr.all(req.query.chr)
		if (!lst.length) throw 'no ideogram data for this chr'
		res.send(lst)
	} catch (e) {
		res.send({ error: e.message || e })
	}
}
