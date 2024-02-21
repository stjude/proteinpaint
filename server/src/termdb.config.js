import serverconfig from './serverconfig.js'
import { mayComputeTermtypeByCohort } from './termdb.server.init'
import { isMatch } from 'micromatch'
import { authApi } from './auth'

/*
the "termdbConfig" object is returned to client side that uses vocabApi
it is evolving to encompass all aspects of mds3 dataset, not just termdb
it informs client code (mostly mass plots) what this dataset is about
the object should be light-weight with *minimum data* only
it should not include large amount of purpose-specific data (e.g. premade plots)
that data should be progressively loaded by plot code

input:
q{}
	query object
	.dslabel=str
		for identifying official dataset when checking credentials
	.embedder=str
		client portal host
		
res
	express response

ds{}
	server side dataset object

genome{}
	server side genome obj

returns:
	a json object
*/

export function make(q, res, ds, genome) {
	const tdb = ds.cohort.termdb
	// add attributes to this object to reveal to client

	// add required attributes
	const c = {
		selectCohort: tdb.selectCohort, // optional
		supportedChartTypes: tdb.q.getSupportedChartTypes(q.embedder),
		hiddenChartTypes: ds.cohort.hiddenChartTypes,
		renamedChartTypes: ds.cohort.renamedChartTypes,
		allowedTermTypes: getAllowedTermTypes(ds),
		termMatch2geneSet: tdb.termMatch2geneSet,
		massSessionDuration: serverconfig.features.massSessionDuration || 30,
		dataDownloadCatch: tdb.dataDownloadCatch,
		matrix: tdb.matrix,
		hierCluster: tdb.hierCluster,
		mclass: tdb.mclass,
		alwaysRefillCategoricalTermValues: tdb.alwaysRefillCategoricalTermValues,
		isGeneSetTermdb: tdb.isGeneSetTermdb,
		lollipop: tdb.lollipop,
		urlTemplates: tdb.urlTemplates
	}
	// optional attributes
	// when missing, the attribute will not be present as "key:undefined"
	if (tdb.chartConfigByType) c.chartConfigByType = tdb.chartConfigByType
	if (tdb.multipleTestingCorrection) c.multipleTestingCorrection = tdb.multipleTestingCorrection
	if (tdb.helpPages) c.helpPages = tdb.helpPages
	if (tdb.minTimeSinceDx) c.minTimeSinceDx = tdb.minTimeSinceDx
	if (tdb.timeUnit) c.timeUnit = tdb.timeUnit
	if (tdb.cohortStartTimeMsg) c.cohortStartTimeMsg = tdb.cohortStartTimeMsg
	if (tdb.displaySampleIds) c.displaySampleIds = tdb.displaySampleIds
	if (tdb.logscaleBase2) c.logscaleBase2 = tdb.logscaleBase2

	if (ds.assayAvailability) c.assayAvailability = ds.assayAvailability
	if (ds.customTwQByType) c.customTwQByType = ds.customTwQByType
	c.requiredAuth = authApi.getRequiredCredForDsEmbedder(q.dslabel, q.embedder)
	addRestrictAncestries(c, tdb)
	addScatterplots(c, ds)
	addMatrixplots(c, ds)
	addGenomicQueries(c, ds, genome)
	addSinglecellData(c, ds)

	res.send({ termdbConfig: c })
}

function addRestrictAncestries(c, tdb) {
	if (!tdb.restrictAncestries) return
	c.restrictAncestries = tdb.restrictAncestries.map(i => {
		return { name: i.name, tvs: i.tvs }
	})
}

function addScatterplots(c, ds) {
	if (!ds.cohort.scatterplots) return
	// this dataset has premade scatterplots. reveal to client
	c.scatterplots = ds.cohort.scatterplots.plots.map(p => {
		return { name: p.name, dimensions: p.dimensions, colorTW: p.colorTW, shapeTW: p.shapeTW }
	})
}

function addMatrixplots(c, ds) {
	if (!ds.cohort.matrixplots) return
	// this dataset has premade matrixplots. reveal matrix plot names to client
	c.matrixplots = ds.cohort.matrixplots.plots.map(p => {
		return { name: p.name }
	})
}

function addSinglecellData(c, ds) {
	if (!ds.queries?.singleCell?.data) return
	// this dataset has premade scatterplots. reveal to client
	c.singleCell = ds.queries.singleCell.data
}

function addGenomicQueries(c, ds, genome) {
	const q = ds.queries
	if (!q) return
	// this ds supports genomic query methods
	c.queries = {
		defaultCoord: q.defaultCoord || genome.defaultcoord
	}
	const q2 = c.queries
	// copy from q{} to q2{}
	if (q.defaultBlock2GeneMode) q2.defaultBlock2GeneMode = q.defaultBlock2GeneMode
	if (q.snvindel) {
		q2.snvindel = {
			allowSNPs: q.snvindel.allowSNPs
		}
	}
	if (q.cnv) {
		q2.cnv = {}
		for (const k of [
			'cnvMaxLength',
			'cnvGainCutoff',
			'cnvLossCutoff',
			'absoluteValueRenderMax',
			'gainColor',
			'lossColor'
		]) {
			if (k in q.cnv) q2.cnv[k] = q.cnv[k]
		}
	}
	if (q.topMutatedGenes) q2.topMutatedGenes = q.topMutatedGenes
	if (q.topVariablyExpressedGenes) q2.topVariablyExpressedGenes = q.topVariablyExpressedGenes
	if (q.singleSampleMutation) {
		q2.singleSampleMutation = {
			sample_id_key: q.singleSampleMutation.sample_id_key,
			discoSkipChrM: q.singleSampleMutation.discoSkipChrM
		}
	}
	if (q.singleSampleGenomeQuantification) {
		q2.singleSampleGenomeQuantification = {}
		for (const k in q.singleSampleGenomeQuantification) {
			q2.singleSampleGenomeQuantification[k] = JSON.parse(JSON.stringify(q.singleSampleGenomeQuantification[k]))
			delete q2.singleSampleGenomeQuantification[k].folder
		}
	}
	if (q.singleSampleGbtk) {
		q2.singleSampleGbtk = {}
		for (const k in q.singleSampleGbtk) {
			q2.singleSampleGbtk[k] = JSON.parse(JSON.stringify(q.singleSampleGbtk[k]))
			delete q2.singleSampleGbtk[k].folder
		}
	}
	if (q.rnaseqGeneCount) {
		q2.rnaseqGeneCount = true
	}
}

// allowedTermTypes[] is an unique list of term types from this dataset
// crucial for determining if a plot can function
// e.g. survival plot can only work if allowedTermTypes.includes('survival')
function getAllowedTermTypes(ds) {
	mayComputeTermtypeByCohort(ds)
	// ds.cohort.termdb.termtypeByCohort[] is set

	// for now return list of term types irrespective of subcohorts

	const typeSet = new Set()
	for (const r of ds.cohort.termdb.termtypeByCohort) {
		if (r.type) typeSet.add(r.type)
	}

	if (ds.cohort.termdb.allowedTermTypes) {
		// optional predefined term types, append to set
		for (const t of ds.cohort.termdb.allowedTermTypes) typeSet.add(t)
	}

	if (ds?.queries?.defaultBlock2GeneMode) {
		// an mds3 dataset showing data in protein mode, add in "geneVariant"
		// this disables gene from searchable for dataset e.g. sjlife
		// same logic in trigger_findterm()
		typeSet.add('geneVariant')
	}

	return [...typeSet]
}
