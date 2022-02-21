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
		.computableValuesOnly:true // always added
	.refGrp
.independent[{}]
	.id
	.type
	.term{} // rehydrated
	.q{}
		.scale
		.computableValuesOnly:true // always added
	.refGrp
	.interactions[] // always added; empty if no interaction
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
		getSampleData_snplstOrLocus
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

		const sampledata = await getSampleData(q, [q.outcome, ...q.independent])
		/* each element is one sample with a key-val map for all its annotations:
		{sample, id2value:Map( tid => {key,value}) }
		*/

		// build the input for R script
		const Rinput = makeRinput(q, sampledata)
		/* details described in server/utils/regression.R
		Rinput {
			data: [{}] per-sample data values
			metadata: {
						type: regression type (linear/logistic)
						variables: [{}] variable metadata
					  }
		}
		*/

		const sampleSize = Rinput.data.length
		validateRinput(Rinput, sampleSize)
		const [id2originalId, originalId2id] = replaceTermId(Rinput)

		// run regression analysis in R
		const Routput = await lines2R(
			path.join(serverconfig.binpath, 'utils/regression.R'),
			[JSON.stringify(Rinput)],
			[],
			true
		)

		// parse the R output
		const result = await parseRoutput(Rinput, Routput, id2originalId)
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
	if (!q.outcome) throw `empty 'outcome' parameter`
	if (!('id' in q.outcome)) throw 'outcome.id missing'
	if (!q.outcome.q) throw 'outcome.q missing'
	q.outcome.q.computableValuesOnly = true // will prevent appending uncomputable values in CTE constructors
	// outcome is always a dictionary term
	q.outcome.term = ds.cohort.termdb.q.termjsonByOneid(q.outcome.id)
	if (!q.outcome.term) throw 'invalid outcome term: ' + q.outcome.id

	// independent
	if (!q.independent) throw 'independent[] missing'
	if (!Array.isArray(q.independent) || q.independent.length == 0) throw 'q.independent is not non-empty array'
	// tw = termWrapper
	for (const tw of q.independent) {
		if (!tw.q) throw `missing q for term.id='${tw.id}'`
		tw.q.computableValuesOnly = true // will prevent appending uncomputable values in CTE constructors
		if (tw.type == 'snplst' || tw.type == 'snplocus') {
			// !!!!!!!!!QUICK FIX!! detect non-dict term and do not query termdb
			// snplst tw lacks tw.term{}; tw.snpidlst[] will be added when parsing cache file
			if (!tw.q.cacheid) throw 'q.cacheid missing'
			if (tw.q.cacheid.match(/[^\w]/)) throw 'invalid cacheid'
			if (typeof tw.q.snp2effAle != 'object') throw 'q.snp2effAle{} is not object'
			if (!Number.isInteger(tw.q.alleleType)) throw 'q.alleleType is not integer'
			if (!Number.isInteger(tw.q.geneticModel)) throw 'q.geneticModel is not integer'
			if (!Number.isInteger(tw.q.missingGenotype)) throw 'q.missingGenotype is not integer'
			if (tw.q.geneticModel == 3) {
				if (typeof tw.q.snp2refGrp != 'object') throw 'q.snp2refGrp{} is not object when geneticMode=3'
			}
		} else {
			if (!tw.id) throw '.id missing for an independent term'
			tw.term = ds.cohort.termdb.q.termjsonByOneid(tw.id)
			if (!tw.term) throw `invalid independent term='${tw.id}'`
		}
	}
	// interaction of independent
	for (const i of q.independent) {
		if (!i.interactions) i.interactions = []
		for (const x of i.interactions) {
			// TODO allow tw.interactions[] array to contain snpid instead of snplst term id
			if (!q.independent.find(y => y.id == x)) throw 'interacting term id missing from independent[]: ' + x
		}
	}
}

function makeRinput(q, sampledata) {
	// prepare variable metadata
	const variables = []

	// outcome variable
	const outcome = {
		id: q.outcome.id,
		name: q.outcome.term.name,
		type: 'outcome',
		rtype: 'numeric' // always numeric because values are continuous for linear regression and values get converted to 0/1 for logistic regression
	}
	if (q.regressionType == 'logistic') {
		// need ref and nonref categories of outcome for labeling R plot
		outcome.categories = {
			ref: q.outcome.refGrp,
			nonref: q.outcome.q.lst.find(x => x.label != q.outcome.refGrp).label
		}
	}
	variables.push(outcome)

	// independent terms, tw = termWrapper
	for (const tw of q.independent) {
		if (tw.type == 'snplst' || tw.type == 'snplocus') {
			// create one independent variable for each snp
			for (const snpid of tw.snpidlst) {
				const thisSnp = {
					id: snpid,
					name: snpid,
					type: 'independent',
					interactions: []
				}
				if (tw.type == 'snplocus') thisSnp.type = 'snplocus'
				if (tw.q.geneticModel == 3) {
					// by genotype
					thisSnp.rtype = 'factor'
					// assign ref grp
					thisSnp.refGrp = tw.q.snp2refGrp[snpid]
				} else {
					// treat as numeric and do not assign refGrp
					thisSnp.rtype = 'numeric'
				}
				// find out any other variable that's interacting with either this snp or this snplst term
				// and fill into interactions array
				// for now, do not support interactions between snps in the same snplst term
				for (const tw2 of q.independent) {
					if (tw2.interactions.includes(tw.id)) {
						// another term (tw2) is interacting with this snplst term
						// in R input establish tw2's interaction with this snp
						thisSnp.interactions.push(tw2.id)
					}
				}
				variables.push(thisSnp)
			}
		} else {
			// this is a dictionary term
			const thisTerm = {
				id: tw.id,
				name: tw.term.name,
				type: tw.q.mode == 'spline' ? 'spline' : 'independent',
				rtype: tw.q.mode == 'continuous' || tw.q.mode == 'spline' ? 'numeric' : 'factor',
				interactions: []
			}
			// map tw.interactions into thisTerm.interactions
			for (const id of tw.interactions) {
				const tw2 = q.independent.find(i => i.id == id)
				if (tw2.type == 'snplst' || tw2.type == 'snplocus') {
					// this term is interacting with a snplst term, fill in all snps from this list into thisTerm.interactions
					for (const s of tw2.snpidlst) thisTerm.interactions.push(s)
				} else {
					// this term is interacting with another dictionary term
					thisTerm.interactions.push(id)
				}
			}
			if (thisTerm.rtype === 'factor') thisTerm.refGrp = tw.refGrp
			if (tw.q.mode == 'spline') {
				thisTerm.spline = {
					knots: tw.q.knots.map(x => Number(x.value)),
					plotfile: path.join(serverconfig.cachedir, Math.random().toString() + '.png')
				}
			}
			if (tw.q.scale) thisTerm.scale = tw.q.scale
			variables.push(thisTerm)
		}
	}

	// generate metadata object
	const metadata = {
		type: q.regressionType,
		variables
	}

	// prepare per-sample data values
	// for each sample, decide if it has value for all terms
	// if so, the sample can be included for analysis
	const data = []
	for (const { sample, id2value } of sampledata) {
		if (!id2value.has(q.outcome.id)) continue
		const out = id2value.get(q.outcome.id)

		let skipsample = false
		for (const tw of q.independent) {
			// tw = termWrapper
			if (tw.type == 'snplocus') {
				// snplocus terms need to be analyzed separately and
				// some samples may have values for one term, but not another
				// therefore samples will be filtered separately for each term
				// in R script
				continue
			}
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

		// this sample has values for all variables and is eligible for regression analysis
		const entry = {} // data of sample for each variable { variable1: value, variable2: value, variable3: value, ...}
		for (const t of variables) {
			if (t.type == 'outcome') {
				// outcome variable
				if (q.outcome.q.mode == 'continuous') {
					// continous outcome, use value
					entry[t.id] = out.value
				} else {
					// categorical/condition outcome, use key
					// convert ref and non-ref values to 0 and 1, respectively
					entry[t.id] = out.key === q.outcome.refGrp ? 0 : 1
				}
			} else {
				// independent variable
				const v = id2value.get(t.id)
				if (!v) {
					entry[t.id] = null
				} else {
					entry[t.id] = t.rtype === 'numeric' ? v.value : v.key
				}
			}
		}
		data.push(entry)
	}

	const Rinput = {
		data,
		metadata
	}

	return Rinput
}

function validateRinput(Rinput, sampleSize) {
	// validate R input
	// validation of data values will be done in R script

	// validate sample size
	if (sampleSize < minimumSample) throw 'too few samples to fit model'
	// validate data table
	const nvariables = Rinput.metadata.variables.length
	if (Rinput.data.find(entry => Object.keys(entry).length != nvariables))
		throw 'unequal number of variables in data entries'
	// validate independent variables
	for (const variable of Rinput.metadata.variables) {
		if (variable.type == 'outcome') continue
		if (variable.rtype == 'numeric') {
			if (variable.refGrp) throw `reference group given for '${variable.id}'`
		} else {
			if (!variable.refGrp) throw `reference group not given for '${variable.id}'`
		}
	}
}

async function parseRoutput(Rinput, Routput, id2originalId) {
	const result = { lst: [] } // lst[] has same structure as out[]
	// handle errors/warnings from R
	if (Routput.includes('R stderr:')) {
		const erridx = Routput.findIndex(x => x == 'R stderr:')
		result.err = [...new Set(Routput.splice(erridx).slice(1))]
	}

	// Routput is now a JSON of results
	if (Routput.length != 1) throw 'expected 1 json line in R output'
	const out = JSON.parse(Routput[0])

	/* out: [
	  {
		id: id of snplocus term (empty if no snplocus terms)
		data: { sampleSize, residuals: {}, coefficients: {}, type3: {}, other: {} },
	  },
	]
	*/

	for (const analysis of out) {
		const analysisResults = {
			data: { sampleSize: analysis.data.sampleSize }
		}
		if (analysis.id) analysisResults.id = id2originalId[analysis.id]

		const data = analysis.data

		// residuals
		analysisResults.data.residuals = data.residuals
		analysisResults.data.residuals.label = Rinput.metadata.type == 'linear' ? 'Residuals' : 'Deviance residuals'

		// coefficients
		if (data.coefficients.rows.length < 2)
			throw 'expect at least 2 rows in coefficients table but got ' + data.coefficients.rows.length
		analysisResults.data.coefficients = {
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
				analysisResults.data.coefficients.interactions.push(interaction)
			} else {
				// not interaction, individual variable
				const id = row.shift()
				const category = row.shift()
				// row is now only data fields
				const termid = id2originalId[id]
				if (!analysisResults.data.coefficients.terms[termid]) analysisResults.data.coefficients.terms[termid] = {}
				if (category) {
					// has category
					if (!analysisResults.data.coefficients.terms[termid].categories)
						analysisResults.data.coefficients.terms[termid].categories = {}
					analysisResults.data.coefficients.terms[termid].categories[category] = row
				} else {
					// no category
					analysisResults.data.coefficients.terms[termid].fields = row
				}
			}
		}
		analysisResults.data.coefficients.label = 'Coefficients'

		// type III statistics
		analysisResults.data.type3 = {
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
				analysisResults.data.type3.interactions.push(interaction)
			} else {
				// not interaction, individual variable
				const id = row.shift()
				// row is now only data fields
				const termid = id2originalId[id]
				if (!analysisResults.data.type3.terms[termid]) analysisResults.data.type3.terms[termid] = row
			}
		}
		analysisResults.data.type3.label = 'Type III statistics'

		// other summary statistics
		analysisResults.data.other = data.other
		analysisResults.data.other.label = 'Other summary statistics'

		// plots
		for (const tw of Rinput.metadata.variables) {
			if (tw.spline) {
				if (!analysisResults.data.splinePlots) analysisResults.data.splinePlots = []
				const file = tw.spline.plotfile
				const plot = await fs.promises.readFile(file)
				analysisResults.data.splinePlots.push({
					src: 'data:image/png;base64,' + new Buffer.from(plot).toString('base64'),
					size: imagesize(file)
				})
				fs.unlink(file, err => {
					if (err) throw err
				})
			}
		}
		result.lst.push(analysisResults)
	}
	return result
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
		if (tw.type == 'snplst' || tw.type == 'snplocus') {
			// each snp is one indepedent variable
			// record list of snps on term.snpidlst
			await getSampleData_snplstOrLocus(tw, samples, q)
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
		snp2effAle{}
		snp2refGrp{}
	snpidlst[]
		// list of snpid; tricky!! added in this function
samples {Map} // results are added into it
*/
async function getSampleData_snplstOrLocus(tw, samples, q) {
	tw.snpidlst = [] // snpid are added to this list while reading cache file

	const lines = (await utils.read_file(path.join(serverconfig.cachedir, tw.q.cacheid))).split('\n')
	// cols: snpid, chr, pos, ref, alt, eff, <s1>, <s2>,...

	// array of sample ids from the cache file; note cache file contains all the samples from the dataset
	// TODO export helper func to read header from termdb.snp.js
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
			// get effect allele from q, but not from cache file
			// column [5] is for user-assigned effect allele
			effAle: tw.q.snp2effAle[snpid],
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

	// imputation
	doImputation(snp2sample, tw, cachesampleheader, sampleinfilter)

	for (const [snpid, o] of snp2sample) {
		for (const [sampleid, gt] of o.samples) {
			// for this sample, convert gt to value
			const [gtA1, gtA2] = gt.split('/') // assuming diploid
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
					o.samples.set(sampleid, notEffAle + '/' + notEffAle)
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

function divideTerms(lst) {
	// quick fix to divide list of term to two lists
	// TODO ways to generalize; may use `shared/usecase2termtypes.js` with "regression":{nonDictTypes:['snplst','prs']}
	// shared between server and client
	const dict = [],
		nonDict = []
	for (const t of lst) {
		if (t.type == 'snplst' || t.type == 'snplocus') {
			nonDict.push(t)
		} else {
			dict.push(t)
		}
	}
	return [dict, nonDict]
}

function replaceTermId(Rinput) {
	// replace term IDs with custom IDs (to avoid spaces/commas in R)
	// make conversion table between IDs
	const id2originalId = {} // k: new id, v: original term id
	const originalId2id = {} // k: original term id, v: new id
	for (const [i, t] of Rinput.metadata.variables.entries()) {
		id2originalId['id' + i] = t.id
		originalId2id[t.id] = 'id' + i
	}

	// replace IDs of terms and interacting terms in metadata
	for (const t of Rinput.metadata.variables) {
		t.id = originalId2id[t.id]
		if (t.interactions && t.interactions.length > 0) {
			for (const [i, it] of t.interactions.entries()) {
				t.interactions[i] = originalId2id[it]
			}
		}
	}

	// replace IDs of terms in data
	for (const entry of Rinput.data) {
		for (const tid in entry) {
			entry[originalId2id[tid]] = entry[tid]
			delete entry[tid]
		}
	}

	return [id2originalId, originalId2id]
}
