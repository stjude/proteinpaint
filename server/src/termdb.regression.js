import path from 'path'
import fs from 'fs'
import imagesize from 'image-size'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import serverconfig from './serverconfig.js'
import { boxplot_getvalue } from './utils.js'
import { runCumincR } from './termdb.cuminc.js'
import { isDictionaryType } from '#shared/terms.js'
import { getData } from './termdb.matrix.js'

/*

**************** q{} object

the q object comes from client request, in this form:
the object is used through out the script, and can be modified at various steps
q {}
.regressionType
.filter
.outcome{}
	.id
	.type // type will be required later to support molecular datatypes
	.term{} // rehydrated
	.q{}
		.scale
		.computableValuesOnly:true // always added
	.refGrp
.independent[{}]
	.id
	.type
	.term{} // rehydrated
	.q{}
		.scale
		.computableValuesOnly:true // always added
		.restrictAncestry{}
	.refGrp
	.interactions[] // always added; empty if no interaction


**************** R input

input to R is an json object, with an array of variables (first being outcome)
rtype with values numeric/factor is used instead of actual term type
so that R script will not need to interpret term type
described in server/utils/regression.R


**************** EXPORT

get_regression()


**************** function cascade 

parse_q()
	checkTwAncestryRestriction()
		// adds tw.q.restrictAncestry.pcs Map
getSampleData
	// returns sampledata[]
	mayProcessSampleByCoxOutcome
	mayAddAncestryPCs
		// creates ad-hoc independent variables for pcs
makeRinput()
	makeRvariable_snps()
	makeRvariable_dictionaryTerm()
validateRinput
replaceTermId
runRegression
	parseRoutput
snplocusPostprocess
	addResult4monomorphic
		getLine4OneSnp
	lowAFsnps_wilcoxon
	lowAFsnps_fisher
	lowAFsnps_cuminc
*/

// list of supported types
const regressionTypes = ['linear', 'logistic', 'cox']
// minimum number of samples to run analysis
const minimumSample = 1

let stime, etime
const benchmark = { NodeJS: {}, 'regression.R': {} }

export async function get_regression(q, ds) {
	try {
		parse_q(q, ds)

		stime = new Date().getTime()
		const sampledata = await getSampleData(q, ds)
		/* each element is one sample with a key-val map for all its annotations:
		{sample, id2value:Map( tid => {key,value}) }
		*/
		etime = new Date().getTime()
		benchmark['NodeJS']['getSampleData'] = (etime - stime) / 1000 + ' sec'

		stime = new Date().getTime()
		// build the input for R script
		const Rinput = makeRinput(q, sampledata)
		etime = new Date().getTime()
		benchmark['NodeJS']['makeRinput'] = (etime - stime) / 1000 + ' sec'

		validateRinput(Rinput)
		const [id2originalId, originalId2id] = replaceTermId(Rinput)

		const result = { resultLst: [] }

		/*
		when snplocus is used:
			common snps are analyzed in runRegression for model-fitting 
			rare ones are analyzed in snplocusPostprocess for fisher/wilcoxon/cuminc
			each function below returns a promise and runs in parallel
		else:
			runRegression fits model just one time
			snplocusPostprocess will not run
		*/
		await Promise.all([
			runRegression(Rinput, id2originalId, q, result),
			snplocusPostprocess(q, sampledata, Rinput, result)
		])

		//console.log('benchmark:', benchmark)

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
	if (!regressionTypes.includes(q.regressionType)) throw 'unknown regressionType'

	// outcome
	if (!q.outcome) throw `missing 'outcome' parameter`
	if (!('id' in q.outcome)) throw 'outcome.id missing'
	if (!q.outcome.q) throw 'outcome.q missing'
	// outcome is always a dictionary term
	// set this flag to prevent appending uncomputable values in CTE constructors
	q.outcome.q.computableValuesOnly = true
	q.outcome.term = ds.cohort.termdb.q.termjsonByOneid(q.outcome.id)
	if (!q.outcome.term) throw 'invalid outcome term: ' + q.outcome.id
	// no longer need outcome.id now that outcome.term is rehydrated
	delete q.outcome.id

	// independent
	if (!q.independent) throw 'independent[] missing'
	if (!Array.isArray(q.independent) || q.independent.length == 0) throw 'q.independent is not non-empty array'
	// tw: term wrapper
	for (const tw of q.independent) {
		if (!tw.q) throw `missing q for independent term '${tw.id}'`

		checkTwAncestryRestriction(tw, q, ds)

		if (isDictionaryType(tw.type)) {
			// dictionary term
			tw.q.computableValuesOnly = true // will prevent appending uncomputable values in CTE constructors
			if (tw.type != 'samplelst') {
				if (!tw.id) throw 'tw.id missing'
				tw.term = ds.cohort.termdb.q.termjsonByOneid(tw.id)
				if (!tw.term) throw `invalid independent term='${tw.id}'`
				// no longer need tw.id now that tw.term is rehydrated
				delete tw.id
			}
		} else {
			// non-dictionary term
			if (tw.type == 'snplst' || tw.type == 'snplocus') {
				if (!tw.q.cacheid) throw 'q.cacheid missing'
				if (serverconfig.cache_snpgt.fileNameRegexp.test(tw.q.cacheid)) throw 'invalid cacheid'
				if (typeof tw.q.snp2effAle != 'object') throw 'q.snp2effAle{} is not object'
				if (!Number.isInteger(tw.q.alleleType)) throw 'q.alleleType is not integer'
				if (!Number.isInteger(tw.q.geneticModel)) throw 'q.geneticModel is not integer'
				if (tw.q.geneticModel == 3) {
					if (typeof tw.q.snp2refGrp != 'object') throw 'q.snp2refGrp{} is not object when geneticMode=3'
				}
				if (tw.type == 'snplst') {
					// missingGenotype is not needed for snplocus
					if (!Number.isInteger(tw.q.missingGenotype)) throw 'q.missingGenotype is not integer for snplst'
				}
			}
		}
	}
	// interaction between independent terms
	for (const i of q.independent) {
		if (!i.interactions) i.interactions = []
		for (const x of i.interactions) {
			// TODO allow tw.interactions[] array to contain snpid instead of snplst term id
			if (!q.independent.find(y => y.$id == x)) throw 'interacting term id missing from independent[]: ' + x
		}
	}

	// univariate/multivariate
	if (q.includeUnivariate) {
		// both univariate and multivariate analyses will be performed
		if (q.independent.length < 2) throw 'multiple covariates expected'
		if (q.independent.find(i => i.interactions.length)) throw 'interactions not allowed in univariate analysis'
		if (q.independent.find(i => i.term.type == 'snplocus'))
			throw 'snplocus term not supported in univariate/multivariable analysis'
	}
}

function checkTwAncestryRestriction(tw, q, ds) {
	if (!tw.q.restrictAncestry) return
	/* this attr is required for snplst and snplocus
	tw.q.restrictAncestry = {
		name: str
		tvs: {} // not used in this script
	}
	look for corresponding entry in ds, in which principal component data are stored in the frozne pcs Map
	attach the pcs to tw.q.restrictAncestry for later use
	*/
	if (!('name' in tw.q.restrictAncestry)) throw '.name missing from tw.q.restrictAncestry'
	if (!ds.cohort.termdb.restrictAncestries) throw 'ds.cohort.termdb.restrictAncestries missing'
	// look for entry by name
	const a = ds.cohort.termdb.restrictAncestries.find(i => i.name == tw.q.restrictAncestry.name)
	if (!a) throw 'unknown ancestry for restriction: ' + tw.q.restrictAncestry.name
	if (a.pcs) {
		// directly available in this entry
		tw.q.restrictAncestry.pcs = a.pcs
		return
	}
	if (a.PCBySubcohort) {
		// by subcohort, which is coded as a tvs in q.filter
		if (!q.filter) throw 'q.filter missing while trying to access subcohort for PCBySubcohort'
		const cohortFilterTvs = getFilterItemByTag(q.filter, 'cohortFilter')
		if (!cohortFilterTvs)
			throw 'tvs by tag=cohortFilter missing from q.filter.lst[] while trying to access subcohort for PCBySubcohort'
		// cohortFilterTvs.tvs.values[] contain elements e.g. {key:'ABC'}
		// in which keys are joined in alphabetical order for lookup in a.PCBySubcohort{}
		const sortedKeys = cohortFilterTvs.tvs.values
			.map(i => i.key)
			.sort()
			.join(',')
		const b = a.PCBySubcohort[sortedKeys]
		if (!b) throw 'unknown key for PCBySubcohort: ' + sortedKeys
		if (!b.pcs) throw 'pcs Map() missing from PCBySubcohort[]: ' + sortedKeys
		tw.q.restrictAncestry.pcs = b.pcs
		return
	}
	throw 'unknown way of accessing pcs from ds.cohort.termdb.restrictAncestries: ' + tw.q.restrictAncestry.name
}

/*
Rinput {
	regressionType: regression type (linear/logistic/cox)
	data: [{}] per-sample data values
	outcome: {} outcome variable
	independent: [{}] independent variables
}

- snps from snplst and snplocus terms are added as elements into independent[] array
- PCs from q.restrictAncestry.pcs are added as elements into independent[] array
- further details of JSON structure described in server/utils/regression.R
*/
function makeRinput(q, sampledata) {
	// outcome variable
	const outcome = {
		id: q.outcome.$id,
		name: q.outcome.term.name,
		rtype: 'numeric' // always numeric because (1) linear regression: values are continuous, (2) logistic regression: values get converted to 0/1, (3) cox regression: time-to-event is continuous and event is 0/1
	}
	if (q.regressionType == 'logistic') {
		// for logistic regression, if spline terms are present, the spline plot needs to have label for nonref category of outcome
		outcome.categories = {
			ref: q.outcome.refGrp,
			nonref: q.outcome.nonRefGrp
		}
	} else if (q.regressionType == 'cox') {
		// for cox regression, outcome needs to be time-to-event data
		outcome.timeToEvent = {
			timeId: q.outcome.$id + '_time',
			eventId: q.outcome.$id + '_event',
			timeScale: q.outcome.q.timeScale
		}
		if (outcome.timeToEvent.timeScale == 'age') {
			// age time scale
			outcome.timeToEvent.agestartId = q.outcome.$id + '_agestart'
			outcome.timeToEvent.ageendId = q.outcome.$id + '_ageend'
		}
	}

	// independent variables
	const independent = []
	for (const tw of q.independent) {
		if (tw.type == 'snplst' || tw.type == 'snplocus') {
			makeRvariable_snps(tw, independent, q)
		} else {
			makeRvariable_dictionaryTerm(tw, independent, q)
		}
	}

	// prepare per-sample data values
	// for each sample, determine if it has value for all variables
	// if so, then sample can be included for analysis
	const data = []
	for (const tmp of sampledata) {
		const { sample, id2value } = tmp
		let skipsample = false
		const out = id2value.get(q.outcome.$id)
		if (!out) continue
		for (const tw of q.independent) {
			// tw = termWrapper
			if (tw.type == 'snplocus') {
				// snplocus snps are analyzed separately from each other
				// therefore samples need to be filtered separately for each snplocus snp
				// this filtering will be done in the R script
				continue
			}
			if (tw.type == 'snplst') {
				const snp2value = id2value.get(tw.$id)
				const snps = [...tw.highAFsnps.keys()]
				if (!snp2value || !snps.every(snp => Object.keys(snp2value).includes(snp))) {
					skipsample = true
					break
				}
			} else {
				const independent = id2value.get(tw.$id)
				if (!independent) {
					skipsample = true
					break
				}
			}
		}
		if (skipsample) continue

		// this sample has values for all variables and is eligible for regression analysis
		// fill entry with data of sample for each variable
		const entry = { __sample: sample } // sample id will be used in snplocusPostprocess()
		// outcome variable
		if (q.regressionType == 'linear') {
			// linear regression, therefore continuous outcome
			// use value
			entry[outcome.id] = out.value
		}
		if (q.regressionType == 'logistic') {
			// logistic regression, therefore categorical outcome
			// use key
			// convert ref/non-ref to 0/1
			entry[outcome.id] = out.key === q.outcome.refGrp ? 0 : 1
		}
		if (q.regressionType == 'cox') {
			// cox regression, therefore time-to-event outcome
			// use both key (event status) and value (time)
			entry[outcome.timeToEvent.eventId] = out.key
			if (q.outcome.term.type == 'condition') {
				const { age_start, age_end } = out.value
				entry[outcome.timeToEvent.timeId] = age_end - age_start
				if (q.outcome.q.timeScale == 'age') {
					entry[outcome.timeToEvent.agestartId] = age_start
					entry[outcome.timeToEvent.ageendId] = age_end
				}
			} else {
				entry[outcome.timeToEvent.timeId] = out.value
			}
		}

		// independent variable
		for (const t of independent) {
			const v = id2value.get(t.id) || id2value.get(t.$id)
			if (!v) {
				// sample has no value for this variable
				// this variable is either a snplocus snp or an ancestry PC
				// set value to 'null' because R will
				// convert 'null' to 'NA' during json import
				entry[t.id] = null
			} else {
				entry[t.id] = Object.hasOwn(v, t.id)
					? v[t.id] // for snps, object keys will be snp ids
					: t.rtype == 'numeric'
					? v.value
					: v.key
			}
		}

		data.push(entry)
	}

	const Rinput = {
		regressionType: q.regressionType,
		cachedir: serverconfig.cachedir, // for creating spline plot file
		data,
		outcome,
		independent,
		includeUnivariate: q.includeUnivariate
	}

	return Rinput
}

function makeRvariable_dictionaryTerm(tw, independent, q) {
	// tw is a dictionary term
	const thisTerm = {
		id: tw.$id,
		name: tw.term.name,
		type: tw.q.mode == 'spline' ? 'spline' : 'other',
		rtype: tw.q.mode == 'continuous' || tw.q.mode == 'spline' ? 'numeric' : 'factor'
	}
	// map tw.interactions into thisTerm.interactions
	if (tw.interactions.length) {
		thisTerm.interactions = []
		for (const id of tw.interactions) {
			const tw2 = q.independent.find(i => i.$id == id)
			if (tw2.type == 'snplst') {
				// this term is interacting with a snplst term, fill in all snps from this list into thisTerm.interactions
				for (const s of tw2.highAFsnps.keys()) thisTerm.interactions.push(s)
			} else if (tw2.type == 'snplocus') {
				// snplocus interactions should not be handled here because each snp needs to be analyzed separately
				// snplocus interactions will be specified separately for each snp in makeRvariable_snps()
				continue
			} else {
				// this term is interacting with another dictionary term
				thisTerm.interactions.push(id)
			}
		}
	}
	if (thisTerm.rtype === 'factor') thisTerm.refGrp = tw.refGrp
	if (tw.q.mode == 'spline') {
		thisTerm.spline = {
			knots: tw.q.knots.map(x => Number(x.value))
		}
		if (!q.independent.find(i => i.type == 'snplocus')) {
			// when there isn't a snplocus variable, can make spline plot
			thisTerm.spline.plot = true
		}
	}
	independent.push(thisTerm)
}

function makeRvariable_snps(tw, independent, q) {
	// tw is either snplst or snplocus
	// create one independent variable for each snp
	for (const snpid of tw.highAFsnps.keys()) {
		const thisSnp = {
			$id: tw.$id, // need this to retrieve data from getData() output
			id: snpid, // need this to discriminate between snps
			name: snpid,
			type: tw.type,
			interactions: structuredClone(tw.interactions)
		}
		if (tw.q.geneticModel == 3) {
			// by genotype
			thisSnp.rtype = 'factor'
			// assign ref grp
			thisSnp.refGrp = tw.q.snp2refGrp[snpid]
		} else {
			// treat as numeric and do not assign refGrp
			thisSnp.rtype = 'numeric'
		}
		independent.push(thisSnp)
	}
	if (tw.q.restrictAncestry) {
		// add PCs as independent variables
		for (const pcid of tw.q.restrictAncestry.pcs.keys()) {
			independent.push({
				id: pcid,
				name: pcid,
				type: 'float',
				rtype: 'numeric'
			})
		}
	}
}

function validateRinput(Rinput) {
	const regressionType = Rinput.regressionType
	const outcome = Rinput.outcome

	// validate sample size
	if (Rinput.data.length < minimumSample) throw 'too few samples to fit model'

	// verify number of variables in data entries
	// number of independent variables
	let nvariables = Rinput.independent.length
	// add in number outcome variables
	if (regressionType == 'cox') {
		if (outcome.timeToEvent.timeScale == 'time') {
			nvariables = nvariables + 2
		} else if (outcome.timeToEvent.timeScale == 'age') {
			nvariables = nvariables + 4
		} else {
			throw 'unknown cox regression time scale'
		}
	} else {
		nvariables = nvariables + 1
	}
	// check if all data entries have same number of variables
	if (Rinput.data.find(entry => Object.keys(entry).length - 1 != nvariables)) {
		throw 'unequal number of variables in data entries'
	}

	// validate outcome variable
	if (regressionType == 'logistic') {
		const vals = new Set(Rinput.data.map(entry => entry[outcome.id]))
		if ([...vals].find(v => ![0, 1].includes(v))) throw 'non-0/1 outcome values found'
	}
	if (regressionType == 'cox') {
		const vals = new Set(Rinput.data.map(entry => entry[outcome.timeToEvent.eventId]))
		if ([...vals].find(v => ![0, 1].includes(v))) throw 'non-0/1 outcome event values found'
	}

	// validate independent variables
	for (const variable of Rinput.independent) {
		if (variable.rtype == 'numeric') {
			if (variable.refGrp) throw `reference group given for '${variable.id}'`
		} else if (variable.rtype == 'factor') {
			if (!variable.refGrp) throw `reference group not given for '${variable.id}'`
			// verify that the data of categorical variables contain at least 2 categories, one of which is the ref group
			// do not perform this check on snp variables because samples can have same genotypes for a snp
			if (variable.type == 'snplst' || variable.type == 'snplocus') continue
			const vals = new Set(Rinput.data.map(entry => entry[variable.id]))
			if (vals.size < 2) throw `fewer than 2 categories in data of variable='${variable.id}'`
			if (!vals.has(variable.refGrp)) throw `reference group missing in data of variable='${variable.id}'`
		} else {
			throw `variable rtype='${variable.rtype}' not recognized`
		}
	}
}

async function runRegression(Rinput, id2originalId, q, result) {
	// run regression analysis in R
	stime = new Date().getTime()
	const Routput = JSON.parse(await run_R('regression.R', JSON.stringify(Rinput)))
	await parseRoutput(Rinput, Routput, id2originalId, q, result)
	etime = new Date().getTime()
	benchmark['NodeJS']['runRegression'] = (etime - stime) / 1000 + ' sec'
}

async function parseRoutput(Rinput, Routput, id2originalId, q, result) {
	const outdata = Routput.data
	benchmark['regression.R'] = Routput.benchmark

	for (const analysis of outdata) {
		// convert "analysis" to "analysisResult", then push latter to resultLst
		const analysisResult = {
			data: {
				sampleSize: analysis.data.sampleSize,
				eventCnt: analysis.data.eventCnt
			}
		}

		if (analysis.id) {
			/* id is set on this analysis result
			this is the model-fitting result for one snp from a snplocus term
			** this must not be a snp from snplst! as snps from snplst are analyzed as covariates,
			** while snps from snplocus each have model-fitted separately
			*/
			const snpid = id2originalId[analysis.id]
			// converted id is now snpid, assign to analysisResult
			// client will rely on this id to associate this result to a variant
			analysisResult.id = snpid

			const tw = q.independent.find(i => i.type == 'snplocus')
			if (!tw) throw 'snplocus term missing'

			// copy AF to it, for showing by m dot hovering
			analysisResult.AFstr = tw.snpid2AFstr.get(snpid)

			analysisResult.data.headerRow = getLine4OneSnp(snpid, tw)
		}

		const data = analysis.data

		// residuals
		if (data.residuals) {
			analysisResult.data.residuals = data.residuals
			analysisResult.data.residuals.label = Rinput.regressionType == 'linear' ? 'Residuals' : 'Deviance residuals'
		}

		// coefficients
		if (data.coefficients) {
			// coefficients from a single analysis
			analysisResult.data.coefficients = parseCoefficients(data.coefficients, Rinput.regressionType != 'cox')
		} else if (data.coefficients_uni && data.coefficients_multi) {
			// coefficients from univariate and multivariate analyses
			analysisResult.data.coefficients_uni = parseCoefficients(data.coefficients_uni, false)
			analysisResult.data.coefficients_multi = parseCoefficients(data.coefficients_multi, false)
		} else {
			throw 'coefficients table not found'
		}
		function parseCoefficients(in_coef, hasIntercept) {
			if (in_coef.rows.length < (hasIntercept ? 2 : 1)) throw 'too few rows in coefficients table'
			const out_coef = {
				header: in_coef.header,
				terms: {}, // individual independent terms, not interaction
				interactions: [], // interactions
				label: 'Coefficients'
			}
			if (hasIntercept) out_coef.intercept = in_coef.rows.shift()
			for (const row of in_coef.rows) {
				if (row[0].indexOf(':') != -1) {
					// is an interaction
					const [id1, id2] = row.shift().split(':')
					const [cat1, cat2] = row.shift().split(':')
					const termid1 = id2originalId[id1]
					const termid2 = id2originalId[id2]
					// row is now only data fields
					const interactions = out_coef.interactions
					if (!interactions.some(x => x.term1 == termid1 && x.term2 == termid2))
						interactions.push({ term1: termid1, term2: termid2, categories: [] })
					const interaction = interactions.find(x => x.term1 == termid1 && x.term2 == termid2)
					interaction.categories.push({ category1: cat1, category2: cat2, lst: row })
				} else {
					// not interaction, individual variable
					const id = row.shift()
					const category = row.shift()
					// row is now only data fields
					const termid = id2originalId[id]
					if (!out_coef.terms[termid]) out_coef.terms[termid] = {}
					if (category) {
						// has category
						if (!out_coef.terms[termid].categories) out_coef.terms[termid].categories = {}
						out_coef.terms[termid].categories[category] = row
					} else {
						// no category
						out_coef.terms[termid].fields = row
					}
				}
			}
			return out_coef
		}

		// type III statistics
		if (data.type3) {
			analysisResult.data.type3 = {
				header: data.type3.header,
				terms: {}, // individual independent terms, not interaction
				interactions: [] // interactions
			}
			if (Rinput.regressionType != 'cox') analysisResult.data.type3.intercept = data.type3.rows.shift()
			for (const row of data.type3.rows) {
				if (row[0].indexOf(':') != -1) {
					// is an interaction
					const interaction = {}
					const [id1, id2] = row.shift().split(':')
					// row is now only data fields
					interaction.term1 = id2originalId[id1]
					interaction.term2 = id2originalId[id2]
					interaction.lst = row
					analysisResult.data.type3.interactions.push(interaction)
				} else {
					// not interaction, individual variable
					const id = row.shift()
					// row is now only data fields
					const termid = id2originalId[id]
					if (!analysisResult.data.type3.terms[termid]) analysisResult.data.type3.terms[termid] = row
				}
			}
			analysisResult.data.type3.label = 'Type III statistics'
		}

		// total snp effect
		if (data.totalSnpEffect) {
			if (data.totalSnpEffect.rows.length != 1) throw 'total SNP effect table should have 1 row'
			analysisResult.data.totalSnpEffect = { header: data.totalSnpEffect.header.slice(0, 4) }
			const rowdata = data.totalSnpEffect.rows[0].slice(0, 4)
			const variables = data.totalSnpEffect.rows[0][4].split(';')
			// extract the snp main effect variable
			const snpInd = variables.findIndex(variable => !variable.includes(':'))
			const snp = variables.splice(snpInd, 1)[0]
			analysisResult.data.totalSnpEffect.snp = id2originalId[snp]
			// extract the snp interactions
			const interactions = []
			for (const variable of variables) {
				if (!variable.includes(':')) throw 'expected interaction'
				const [id1, id2] = variable.split(':')
				interactions.push({ term1: id2originalId[id1], term2: id2originalId[id2] })
			}
			analysisResult.data.totalSnpEffect.interactions = interactions
			analysisResult.data.totalSnpEffect.lst = rowdata
			analysisResult.data.totalSnpEffect.label = 'Total SNP effect'
		}

		// statistical tests
		if (data.tests) {
			analysisResult.data.tests = data.tests
			analysisResult.data.tests.label = 'Statistical tests'
		}

		// other summary statistics
		if (data.other) {
			analysisResult.data.other = data.other
			analysisResult.data.other.label = 'Other summary statistics'
		}

		// plots
		if (data.splinePlotFiles) {
			if (!analysisResult.data.splinePlots) analysisResult.data.splinePlots = []
			for (const file of data.splinePlotFiles) {
				const plot = await fs.promises.readFile(file)
				const obj = {
					src: 'data:image/svg+xml;base64,' + new Buffer.from(plot).toString('base64'),
					size: imagesize(file)
				}
				const type = path.basename(file, '.svg').split('_')[1]
				if (type == 'univariate' || type == 'multivariate') obj.type = type
				analysisResult.data.splinePlots.push(obj)
				fs.unlink(file, err => {
					if (err) throw err
				})
			}
		}

		// warnings
		if (data.warnings) analysisResult.data.warnings = data.warnings

		// add warnings for snplst variants that are either
		// monomorphic or have effect allele frequency below the cutoff
		// because these variants were discarded from the analysis.
		const snplst = q.independent.find(v => v.type == 'snplst')
		if (snplst) {
			// snplst is in q.independent
			if (snplst.lowAFsnps && snplst.lowAFsnps.size) {
				// variants with effect allele frequency below cutoff present
				if (!analysisResult.data.warnings) analysisResult.data.warnings = []
				for (const key of snplst.lowAFsnps.keys()) {
					analysisResult.data.warnings.push(`${key}: effect allele frequency below cutoff, excluded from analysis`)
				}
			}
			if (snplst.monomorphicLst && snplst.monomorphicLst.length) {
				// monomorphic variants present
				if (!analysisResult.data.warnings) analysisResult.data.warnings = []
				for (const snp of snplst.monomorphicLst) {
					analysisResult.data.warnings.push(`${snp}: monomorphic, excluded from analysis`)
				}
			}
		}
		result.resultLst.push(analysisResult)
	}
}

async function snplocusPostprocess(q, sampledata, Rinput, result) {
	const tw = q.independent.find(i => i.type == 'snplocus')
	if (!tw) return
	stime = new Date().getTime()
	addResult4monomorphic(tw, result)
	if (tw.lowAFsnps.size) {
		// low-af variants are not used for model-fitting
		// use alternative method depending on regression type
		if (q.regressionType == 'linear') {
			await lowAFsnps_wilcoxon(tw, sampledata, Rinput, result)
		} else if (q.regressionType == 'logistic') {
			await lowAFsnps_fisher(tw, sampledata, Rinput, result)
		} else if (q.regressionType == 'cox') {
			await lowAFsnps_cuminc(tw, sampledata, Rinput, result)
		} else {
			throw 'unknown regression type'
		}
	}
	etime = new Date().getTime()
	benchmark['NodeJS']['snplocusPostprocess'] = (etime - stime) / 1000 + ' sec'
}

async function lowAFsnps_wilcoxon(tw, sampledata, Rinput, result) {
	// for linear regression, perform wilcoxon rank sum test for low-AF snps
	const wilcoxInput = []
	const snpid2scale = new Map() // k: snpid, v: {minv,maxv} for making scale in boxplot
	for (const [snpid, snpO] of tw.lowAFsnps) {
		let minv = null,
			maxv = null
		const hasEffAlleleValues = [],
			noEffAlleleValues = []
		for (const { sample } of sampledata) {
			const d = Rinput.data.find(d => d.__sample == sample)
			if (!d) continue
			const outcomeValue = d.outcome
			if (!Number.isFinite(outcomeValue)) throw 'outcome value is not numeric'
			const gt = snpO.samples.get(sample)
			if (!gt) {
				// missing gt for this sample
				continue
			}

			if (minv == null) {
				minv = maxv = outcomeValue
			} else {
				minv = Math.min(minv, outcomeValue)
				maxv = Math.max(maxv, outcomeValue)
			}

			const [a, b] = gt.split('/')
			if (a == snpO.effAle || b == snpO.effAle) {
				hasEffAlleleValues.push(outcomeValue)
			} else {
				noEffAlleleValues.push(outcomeValue)
			}
		}
		wilcoxInput.push({
			group1_id: snpid + '_hasEffAllele',
			group1_values: hasEffAlleleValues,
			group2_id: snpid + '_noEffAllele',
			group2_values: noEffAlleleValues
		})
		snpid2scale.set(snpid, { minv, maxv })
	}
	const wilcoxOutput = JSON.parse(await run_rust('wilcoxon', JSON.stringify(wilcoxInput)))
	for (const test of wilcoxOutput) {
		const snpid = test.group1_id.replace('_hasEffAllele', '')
		const hasEffAlleleValues = test.group1_values
		const noEffAlleleValues = test.group2_values
		let pvalue
		if (test.pvalue == null || test.pvalue == 'null') {
			pvalue = 'NA'
		} else {
			pvalue = test.pvalue.toPrecision(4)
		}
		const { minv, maxv } = snpid2scale.get(snpid)

		const box1 = boxplot_getvalue(
			hasEffAlleleValues
				.sort((a, b) => a - b)
				.map(i => {
					return { value: i }
				})
		)
		box1.label = `Carry ${tw.q.alleleType == 0 ? 'minor' : 'alternative'} allele, n=${hasEffAlleleValues.length}`
		const box2 = boxplot_getvalue(
			noEffAlleleValues
				.sort((a, b) => a - b)
				.map(i => {
					return { value: i }
				})
		)
		box2.label = `No ${tw.q.alleleType == 0 ? 'minor' : 'alternative'} allele, n=${noEffAlleleValues.length}`

		// make a result object for this snp
		const analysisResult = {
			id: snpid,
			AFstr: tw.snpid2AFstr.get(snpid),
			data: {
				headerRow: getLine4OneSnp(snpid, tw),
				wilcoxon: {
					pvalue,
					boxplots: {
						minv,
						maxv,
						hasEff: box1,
						noEff: box2
					}
				}
			}
		}
		result.resultLst.push(analysisResult)
	}
}

async function lowAFsnps_fisher(tw, sampledata, Rinput, result) {
	// for logistic, perform fisher's exact test for low-AF snps
	const input = [] //input for run_rust()
	let index = 0
	const index2snpid = new Map()
	for (const [snpid, snpO] of tw.lowAFsnps) {
		// a snp with low AF, run fisher on it
		// count 4 numbers for this snp across all samples
		let outcome0noale = 0, // outcome=no, no allele
			outcome0hasale = 0, // outcome=no, has allele
			outcome1noale = 0, // outcome=yes, no allele
			outcome1hasale = 0 // outcome=yes, has allele

		for (const { sample } of sampledata) {
			const d = Rinput.data.find(d => d.__sample == sample)
			if (!d) continue
			// outcome is the outcome term value in R input: either 0 or 1
			const outcome = 'outcome' in d ? d.outcome : d.outcome_event
			if (outcome != 0 && outcome != 1) throw 'outcome is not 0 or 1'
			const gt = snpO.samples.get(sample)
			if (!gt) {
				// missing gt for this sample, skip
				continue
			}
			const [a, b] = gt.split('/')
			const hasale = snpO.effAle == a || snpO.effAle == b
			if (outcome == 0) {
				if (hasale) outcome0hasale++
				else outcome0noale++
			} else {
				if (hasale) outcome1hasale++
				else outcome1noale++
			}
		}
		/* a test forming 2x2 table:
		     has ale  no ale
		Yes  -        - 
		No   -        -
		*/
		index2snpid.set(index, snpid)
		const test = {
			index: index,
			n1: outcome1hasale,
			n2: outcome0hasale,
			n3: outcome1noale,
			n4: outcome0noale
		}
		input.push(test)
		index++
	}

	const tests = await run_rust('fisher', JSON.stringify({ input: input }))
	for (const test of JSON.parse(tests)) {
		const snpid = index2snpid.get(test.index)
		const { effAle } = tw.lowAFsnps.get(snpid)
		const pvalue = test.p_value

		// make a result object for this snp
		const isChi = test.fisher_chisq === 'chisq'
		const analysisResult = {
			id: snpid,
			AFstr: tw.snpid2AFstr.get(snpid),
			data: {
				headerRow: getLine4OneSnp(snpid, tw),
				fisher: {
					isChi: isChi,
					pvalue: Number(pvalue.toFixed(4)),
					rows: [
						['', 'Carry ' + effAle + ' allele', 'No ' + effAle + ' allele'],
						['Have event', test.n1, test.n3],
						['No event', test.n2, test.n4]
					]
				}
			}
		}
		result.resultLst.push(analysisResult)
	}
}

async function lowAFsnps_cuminc(tw, sampledata, Rinput, result) {
	// for cox, perform cuminc analysis between samples having and missing effect allele
	const cumincRinput = { data: {} } // input for cuminc analysis
	const snpsToSkip = new Set() // skip these snps
	// because at least one allele is not found in any sample
	for (const [snpid, snpO] of tw.lowAFsnps) {
		const snpData = []
		for (const { sample } of sampledata) {
			const d = Rinput.data.find(d => d.__sample == sample)
			if (!d) continue
			if (d.outcome_event !== 0 && d.outcome_event !== 1) throw 'd.outcome_event is not 0/1'
			if (!Number.isFinite(d.outcome_time)) throw 'd.outcome_time is not numeric'

			// data point of this sample, to add to snpData[]
			const sampleData = {
				time: d.outcome_time,
				event: d.outcome_event
			}

			const gt = snpO.samples.get(sample)
			if (!gt) {
				// missing gt for this sample, skip
				continue
			}
			const [a, b] = gt.split('/')

			// hardcoded series "1/2", here and client side
			// if this person carries the allele, assign to series "1", otherwise "2"
			sampleData.series = snpO.effAle == a || snpO.effAle == b ? '1' : '2'

			snpData.push(sampleData)
		}
		const serieses = new Set(snpData.map(sample => sample.series))
		if (serieses.size < 2) {
			// at least one allele of snp is not found in any sample
			// cannot perform cuminc test on snp
			snpsToSkip.add(snpid)
			continue
		}
		cumincRinput.data[snpid] = snpData
	}

	// run cumulative incidence analysis in R
	const ci_data = await runCumincR(cumincRinput)

	// parse cumulative incidence results
	let cuminc
	for (const [snpid, snpO] of tw.lowAFsnps) {
		if (snpsToSkip.has(snpid)) {
			// cuminc test was not performed on this snp
			const msg =
				'Cannot perform cumulative incidence test on this snp - at least one allele is not found in any sample'
			cuminc = { pvalue: 'NA', msg }
		} else {
			if (!ci_data[snpid].tests?.length == 1) throw 'must have a single test'
			const pvalue = Number(ci_data[snpid].tests[0].pvalue)
			if (!Number.isFinite(pvalue)) throw 'invalid pvalue'
			cuminc = {
				pvalue: Number(pvalue.toFixed(4)),
				ci_data: { [snpid]: ci_data[snpid] }
			}
		}

		// make a result object for this snp
		const analysisResult = {
			id: snpid,
			AFstr: tw.snpid2AFstr.get(snpid),
			data: {
				headerRow: getLine4OneSnp(snpid, tw),
				cuminc
			}
		}

		result.resultLst.push(analysisResult)
	}
}

function addResult4monomorphic(tw, result) {
	for (const snpid of tw.monomorphicLst) {
		const gt2count = tw.snpgt2count.get(snpid)
		const lst = []
		for (const [gt, c] of gt2count) lst.push(gt + '=' + c)
		const analysisResult = {
			id: snpid,
			data: { headerRow: getLine4OneSnp(snpid, tw) }
		}
		result.resultLst.push(analysisResult)
	}
}

function getLine4OneSnp(snpid, tw) {
	// get summary line for one snp to show in result
	const gt2count = tw.snpgt2count.get(snpid)
	if (!gt2count) return { k: 'Error', v: 'Variant not found' }
	const gtcounts = []
	for (const [gt, c] of gt2count) gtcounts.push(gt + '=' + c)
	const snp = { snpid, gtcounts }
	if (tw.monomorphicLst.includes(snpid)) {
		snp.monomorphic = true
	} else {
		snp.effAle = tw.highAFsnps.has(snpid) ? tw.highAFsnps.get(snpid).effAle : tw.lowAFsnps.get(snpid).effAle
		snp.af = tw.snpid2AFstr.get(snpid)
	}
	return { k: 'Variant:', v: snp }
}

/*
Arguments
q{}
	.filter
	.ds

terms[]
	array of tw

Returns an array with elemenents:
		{
		  	sample: integer,
			id2value: Map[
				tw.$id,
				{
					// depending on term type and desired 
					key: either (a) bin or groupsetting label, or (b) precomputed or annotated value if no bin/groupset is used, 
					value: precomputed or annotated value
				}
			]
		},
*/
async function getSampleData(q, ds) {
	const q2 = Object.assign({}, q)
	q2.terms = [q.outcome, ...q.independent]
	const result = await getData(q2, ds)

	const filteredSamples = mayProcessSampleByCoxOutcome(q, ds, result.samples) // array of objects, same shape as result.samples{} values
	const samples = [] // collect reshaped sample objs and return

	for (const sample of filteredSamples) {
		// reshape sample{} into obj{}
		const obj = {
			sample: sample.sample,
			id2value: new Map()
		}

		for (const tw of q2.terms) {
			if (tw.$id in sample) {
				obj.id2value.set(tw.$id, sample[tw.$id])
				mayAddAncestryPCs(tw, obj, ds)
			}
		}
		samples.push(obj)
	}
	return samples
}

function mayAddAncestryPCs(tw, obj, ds) {
	if (!tw.q.restrictAncestry) return
	// add sample pc values from tw.q.restrictAncestry.pcs to samples
	for (const [pcid, s] of tw.q.restrictAncestry.pcs) {
		if (s.has(obj.sample)) {
			obj.id2value.set(pcid, { key: s.get(obj.sample), value: s.get(obj.sample) })
		}
	}
}

function mayProcessSampleByCoxOutcome(q, ds, getDataSamples) {
	if (q.regressionType != 'cox' || q.outcome.term.type != 'condition') {
		// will not filter
		const lst = []
		for (const k in getDataSamples) lst.push(getDataSamples[k])
		return lst
	}

	if (!ds.cohort.termdb.ageEndOffset) throw 'ageEndOffset missing'

	const psamples = [] // processed samples
	for (const sid in getDataSamples) {
		const sample = getDataSamples[sid] // object may be modified

		if (!(q.outcome.$id in sample)) continue // sample missing outcome value??

		// value.key is event: event status code
		if (sample[q.outcome.$id].key == -1) continue // discard samples that had events before follow-up

		// age_start: age at beginning of follow-up
		// age_end: age at event or at censoring
		const { age_start, age_end } = JSON.parse(sample[q.outcome.$id].value)

		// for timeScale='age', add a small offset to age_end
		// to prevent age_end = age_start (which would cause
		// R to error out)
		sample[q.outcome.$id].value = {
			age_start,
			age_end: q.outcome.q.timeScale == 'age' ? age_end + ds.cohort.termdb.ageEndOffset : age_end
		}

		psamples.push(sample)
	}
	return psamples
}

function replaceTermId(Rinput) {
	// replace term IDs with custom IDs (to avoid spaces/commas in R)

	// make conversion table between IDs
	const id2originalId = {} // k: new id, v: original term id
	const originalId2id = {} // k: original term id, v: new id
	// outcome variable
	id2originalId['outcome'] = Rinput.outcome.id
	originalId2id[Rinput.outcome.id] = 'outcome'
	if (Rinput.outcome.timeToEvent) {
		// time-to-event variable
		const t2e = Rinput.outcome.timeToEvent
		id2originalId['outcome_time'] = t2e.timeId
		originalId2id[t2e.timeId] = 'outcome_time'
		id2originalId['outcome_event'] = t2e.eventId
		originalId2id[t2e.eventId] = 'outcome_event'
		if (t2e.timeScale == 'age') {
			id2originalId['outcome_agestart'] = t2e.agestartId
			id2originalId['outcome_ageend'] = t2e.ageendId
			originalId2id[t2e.agestartId] = 'outcome_agestart'
			originalId2id[t2e.ageendId] = 'outcome_ageend'
		}
	}
	// independent variables
	for (const [i, variable] of Rinput.independent.entries()) {
		// custom IDs of independent variables need a trailing '_'
		// to serve as separator between ID and category in
		// coefficents table in R
		id2originalId['id' + i + '_'] = variable.id
		originalId2id[variable.id] = 'id' + i + '_'
	}

	// replace IDs of variables and interacting variables in Rinput
	// outcome variable
	Rinput.outcome.id = originalId2id[Rinput.outcome.id]
	if (Rinput.outcome.timeToEvent) {
		const t2e = Rinput.outcome.timeToEvent
		t2e.timeId = originalId2id[t2e.timeId]
		t2e.eventId = originalId2id[t2e.eventId]
		if (t2e.timeScale == 'age') {
			t2e.agestartId = originalId2id[t2e.agestartId]
			t2e.ageendId = originalId2id[t2e.ageendId]
		}
	}
	// independent variables
	for (const variable of Rinput.independent) {
		variable.id = originalId2id[variable.id]
		// interactions
		if (variable.interactions?.length) {
			// assuming no interactions with time-to-event variables
			for (const [i, intvariable] of variable.interactions.entries()) {
				variable.interactions[i] = originalId2id[intvariable]
			}
		}
	}

	// replace IDs of variables in data
	for (const entry of Rinput.data) {
		for (const id of Object.keys(entry)) {
			if (id == '__sample') continue
			entry[originalId2id[id]] = entry[id]
			delete entry[id]
		}
	}

	return [id2originalId, originalId2id]
}

/* temporary duplicated
may move to server/shared/filter.js to share between client/back
*/
function getFilterItemByTag(item, tag) {
	if (item.tag === tag) return item
	if (item.type !== 'tvslst') return
	for (const subitem of item.lst) {
		const matchingItem = getFilterItemByTag(subitem, tag)
		if (matchingItem) return matchingItem
	}
}
