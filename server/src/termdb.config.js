const serverconfig = require('./serverconfig.js')
const { mayComputeTermtypeByCohort } = require('./termdb.server.init')

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
		allowedTermTypes: getAllowedTermTypes(ds),
		termMatch2geneSet: tdb.termMatch2geneSet,
		massSessionDuration: serverconfig.features.massSessionDuration || 30,
		dataDownloadCatch: tdb.dataDownloadCatch,
		matrix: tdb.matrix,
		mclass: tdb.mclass
	}

	// optional attributes
	// when missing, the attribute will not be present as "key:undefined"
	if (tdb.multipleTestingCorrection) c.multipleTestingCorrection = tdb.multipleTestingCorrection
	if (tdb.helpPages) c.helpPages = tdb.helpPages
	if (tdb.timeScale) c.timeScale = tdb.timeScale
	if (tdb.minTimeSinceDx) c.minTimeSinceDx = tdb.minTimeSinceDx
	if (tdb.coxTimeMsg) c.coxTimeMsg = tdb.coxTimeMsg
	if (tdb.coxStartTimeMsg) c.coxStartTimeMsg = tdb.coxStartTimeMsg
	if (tdb.displaySampleIds) c.displaySampleIds = tdb.displaySampleIds
	if (tdb.additionalSampleAttributes) c.additionalSampleAttributes = tdb.additionalSampleAttributes
	if (ds.assayAvailability) c.assayAvailability = ds.assayAvailability
	addRequiredAuth(c, q)
	addRestrictAncestries(c, tdb)
	addScatterplots(c, ds)
	addMatrixplots(c, ds)
	addGenomicQueries(c, ds, genome)

	res.send({ termdbConfig: c })
}

//////// helpers

function addRequiredAuth(c, q) {
	const cred = serverconfig.dsCredentials?.[q.dslabel]
	if (!cred) return
	// TODO: may restrict required auth by chart type???
	// currently, the client code assumes that it will only apply to the dataDownload MASS app
	c.requiredAuth = {
		type: cred.type || 'login',
		headerKey: cred.headerKey
	}
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

function addGenomicQueries(c, ds, genome) {
	const q = ds.queries
	if (!q) return
	// supports genomic query methods
	c.queries = {
		defaultBlock2GeneMode: q.defaultBlock2GeneMode,
		defaultCoord: q.defaultCoord || genome.defaultcoord
	}
	if (q.snvindel) c.queries.snvindel = true
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
