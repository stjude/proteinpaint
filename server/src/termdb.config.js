const serverconfig = require('./serverconfig.js')
const { mayComputeTermtypeByCohort } = require('./termdb.sql')

/*
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

returns:
	the "termdbConfig{}" json object, registered at the mass app store
*/

export function make(q, res, ds) {
	const tdb = ds.cohort.termdb

	// add attributes to this object to reveal to client

	// add required attributes
	const c = {
		selectCohort: tdb.selectCohort, // optional
		supportedChartTypes: tdb.q.getSupportedChartTypes(q.embedder),
		allowedTermTypes: getAllowedTermTypes(ds),
		termMatch2geneSet: tdb.termMatch2geneSet,
		massSessionDuration: serverconfig.features.massSessionDuration || 30,
		dataDownloadFailHelpLink: tdb.dataDownloadFailHelpLink
	}

	// optional attributes
	// when missing, the attribute will not be present as "key:undefined"

	if (tdb.helpPages) c.helpPages = tdb.helpPages
	if (tdb.timeScale) c.timeScale = tdb.timeScale
	if (tdb.minTimeSinceDx) c.minTimeSinceDx = tdb.minTimeSinceDx
	if (tdb.coxTimeMsg) c.coxTimeMsg = tdb.coxTimeMsg
	if (tdb.coxStartTimeMsg) c.coxStartTimeMsg = tdb.coxStartTimeMsg
	if (tdb.restrictAncestries) {
		c.restrictAncestries = []
		for (const i of tdb.restrictAncestries) {
			c.restrictAncestries.push({ name: i.name, tvs: i.tvs })
		}
	}
	addRequiredAuth(c, q)
	addScatterplots(c, ds)

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

function addScatterplots(c, ds) {
	if (!ds.cohort.scatterplots) return
	// this dataset has premade scatterplots. reveal to client
	c.scatterplots = ds.cohort.scatterplots.plots.map(p => {
		return { name: p.name, dimensions: p.dimensions, colorTW: p.colorTW, shapeTW: p.shapeTW }
	})
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

	if (ds?.queries?.snvindel) {
		// an mds3 dataset with snvindel data, add in "geneVariant"
		typeSet.add('geneVariant')
	}

	return [...typeSet]
}
