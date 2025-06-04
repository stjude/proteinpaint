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

import serverconfig from './serverconfig.js'
import util from 'util'
import url from 'url'
import fs from 'fs'
import path from 'path'
import got from 'got'
import lazy from 'lazy'
import child_process from 'child_process'
import { spawn } from 'child_process'
import { createCanvas } from 'canvas'
import imagesize from 'image-size'
import readline from 'readline'
import { stratify as d3stratify } from 'd3-hierarchy'
import * as d3scale from 'd3-scale'
import * as d3dsv from 'd3-dsv'
import * as utils from './utils.js'
import { stratinput } from '#shared/tree.js'
import * as common from '#shared/common.js'
import * as vcf from '#shared/vcf.js'
import { decode as urlJsonDecode } from '#shared/urljson.js'
import handle_study from './handle_study.js'
import * as termdb from './termdb.js'
import bw_request_closure from './bw.js'
import { handle_tkld } from './ld.js'
import * as termdbbarsql from './termdb.barchart.js'
import bedgraphdot_request_closure from './bedgraphdot.js'
import bam_request_closure from './bam.js'
import { mdsjunction_request_closure } from './mds.junction.js'
import { gdc_bam_request } from './bam.gdc.js'
import * as mds3Gdc from './mds3.gdc.js'
import aicheck_request_closure from './aicheck.js'
import bampile_request_closure from './bampile.js'
import junction_request_closure from './junction.js'
import bedj_request_closure from './bedj.js'
import { request_closure as blat_request_closure } from './blat.js'
import { mds3_request_closure } from './mds3.load.js'
import { handle_mdssvcnv_expression } from './handle_mdssvcnv_expression.js'
import { server_updateAttr } from './dsUpdateAttr.js'
import * as massSession from './massSession.js'
import * as singlecell from './singlecell.js'
import * as fimo from './fimo.js'
import { draw_partition } from './partitionmatrix.js'
import mdsgeneboxplot_closure from './mds.geneboxplot.js'
import { handle_mdssurvivalplot } from './km.js'

export * as phewas from './termdb.phewas.js'

export const tabixnoterror = s => {
	return s.startsWith('[E::idx_test_and_fetch]') // got this with htslib 1.15.1
}

// cache
// ??? ch_genemcount is not used anywhere ???
const ch_genemcount = {} // genome name - gene name - ds name - mutation class - count
const ch_dbtable = new Map() // k: db path, v: db stuff

export const features = serverconfig.features
const tabix = serverconfig.tabix
const samtools = serverconfig.samtools
const bcftools = serverconfig.bcftools
const bigwigsummary = serverconfig.bigwigsummary
const hicstraw = serverconfig.hicstraw

/*
    this hardcoded term is kept same with notAnnotatedLabel in block.tk.mdsjunction.render
    */
const infoFilter_unannotated = 'Unannotated'

//////////////////////////////
// Global variable (storing things in memory)
//
export let genomes // { hg19: {...}, ... }, legacy, should use closure

export function setRoutes(app, _genomes, serverconfig) {
	genomes = _genomes

	console.log('setting routes from app.unorg.js ...')
	const basepath = serverconfig.basepath || ''
	// has to set optional routes before app.get() or app.post()
	// otherwise next() may not be called for a middleware in the optional routes
	app.get(basepath + '/cardsjson', handle_cards)
	app.post(basepath + '/tkbedj', bedj_request_closure(genomes))
	app.post(basepath + '/tkbedgraphdot', bedgraphdot_request_closure(genomes))
	app.all(basepath + '/tkbam', bam_request_closure(genomes))
	app.get(basepath + '/gdcbam', gdc_bam_request(genomes))
	app.get(basepath + '/tkaicheck', aicheck_request_closure(genomes))
	app.get(basepath + '/blat', blat_request_closure(genomes))
	app.all(basepath + '/mds3', mds3_request_closure(genomes))
	app.get(basepath + '/tkbampile', bampile_request_closure(genomes))
	app.post(basepath + '/tkbigwig', bw_request_closure(genomes))
	app.post(basepath + '/tkld', handle_tkld(genomes))
	app.get(basepath + '/tabixheader', handle_tabixheader)
	app.post(basepath + '/svmr', handle_svmr)
	app.post(basepath + '/study', handle_study)
	app.post(basepath + '/textfile', handle_textfile)
	app.post(basepath + '/urltextfile', handle_urltextfile)
	app.get(basepath + '/junction', junction_request_closure(genomes)) // legacy, including rnapeg
	app.post(basepath + '/mdsjunction', mdsjunction_request_closure(genomes))
	app.post(basepath + '/mdssvcnv', handle_mdssvcnv)
	app.post(basepath + '/mdsgenecount', handle_mdsgenecount)
	app.post(basepath + '/mdsexpressionrank', handle_mdsexpressionrank) // expression rank as a browser track
	app.post(basepath + '/mdsgeneboxplot', mdsgeneboxplot_closure(genomes))
	app.post(basepath + '/mdsgenevalueonesample', handle_mdsgenevalueonesample)

	app.get(basepath + '/vcfheader', handle_vcfheader)
	app.get(basepath + '/bcfheader', handle_bcfheader)

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
	app.get(basepath + '/ideogram', handle_ideogram)
}

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

async function handle_cards(req, res) {
	try {
		if (req.query.datafile && req.query.tabixCoord) {
			const gn = genomes[req.query.genome]
			if (!gn) throw 'invalid genome'
			// todo
			const [e, file] = utils.fileurl({ query: { file: req.query.datafile } })
			if (e) throw e
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
	try {
		const gn = genomes[req.query.genome]
		if (!gn) throw 'invalid genome'

		if (req.query.rglst) {
			// only validate if present; not every query has rglst param
			utils.validateRglst(req.query, gn)
		}

		let ds, dsquery

		if (req.query.iscustom) {
			// is custom track
			if (req.query.file) {
				if (utils.illegalpath(req.query.file, false, false)) throw 'invalid svcnv file'
				await utils.file_is_readable(path.join(serverconfig.tpmasterdir, req.query.file))
			}

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
					throw 'no file or url for checkexpressionrank'
				if (req.query.checkexpressionrank.file) {
					if (utils.illegalpath(req.query.checkexpressionrank.file, false, false)) throw 'invalid expression file'
					await utils.file_is_readable(path.join(serverconfig.tpmasterdir, req.query.checkexpressionrank.file))
				}
				dsquery.checkexpressionrank = {
					file: req.query.checkexpressionrank.file,
					url: req.query.checkexpressionrank.url,
					indexURL: req.query.checkexpressionrank.indexURL
				}
			}

			if (req.query.checkvcf) {
				const vcf = JSON.parse(req.query.checkvcf)
				if (!vcf.file && !vcf.url) throw 'no file or url for custom VCF track'
				if (vcf.file) {
					if (utils.illegalpath(vcf.file, false, false)) throw 'invalid vcf file'
					await utils.file_is_readable(path.join(serverconfig.tpmasterdir, vcf.file))
				}
				vcf.type = common.mdsvcftype.vcf
				dsquery.checkvcf = {
					info: vcf.info,
					tracks: [vcf]
				}
			}

			if (req.query.checkrnabam) {
				if (!req.query.checkrnabam.samples) throw 'samples{} missing from checkrnabam'
				let n = 0
				for (const k in req.query.checkrnabam.samples) n++
				if (n > 13) throw 'no more than 13 BAM files allowed'
				const e = ase_testarg(req.query.checkrnabam)
				if (e) throw e
				dsquery.checkrnabam = req.query.checkrnabam
			}
		} else {
			// is native track

			if (!gn.datasets) throw 'genome is not equipped with datasets'
			ds = gn.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dslabel'

			//////////// exits that only requires ds but not dsquery
			if (req.query.getsample4disco) return mdssvcnv_exit_getsample4disco(req, res, gn, ds)
			if (req.query.gettrack4singlesample) return mdssvcnv_exit_gettrack4singlesample(req, res, ds)
			if (req.query.findsamplename) return mdssvcnv_exit_findsamplename(req, res, ds)
			if (req.query.assaymap) return mdssvcnv_exit_assaymap(req, res, ds)

			if (!ds.queries) throw 'dataset is not equipped with queries'
			dsquery = ds.queries[req.query.querykey]
			if (!dsquery) throw 'invalid querykey'
		}

		///////////////// exits that require dsquery (svcnv)
		if (req.query.getexpression4gene) return mdssvcnv_exit_getexpression4gene(req, res, gn, ds, dsquery)
		if (req.query.ifsamplehasvcf) return mdssvcnv_exit_ifsamplehasvcf(req, res, gn, ds, dsquery)

		if (dsquery.viewrangeupperlimit) {
			// hard limit from official dataset
			const len = req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0)
			if (len >= dsquery.viewrangeupperlimit) {
				throw 'zoom in under ' + common.bplen(dsquery.viewrangeupperlimit) + ' to view details'
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
				throw 'svcnv file index url error'
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
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
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
				// utils.validateRglst() was aleady called in the route handler that calls this function
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
	// utils.validateRglst() was aleady called in the route handler that calls this function
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

	// utils.validateRglst() was aleady called in the route handler that calls this function
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

			utils.validateRglst(req.query, gn)

			if (req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0) > 10000000)
				throw 'Zoom in below 10 Mb to show expression rank'

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
async function handle_bcfheader(req, res) {
	// get header for a single custom bcf track
	try {
		if (!req.query.genome) throw 'genome missing'
		const g = genomes[req.query.genome]
		if (!g) throw 'invalid genome'
		const [e, file, isurl] = utils.fileurl(req)
		if (e) throw e
		const dir = isurl ? await utils.cache_index(file, req.query.indexURL) : null
		res.send({
			header: await utils.get_header_bcf(file, dir),
			nochr: await utils.tabix_is_nochr(file, dir, g)
		})
	} catch (e) {
		if (e.stack) console.error(e.stack)
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
