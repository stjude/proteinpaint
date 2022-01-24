const path = require('path')
const { get_term_cte } = require('./termdb.sql')
const { getFilterCTEs } = require('./termdb.filter')
const lines2R = require('./lines2R')
const fs = require('fs')
const imagesize = require('image-size')
const serverconfig = require('./serverconfig')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')

/*
q {}
.regressionType
.filter
.outcome{}
	.id
	.type // type will be required later to support molecular datatypes
	.term{} // rehydrated
	.q{}
	.refGrp
.independent[{}]
	.id
	.type
	.q{}
		.scale
	.refGrp
	.interactions[]
	.snpidlst[] // list of snp ids, for type=snplst, added when parsing cache file

input to R is an json object {type, outcome:{rtype}, independent:[ {rtype} ]}
rtype with values numeric/factor is used instead of actual term type
so that R script will not need to interpret term type

***  function cascade  ***
get_regression()
	parse_q
	getSampleData
		divideTerms
		getSampleData_dictionaryTerms
		getSampleData_snplst
			get_effAle4snp
			doImputation
			applyGeneticModel
	makeRinput
	validateRinput
	replaceTermId
	... run R ...
	parseRoutput
*/

// minimum number of samples to run analysis
const minimumSample = 1

export async function get_regression(q, ds) {
	try {
		parse_q(q, ds)

		const startTime = +new Date()
		const sampledata = await getSampleData(q, [q.outcome, ...q.independent])
		/* each element is one sample with a key-val map for all its annotations:
		{sample, id2value:Map( tid => {key,value}) }
		*/
		const queryTime = +new Date() - startTime

		// build the input for R script
		const Rinput = makeRinput(q, sampledata)

		const sampleSize = Rinput.outcome.values.length
		validateRinput(q, Rinput, sampleSize)
		const [id2originalId, originalId2id] = replaceTermId(Rinput)

		// run regression analysis in R
		const Routput = await lines2R(
			path.join(serverconfig.binpath, 'utils/regression.R'),
			[JSON.stringify(Rinput)],
			[],
			true
		)

		// parse the R output
		const result = { queryTime, sampleSize }
		await parseRoutput(Rinput, Routput, id2originalId, result)
		result.totalTime = +new Date() - startTime
		return result
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function parse_q(q, ds) {
	if (!ds.cohort) throw 'cohort missing from ds'
	q.ds = ds

	// client to always specify regressionType
	if (!q.regressionType) throw 'regressionType missing'
	if (!['linear', 'logistic'].includes(q.regressionType)) throw 'unknown regressionType'

	// outcome
	if (!q.outcome) throw `missing 'outcome' parameter`
	q.outcome = JSON.parse(decodeURIComponent(q.outcome))
	if (!q.outcome) throw `empty 'outcome' parameter`
	if (!('id' in q.outcome)) throw 'outcome.id missing'
	if (!q.outcome.q) throw 'outcome.q missing'
	q.outcome.q.computableValuesOnly = true // will prevent appending uncomputable values in CTE constructors
	// outcome is always a dictionary term
	q.outcome.term = ds.cohort.termdb.q.termjsonByOneid(q.outcome.id)
	if (!q.outcome.term) throw 'invalid outcome term: ' + q.outcome.id

	// independent
	if (!q.independent) throw 'independent[] missing'
	q.independent = JSON.parse(decodeURIComponent(q.independent))
	if (!Array.isArray(q.independent) || q.independent.length == 0) throw 'q.independent is not non-empty array'
	// tw = termWrapper
	for (const tw of q.independent) {
		if (tw.type == 'snplst') {
			// !!!!!!!!!QUICK FIX!! detect non-dict term and do not query termdb
			// snplst tw lacks tw.term{}; tw.snpidlst[] will be added when parsing cache file
		} else {
			if (!tw.id) throw '.id missing for an independent term'
			tw.term = ds.cohort.termdb.q.termjsonByOneid(tw.id)
			if (!tw.term) throw `invalid independent term='${tw.id}'`
		}
		if (!tw.q) throw `missing q for term.id='${tw.id}'`
		tw.q.computableValuesOnly = true // will prevent appending uncomputable values in CTE constructors
	}
	// interaction of independent
	for (const i of q.independent) {
		if (!i.interactions) i.interactions = []
		for (const x of i.interactions) {
			if (!q.independent.find(y => y.id == x)) throw 'interacting term id missing from independent[]: ' + x
		}
	}
}

function makeRinput(q, sampledata) {
	// outcome term
	// for linear regression, 'values' will be sample values
	// for logisitc regression, 'values' will be 0/1 (0 = ref; 1 = non-ref)
	// therefore, 'rtype' will always be 'numeric'
	const outcome = {
		id: q.outcome.id,
		name: q.outcome.term.name,
		rtype: 'numeric',
		values: []
	}
	// specify ref and non-ref categories for plot labeling purposes in R
	if (q.regressionType == 'logistic') outcome.categories = { ref: q.outcome.refGrp }

	// input for R script will be in json format
	const Rinput = {
		type: q.regressionType,
		outcome,
		independent: []
	}

	// independent terms, tw = termWrapper
	for (const tw of q.independent) {
		if (tw.type == 'snplst') {
			// create one independent variable for each snp
			for (const snpid of tw.snpidlst) {
				const independent = {
					id: snpid,
					name: snpid,
					rtype: tw.q.geneticModel == 3 /*bygenotype*/ ? 'factor' : 'numeric',
					values: [], // to collect sample values
					interactions: []
				}
				Rinput.independent.push(independent)
			}
		} else {
			const independent = {
				id: tw.id,
				name: tw.term.name,
				rtype: tw.q.mode == 'continuous' || tw.q.mode == 'spline' ? 'numeric' : 'factor',
				values: [], // to collect raw sample values
				interactions: tw.interactions
			}
			if (independent.rtype === 'factor') independent.refGrp = tw.refGrp
			if (tw.q.mode == 'spline') {
				independent.spline = {
					knots: tw.q.knots.map(x => Number(x.value)),
					plotfile: path.join(serverconfig.cachedir, Math.random().toString() + '.png')
				}
			}
			if (tw.q.scale) independent.scale = tw.q.scale
			Rinput.independent.push(independent)
		}
	}

	// for each sample, decide if it has value for all terms
	// if so, the sample can be included for analysis
	// and will fill in values into values[] of all terms, thus ensuring the order of samples are the same across values[] of all terms
	for (const { sample, id2value } of sampledata) {
		if (!id2value.has(q.outcome.id)) continue
		const out = id2value.get(q.outcome.id)

		let skipsample = false
		for (const tw of q.independent) {
			// tw = termWrapper
			if (tw.type == 'snplst') {
				for (const snpid of tw.snpidlst) {
					if (!id2value.get(snpid)) {
						skipsample = true
						break
					}
				}
			} else {
				const independent = id2value.get(tw.id)
				if (!independent) {
					skipsample = true
					break
				}
			}
		}
		if (skipsample) continue

		// this sample has values for all terms and is eligible for regression analysis
		// add its values to values[] of each term
		// for categorical/condition outcome term, convert ref and non-ref values to 0 and 1, respectively
		if (q.outcome.q.mode == 'continuous') {
			Rinput.outcome.values.push(out.value)
		} else if (out.key === q.outcome.refGrp) {
			Rinput.outcome.values.push(0)
		} else {
			Rinput.outcome.values.push(1)
			if (!('nonref' in Rinput.outcome.categories)) Rinput.outcome.categories.nonref = out.key
		}
		for (const t of Rinput.independent) {
			const v = id2value.get(t.id)
			t.values.push(t.rtype === 'numeric' ? v.value : v.key)
		}
	}
	return Rinput
}

function validateRinput(q, Rinput, sampleSize) {
	// validate R input
	// validate sample size
	if (sampleSize < minimumSample) throw 'too few samples to fit model'
	if (Rinput.independent.find(x => x.values.length !== sampleSize)) throw 'variables have unequal sample sizes'
	// validate outcome variable
	if (q.regressionType == 'logistic') {
		const values = new Set(Rinput.outcome.values) // get unique values
		if (values.size !== 2) throw 'outcome is not binary'
		if (!(values.has(0) && values.has(1))) throw 'outcome values are not 0/1'
	}
	// validate independent variables
	for (const variable of Rinput.independent) {
		if (variable.rtype === 'numeric') {
			if (variable.refGrp) throw `reference group given for '${variable.id}'`
		} else {
			if (!variable.refGrp) throw `reference group not given for '${variable.id}'`
			const values = new Set(variable.values) // get unique values
			if (!values.has(variable.refGrp)) throw `reference group not found in '${variable.id}' values`
			// make sure there's at least 2 categories
			if (values.size < 2) throw `'${variable.id}' has fewer than 2 categories`
		}
	}
}

async function parseRoutput(Rinput, Routput, id2originalId, result) {
	// handle errors/warnings from R
	if (Routput.includes('R stderr:')) {
		const erridx = Routput.findIndex(x => x == 'R stderr:')
		result.err = [...new Set(Routput.splice(erridx).slice(1))]
	}

	// Routput is now only a JSON of results
	if (Routput.length !== 1) throw 'expected 1 json line in R output'
	const data = JSON.parse(Routput[0])

	// residuals
	result.residuals = data.residuals
	result.residuals.label = Rinput.type == 'linear' ? 'Residuals' : 'Deviance residuals'

	// coefficients
	if (data.coefficients.rows.length < 2)
		throw 'expect at least 2 rows in coefficients table but got ' + data.coefficients.rows.length
	result.coefficients = {
		header: data.coefficients.header,
		intercept: data.coefficients.rows.shift(),
		terms: {}, // individual independent terms, not interaction
		interactions: [] // interactions
	}
	for (const row of data.coefficients.rows) {
		if (row[0].indexOf(':') != -1) {
			// is an interaction
			const interaction = {}
			const [id1, id2] = row.shift().split(':')
			const [cat1, cat2] = row.shift().split(':')
			// row is now only data fields
			interaction.term1 = id2originalId[id1]
			interaction.category1 = cat1
			interaction.term2 = id2originalId[id2]
			interaction.category2 = cat2
			interaction.lst = row
			result.coefficients.interactions.push(interaction)
		} else {
			// not interaction, individual variable
			const id = row.shift()
			const category = row.shift()
			// row is now only data fields
			const termid = id2originalId[id]
			if (!result.coefficients.terms[termid]) result.coefficients.terms[termid] = {}
			if (category) {
				// has category
				if (!result.coefficients.terms[termid].categories) result.coefficients.terms[termid].categories = {}
				result.coefficients.terms[termid].categories[category] = row
			} else {
				// no category
				result.coefficients.terms[termid].fields = row
			}
		}
	}
	result.coefficients.label = 'Coefficients'

	// type III statistics
	result.type3 = {
		header: data.type3.header,
		intercept: data.type3.rows.shift(),
		terms: {}, // individual independent terms, not interaction
		interactions: [] // interactions
	}
	for (const row of data.type3.rows) {
		if (row[0].indexOf(':') != -1) {
			// is an interaction
			const interaction = {}
			const [id1, id2] = row.shift().split(':')
			// row is now only data fields
			interaction.term1 = id2originalId[id1]
			interaction.term2 = id2originalId[id2]
			interaction.lst = row
			result.type3.interactions.push(interaction)
		} else {
			// not interaction, individual variable
			const id = row.shift()
			// row is now only data fields
			const termid = id2originalId[id]
			if (!result.type3.terms[termid]) result.type3.terms[termid] = row
		}
	}
	result.type3.label = 'Type III statistics'

	// other summary statistics
	result.other = data.other
	result.other.label = 'Other summary statistics'

	// plots
	for (const tw of Rinput.independent) {
		if (tw.spline) {
			if (!result.splinePlots) result.splinePlots = []
			const file = tw.spline.plotfile
			const plot = await fs.promises.readFile(file)
			result.splinePlots.push({
				src: 'data:image/png;base64,' + new Buffer.from(plot).toString('base64'),
				size: imagesize(file)
			})
			fs.unlink(file, err => {
				if (err) throw err
			})
		}
	}
}

/*
may move to termdb.sql.js later

works for only termdb terms; non-termdb attributes will not work
gets data for regression analysis, one row for each sample

Arguments
q{}
	.filter
	.ds

terms[]
	array of {id, term, q}

Returns two data structures
1.
	[
		{
	  	sample: STRING,

			// one or more entries by term id
			id2value: Map[
				term.id,
				{
					// depending on term type and desired 
					key: either (a) bin or groupsetting label, or (b) precomputed or annotated value if no bin/groupset is used, 
					value: precomputed or annotated value
				}
			]
		},
		...
	]
2.
*/
async function getSampleData(q, terms) {
	// dictionary and non-dictionary terms require different methods for data query
	const [dictTerms, nonDictTerms] = divideTerms(terms)

	const samples = getSampleData_dictionaryTerms(q, dictTerms)
	// sample data from all terms are loaded into "samples"

	for (const tw of nonDictTerms) {
		// for each non dictionary term type
		// query sample data with its own method and append results to "samples"
		if (tw.type == 'snplst') {
			// each snp is one indepedent variable
			// record list of snps on term.snpidlst
			await getSampleData_snplst(tw, samples, q)
		} else {
			throw 'unknown type of independent non-dictionary term'
		}
	}

	return samples.values()
}

function getSampleData_dictionaryTerms(q, terms) {
	// outcome can only be dictionary term so terms array must have at least 1 term
	const samples = new Map()
	// k: sample name, v: {sample, id2value:Map( tid => {key,value}) }

	const filter = getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []
	const CTEs = terms.map((t, i) => get_term_cte(q, values, i, filter, t))
	values.push(...terms.map(d => d.id))

	const sql = `WITH
		${filter ? filter.filters + ',' : ''}
		${CTEs.map(t => t.sql).join(',\n')}
		${CTEs.map(
			t => `
			SELECT sample, key, value, ? as term_id
			FROM ${t.tablename}
			${filter ? `WHERE sample IN ${filter.CTEname}` : ''}
			`
		).join(`UNION ALL`)}`

	const rows = q.ds.cohort.db.connection.prepare(sql).all(values)

	for (const { sample, term_id, key, value } of rows) {
		if (!samples.has(sample)) {
			samples.set(sample, { sample, id2value: new Map() })
		}

		if (samples.get(sample).id2value.has(term_id)) {
			// can duplication happen?
			throw `duplicate '${term_id}' entry for sample='${sample}'`
		}
		samples.get(sample).id2value.set(term_id, { key, value })
	}
	return samples
}

/*
tw{}
	type
	q{}
		cacheid
		alleleType: 0/1
		geneticModel: 0/1/2/3
		missingGenotype: 0/1/2
	snpidlst[]
		// list of snpid; tricky!! added in this function
samples {Map} // results are added into it
*/
async function getSampleData_snplst(tw, samples, q) {
	if (!tw.q.cacheid) throw 'q.cacheid missing'
	if (tw.q.cacheid.match(/[^\w]/)) throw 'invalid cacheid'

	tw.snpidlst = [] // snpid are added to this list while reading cache file

	const lines = (await utils.read_file(path.join(serverconfig.cachedir, tw.q.cacheid))).split('\n')
	// cols: snpid, chr, pos, ref, alt, eff, <s1>, <s2>,...

	// array of sample ids from the cache file; note cache file contains all the samples from the dataset
	const cachesampleheader = lines[0]
		.split('\t')
		.slice(6) // from 7th column
		.map(Number) // sample ids are integer

	// apply optional filter to filter down samples in cache file
	let fsample
	if (q.filter) {
		fsample = termdbsql.get_samples(q.filter, q.ds)
		if (fsample.length == 0) throw 'no samples from filter'
	}
	const sampleinfilter = [] // list of true/false, same length of cachesampleheader, to tell if a sample is in use
	for (const i of cachesampleheader) {
		if (fsample) {
			sampleinfilter.push(fsample.includes(i))
		} else {
			sampleinfilter.push(true)
		}
	}

	const snp2sample = new Map()
	// k: snpid
	// v: { effAle, refAle, altAles, samples: map { k: sample id, v: gt } }

	// load cache file to snp2sample
	for (let i = 1; i < lines.length; i++) {
		const l = lines[i].split('\t')

		const snpid = l[0] // snpid is used as "term id"
		tw.snpidlst.push(snpid)

		snp2sample.set(snpid, {
			effAle: l[5],
			refAle: l[3],
			altAles: l[4].split(','),
			samples: new Map()
		})
		for (const [j, sampleid] of cachesampleheader.entries()) {
			if (!sampleinfilter[j]) {
				// this sample is filtered out
				continue
			}
			const gt = l[j + 6]
			if (gt) {
				snp2sample.get(snpid).samples.set(sampleid, gt)
			}
		}
	}

	// define effect allele for each snp
	for (const [snpid, o] of snp2sample) {
		// okay to overwrite, identical value if is user-provided
		o.effAle = get_effAle4snp(o, tw) // okay to override
	}

	// imputation
	doImputation(snp2sample, tw, cachesampleheader, sampleinfilter)

	for (const [snpid, o] of snp2sample) {
		for (const [sampleid, gt] of o.samples) {
			// for this sample, convert gt to value
			const [gtA1, gtA2] = gt.split(',') // assuming diploid
			const v = applyGeneticModel(tw, o.effAle, gtA1, gtA2)

			// register value of this sample in samples
			if (!samples.has(sampleid)) {
				samples.set(sampleid, { sample: sampleid, id2value: new Map() })
			}
			samples.get(sampleid).id2value.set(snpid, { key: v, value: v }) // difference between key/value?
		}
	}
}

function doImputation(snp2sample, tw, cachesampleheader, sampleinfilter) {
	if (tw.q.missingGenotype == 0) {
		// as homozygous major/ref allele, which is not effect allele
		for (const o of snp2sample.values()) {
			// { effAle, refAle, altAles, samples }
			// find an allele from this snp that is not effect allele
			let notEffAle
			if (o.refAle != o.effAle) {
				notEffAle = o.refAle
			} else {
				for (const a of o.altAles) {
					if (a != o.effAle) {
						notEffAle = a
						break
					}
				}
			}
			if (!notEffAle) throw 'not finding a non-effect allele' // not possible
			for (const [i, sampleid] of cachesampleheader.entries()) {
				if (!sampleinfilter[i]) continue
				if (!o.samples.has(sampleid)) {
					// this sample is missing gt call for this snp
					o.samples.set(sampleid, notEffAle + ',' + notEffAle)
				}
			}
		}
		return
	}
	if (tw.q.missingGenotype == 1) {
		// numerically as average value
		throw 'not done'
	}
	if (tw.q.missingGenotype == 2) {
		// drop sample
		const incompleteSamples = new Set() // any samples with missing gt
		for (const { samples } of snp2sample.values()) {
			for (const [i, sampleid] of cachesampleheader.entries()) {
				if (!sampleinfilter[i]) continue
				if (!samples.has(sampleid)) {
					// this sample is missing gt
					incompleteSamples.add(sampleid)
				}
			}
		}
		// delete incomplete samples from all snps
		for (const { samples } of snp2sample.values()) {
			for (const s of incompleteSamples) {
				samples.delete(s)
			}
		}
		return
	}
	throw 'invalid missingGenotype value'
}

function applyGeneticModel(tw, effAle, a1, a2) {
	switch (tw.q.geneticModel) {
		case 0:
			// additive
			return (a1 == effAle ? 1 : 0) + (a2 == effAle ? 1 : 0)
		case 1:
			// dominant
			if (a1 == effAle || a2 == effAle) return 1
			return 0
		case 2:
			// recessive
			return a1 == effAle && a2 == effAle ? 1 : 0
		case 3:
			// by genotype
			return a1 + '/' + a2
		default:
			throw 'unknown geneticModel option'
	}
}

function get_effAle4snp(snp, tw) {
	// get effect allele for a snp
	// snp: { effAle, alleles, samples: map { k: sample id, v: gt } }
	if (snp.effAle) return snp.effAle // use user supplied allele
	// compute based on q.alleleType choice
	if (tw.q.alleleType == 0) {
		// major/minor
		const ale2count = new Map() // k: allele from gt, v: number of times it shows up in snp.samples
		for (const gt of snp.samples.values()) {
			for (const a of gt.split(',')) {
				ale2count.set(a, 1 + (ale2count.get(a) || 0))
			}
		}
		const lst = [...ale2count].sort((a, b) => a[1] - b[1]) // sort to ascending
		return lst[0][0] // lst[0] is the allele with smallest number of appearances
	}
	if (tw.q.alleleType == 1) {
		// ref/alt
		return snp.alleles[0]
	}
	throw 'unknown alleleType value'
}

function divideTerms(lst) {
	// quick fix to divide list of term to two lists
	// TODO ways to generalize; may use `shared/usecase2termtypes.js` with "regression":{nonDictTypes:['snplst','prs']}
	// shared between server and client
	const dict = [],
		nonDict = []
	for (const t of lst) {
		if (t.type == 'snplst' || t.type == 'prs') {
			nonDict.push(t)
		} else {
			dict.push(t)
		}
	}
	return [dict, nonDict]
}

function replaceTermId(Rinput) {
	// replace term IDs with custom IDs (to avoid spaces/commas in R)
	Rinput.outcome.id = 'outcome'
	// make conversion table between IDs
	const id2originalId = {} // k: new id, v: original term id
	const originalId2id = {} // k: original term id, v: new id
	for (const [i, t] of Rinput.independent.entries()) {
		id2originalId['id' + i] = t.id
		originalId2id[t.id] = 'id' + i
	}
	// replace IDs of terms and interacting terms
	for (const [i, t] of Rinput.independent.entries()) {
		Rinput.independent[i].id = originalId2id[t.id]
		for (const [j, k] of Rinput.independent[i].interactions.entries()) {
			Rinput.independent[i].interactions[j] = originalId2id[k]
		}
	}
	return [id2originalId, originalId2id]
}
