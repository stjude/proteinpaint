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
import { sql } from './sql.ts'
import fs from 'fs'
import path from 'path'
import { stratify as d3stratify } from 'd3-hierarchy'
import * as utils from './utils.js'
import { stratinput } from '#shared/tree.js'
import * as common from '#shared/common.js'
import * as vcf from '#shared/vcf.js'
import handle_study from './handle_study.js'
import * as termdb from './termdb.js'
import bw_request_closure from './bw.js'
import { handle_tkld } from './ld.js'
import * as termdbbarsql from './termdb.barchart.js'
import bam_request_closure from './bam.js'
import { mdsjunction_request_closure } from './mds.junction.js'
import { gdc_bam_request } from './bam.gdc.js'
import aicheck_request_closure from './aicheck.js'
import bampile_request_closure from './bampile.js'
import bedj_request_closure from './bedj.js'
import { mds3_request_closure } from './mds3.load.js'
import * as singlecell from './singlecell.js'
import mdsgeneboxplot_closure from './mds.geneboxplot.js'
import { handle_mdssurvivalplot } from './km.js'
import { protectedRoutes } from './auth/protectedRoutes.ts'

export const tabixnoterror = s => {
	return s.startsWith('[E::idx_test_and_fetch]') // got this with htslib 1.15.1
}

// cache
// ??? ch_genemcount is not used anywhere ???
const ch_genemcount = {} // genome name - gene name - ds name - mutation class - count
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
	app.post(basepath + '/tkbedj', bedj_request_closure(genomes))
	app.all(basepath + '/tkbam', bam_request_closure(genomes))
	app.get(basepath + '/gdcbam', gdc_bam_request(genomes))
	app.get(basepath + '/tkaicheck', aicheck_request_closure(genomes))
	app.all(basepath + '/mds3', mds3_request_closure(genomes))
	app.get(basepath + '/tkbampile', bampile_request_closure(genomes))
	app.post(basepath + '/tkbigwig', bw_request_closure(genomes))
	app.post(basepath + '/tkld', handle_tkld(genomes))
	app.get(basepath + '/tabixheader', handle_tabixheader)
	app.post(basepath + '/svmr', handle_svmr)
	app.post(basepath + '/study', handle_study)
	app.post(basepath + '/textfile', handle_textfile)

	app.get(basepath + '/vcfheader', handle_vcfheader)
	app.get(basepath + '/bcfheader', handle_bcfheader)

	app.post(basepath + '/translategm', handle_translategm)

	// the legacy /termdb route handler calls authApi.canDisplaySampleIds() for the q.for sample data requests
	app.all(basepath + '/termdb', protectedRoutes.samples, termdb.handle_request_closure(genomes))
	app.all(basepath + '/termdb/barsql', protectedRoutes.minSampleSize, termdbbarsql.handle_request_closure(genomes))
	app.post(basepath + '/singlecell', singlecell.handle_singlecell_closure(genomes))
	app.get(basepath + '/ideogram', handle_ideogram)

	/* rest of routes are for deprecated mds
	conditionally mount them, to avoid having to migrate them to routes/ and to keep single-ds environments lean
	delete these when mds is phased out
	note: when not mounted, custom file-based (iscustom) mdsjunction/mdssvcnv/mdsexpressionrank tracks will also not work
	*/
	const genomeLst = Object.values(genomes)
	if (genomeLst.some(g => Object.values(g.datasets || {}).some(ds => ds.isMds))) {
		app.post(basepath + '/mdsjunction', mdsjunction_request_closure(genomes))
		app.post(basepath + '/mdsgenecount', handle_mdsgenecount)
		app.post(basepath + '/mdsgeneboxplot', mdsgeneboxplot_closure(genomes))
		app.get(basepath + '/mdssamplescatterplot', handle_mdssamplescatterplot)
		app.post(basepath + '/mdssamplesignature', handle_mdssamplesignature)
		app.post(basepath + '/mdssurvivalplot', handle_mdssurvivalplot(genomes))
	} else {
		console.log('!! Skipped setting up route: legacy mds routes')
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

function handle_svmr(req, res) {
	if (req.query.file) {
		const [e, file, isurl] = utils.fileurl(req)
		// only a file under tp is read
		const tp = path.resolve(serverconfig.tpmasterdir)
		const resolved = e || isurl ? '' : path.resolve(file)
		if (!resolved.startsWith(tp + path.sep)) {
			res.send({ error: 'illegal file name' })
			return
		}
		fs.readFile(resolved, 'utf8', (err, data) => {
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

async function handle_textfile(req, res) {
	// load a server hosted text file
	try {
		if (!req.query.file) throw 'query.file missing'
		const [e, file] = utils.fileurl(req, true) // /textfile request is dangerous. must apply
		if (e) throw e
		if (req.query.from) throw 'from/to is no longer supported'
		res.send({ text: await utils.read_file(file) })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
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
		// column names cannot be bound as sql parameters, so only allow actual genecount columns
		const columns = new Set(
			ds.gene2mutcount.db
				.prepare('SELECT name FROM pragma_table_info(?)')
				.all('genecount')
				.map(r => r.name)
		)
		const mutTypes = req.query.selectedMutTypes || ['total']
		if (!Array.isArray(mutTypes) || !mutTypes.length) throw 'invalid selectedMutTypes'
		for (const t of mutTypes) {
			if (t == 'gene' || t == 'sample' || !columns.has(t)) throw `invalid mutation type='${t}'`
		}
		const n_gene = req.query.nGenes ? Number(req.query.nGenes) : 15
		if (!Number.isInteger(n_gene) || n_gene < 1) throw 'invalid nGenes'
		const samples = Array.isArray(req.query.samples) ? req.query.samples : String(req.query.samples).split(',')
		const query = sql`WITH
	filtered AS (
		SELECT gene, ${sql.join(
			mutTypes.map(t => sql.id(t)),
			sql`+`
		)} AS total FROM genecount
		WHERE sample IN (${sql.list(samples.map(String))})
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
