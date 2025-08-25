import serverconfig from '#src/serverconfig.js'
import { authApi } from '#src/auth.js'
import { get_ds_tdb } from '#src/termdb.js'
import { mayCopyFromCookie } from '#src/utils.js'
import { TermTypes } from '#shared/terms.js'
import type { Mds3WithCohort } from '#types'

export const api: any = {
	endpoint: 'termdb/config',
	methods: {
		get: {
			init,
			request: {
				typeId: 'any'
			},
			response: {
				typeId: 'any'
			}
		}
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q = req.query
		mayCopyFromCookie(q, req.cookies)
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'

			const [ds] = get_ds_tdb(genome, q)
			return make(q, req, res, ds, genome)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.log(e)
		}
	}
}

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

req{}
	q is req.query
res
	express response

ds{}
	server side dataset object

genome{}
	server side genome obj

returns:
	a json object
*/

function make(q, req, res, ds: Mds3WithCohort, genome) {
	const tdb = ds.cohort.termdb
	// add attributes to this object to reveal to client

	// add required attributes
	const c: any = {
		selectCohort: getSelectCohort(ds, req),
		supportedChartTypes: tdb.q?.getSupportedChartTypes(req),
		renamedChartTypes: ds.cohort.renamedChartTypes,
		allowedTermTypes: getAllowedTermTypes(ds),
		termMatch2geneSet: tdb.termMatch2geneSet,
		massSessionDuration: serverconfig.features.massSessionDuration || 30,
		dataDownloadCatch: tdb.dataDownloadCatch,
		matrix: tdb.matrix,
		hierCluster: tdb.hierCluster,
		numericDictTermCluster: tdb.numericDictTermCluster,
		mclass: tdb.mclass,
		alwaysRefillCategoricalTermValues: tdb.alwaysRefillCategoricalTermValues,
		isGeneSetTermdb: tdb.isGeneSetTermdb,
		lollipop: tdb.lollipop,
		urlTemplates: tdb.urlTemplates,
		title: 'title' in ds.cohort ? ds.cohort.title : { text: ds.label },
		massNav: ds.cohort.massNav,
		tracks: tdb.tracks,
		sampleTypes: ds.cohort.termdb.sampleTypes,
		hasSampleAncestry: ds.cohort.termdb.hasSampleAncestry,
		defaultChartType: ds.cohort.defaultChartType,
		invalidTokenErrorHandling: tdb.invalidTokenErrorHandling,
		colorMap: tdb.colorMap,
		defaultTw4correlationPlot: tdb.defaultTw4correlationPlot,
		authFilter: req.query.filter
	}
	// optional attributes
	// when missing, the attribute will not be present as "key:undefined"
	if (tdb.plotConfigByCohort) c.plotConfigByCohort = tdb.plotConfigByCohort
	if (tdb.multipleTestingCorrection) c.multipleTestingCorrection = tdb.multipleTestingCorrection
	if (tdb.helpPages) c.helpPages = tdb.helpPages
	if (tdb.minTimeSinceDx) c.minTimeSinceDx = tdb.minTimeSinceDx
	if (tdb.timeUnit) c.timeUnit = tdb.timeUnit
	if (tdb.cohortStartTimeMsg) c.cohortStartTimeMsg = tdb.cohortStartTimeMsg
	if (tdb.hasAncestry) c.hasAncestry = tdb.hasAncestry
	if (tdb.logscaleBase2) c.logscaleBase2 = tdb.logscaleBase2
	if (tdb.useCasesExcluded) c.useCasesExcluded = tdb.useCasesExcluded
	if (tdb.excludedTermtypeByTarget) c.excludedTermtypeByTarget = tdb.excludedTermtypeByTarget
	if (tdb.survival) c.survival = tdb.survival
	if (tdb.regression) c.regression = tdb.regression
	if (ds.assayAvailability) c.assayAvailability = ds.assayAvailability
	if (ds.cohort.correlationVolcano) c.correlationVolcano = ds.cohort.correlationVolcano
	addRestrictAncestries(c, tdb)
	addScatterplots(c, ds)
	addMatrixplots(c, ds)
	addNonDictionaryQueries(c, ds, genome)

	/////////////// CAUTION //////////////
	// ensure only safe auth info is revealed to client
	c.requiredAuth = authApi.getRequiredCredForDsEmbedder(q.dslabel, q.embedder)
	const info: any = authApi.getNonsensitiveInfo(req) // type any to avoid tsc err
	c.clientAuthResult = info?.clientAuthResult || {}
	if (tdb.displaySampleIds) c.displaySampleIds = tdb.displaySampleIds(c.clientAuthResult)
	// app.middleware.js would have used authApi.mayAdjustFilter() to create an auth-related filter,
	// note this may be undefined if there is no ds.cohort.termdb.getAdditionalFilter
	c.authFilter = req.query.filter

	res.send({ termdbConfig: c })
}

function addRestrictAncestries(c, tdb) {
	if (!tdb.restrictAncestries) return
	c.restrictAncestries = tdb.restrictAncestries.map(i => {
		return { name: i.name, tvs: i.tvs, PCcount: i.PCcount }
	})
}
function addScatterplots(c, ds) {
	if (!ds.cohort.scatterplots) return
	// this dataset has premade scatterplots. reveal to client
	c.scatterplots = ds.cohort.scatterplots.plots.map(p => {
		return {
			name: p.name,
			dimensions: p.dimensions,
			colorTW: p.colorTW,
			shapeTW: p.shapeTW,
			colorColumn: p.colorColumn,
			sampleType: p.sampleType,
			coordsColumns: p.coordsColumns,
			settings: { sampleScatter: p.settings }, //the client settings are under sampleScatter so we add it here to avoid adding it in the dataset
			sampleCategory: p.sampleCategory
		}
	})
}

function addMatrixplots(c, ds) {
	if (!ds.cohort.matrixplots) return
	// this dataset has premade matrixplots. reveal matrix plot names to client
	c.matrixplots = ds.cohort.matrixplots.plots.map(p => {
		return { name: p.name }
	})
}

/* ds.queries{} contains diverse query types covering genomic, molecular, imaging etc
 */
function addNonDictionaryQueries(c, ds: Mds3WithCohort, genome) {
	const q = ds.queries
	if (!q) return
	// this ds supports genomic query methods
	c.queries = {
		defaultCoord: q.defaultCoord || genome.defaultcoord,
		gbRestrictMode: q.gbRestrictMode
	}
	const q2 = c.queries
	// copy from q{} to q2{}
	if (q.snvindel) {
		q2.snvindel = {
			allowSNPs: q.snvindel.allowSNPs,
			// details{} lists default method for computing variants, can be modified and is part of state
			// some of the stuff here are to provide user-selectable choices
			// e.g. computing methods, info fields, populations.
			details: q.snvindel.details,
			populations: q.snvindel.populations
		}
		if (q.snvindel.byisoform?.processTwsInOneQuery) q2.snvindel.byisoform = { processTwsInOneQuery: true } // quick fix; may revise later
	}
	if (q.trackLst) {
		q2.trackLst = q.trackLst
	}
	if (q.svfusion) {
		q2.svfusion = {}
	}
	if (q.ld) {
		q2.ld = JSON.parse(JSON.stringify(q.ld))
	}
	if (q.cnv) {
		q2.cnv = {}
		for (const k of [
			'cnvMaxLength',
			'cnvGainCutoff',
			'cnvLossCutoff',
			'cnvCutoffsByGene',
			'absoluteValueRenderMax',
			'gainColor',
			'lossColor'
		]) {
			if (k in q.cnv) q2.cnv[k] = q.cnv[k]
		}
	}
	if (q.geneCnv) {
		// gdc cnv is gene-level cnv but still expose as ".cnv{}" to see if client can handle it the same way as segment-based cnv.
		// if it won't work, change to q2.geneCnv{} instead
		//if (!q2.cnv) q2.cnv = {} // do not expose geneCnv to client, this causes blank cnv legend to show for gdc mds3 tk
	}

	if (q.topMutatedGenes) q2.topMutatedGenes = q.topMutatedGenes
	if (q.topVariablyExpressedGenes) q2.topVariablyExpressedGenes = q.topVariablyExpressedGenes
	if (q.singleSampleMutation) {
		q2.singleSampleMutation = {
			sample_id_key: q.singleSampleMutation.sample_id_key,
			discoPlot: q.singleSampleMutation.discoPlot
		}
	}
	if (q.singleSampleGenomeQuantification) {
		q2.singleSampleGenomeQuantification = {}
		for (const k in q.singleSampleGenomeQuantification) {
			q2.singleSampleGenomeQuantification[k] = JSON.parse(JSON.stringify(q.singleSampleGenomeQuantification[k]))
			delete q2.singleSampleGenomeQuantification[k].folder
		}
	}

	if (q.geneExpression) {
		q2.geneExpression = { unit: q.geneExpression.unit }
	}

	if (q.NIdata && serverconfig.features.showBrainImaging) {
		q2.NIdata = {}
		for (const k in q.NIdata) {
			q2.NIdata[k] = JSON.parse(JSON.stringify(q.NIdata[k]))
		}
	}

	if (q.DZImages && serverconfig.features.showDZImages) {
		q2.DZImages = {
			type: q.DZImages.type
		}
	}

	if (q.WSImages && serverconfig.features.showWSImages) {
		q2.WSImages = {
			type: q.WSImages.type
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
	if (q.singleCell) {
		// samples and data are required properties
		q2.singleCell = {
			samples: {
				sampleColumns: q.singleCell.samples.sampleColumns,
				experimentColumns: q.singleCell.samples.experimentColumns,
				extraSampleTabLabel: q.singleCell.samples.extraSampleTabLabel
			},
			images: q.singleCell.images,
			data: {
				sameLegend: q.singleCell.data.sameLegend,
				refName: q.singleCell.data.refName,
				settings: q.singleCell.data.settings,
				plots: q.singleCell.data.plots.map(p => {
					return { name: p.name, colorColumns: p.colorColumns, selected: p.selected }
				})
			}
		}
		// optional data types
		if (q.singleCell.geneExpression) {
			q2.singleCell.geneExpression = {}
		}
		if (q.singleCell.DEgenes) {
			q2.singleCell.DEgenes = { columnName: q.singleCell.DEgenes.columnName }
		}
	}
	if (q.images) {
		q2.images = {} //nothing to pass to the client for now, but the key must be present
	}
}

// allowedTermTypes[] is an unique list of term types from this dataset. allows plot to determine if term type specific feature is applicable for a ds
function getAllowedTermTypes(ds) {
	const typeSet = new Set()
	for (const r of ds.cohort.termdb.termtypeByCohort) {
		if (r.termType) typeSet.add(r.termType)
	}
	if (ds.cohort.termdb.allowedTermTypes) {
		// optional predefined term types, append to set
		for (const t of ds.cohort.termdb.allowedTermTypes) typeSet.add(t)
	}
	// assess other data types and add corresponding term types
	if (ds.queries?.geneExpression) typeSet.add(TermTypes.GENE_EXPRESSION)
	if (ds.queries?.metaboliteIntensity) typeSet.add(TermTypes.METABOLITE_INTENSITY)
	if (ds.queries?.ssGSEA) typeSet.add(TermTypes.SSGSEA)
	return [...typeSet]
}

function getSelectCohort(ds, req) {
	if (!ds.cohort.termdb.selectCohort) return // ds doesn't use cohort
	const copy = Object.assign({}, ds.cohort.termdb.selectCohort) // make copy for return
	if (ds.cohort.termdb.selectCohort.descriptionByUser) {
		copy.description = ds.cohort.termdb.selectCohort.descriptionByUser(authApi.getNonsensitiveInfo(req))
		delete copy.descriptionByUser
	} else if (ds.cohort.termdb.selectCohort.descriptionByCohortBasedOnUserRole) {
		copy.descriptionByCohort = ds.cohort.termdb.selectCohort.descriptionByCohortBasedOnUserRole(
			authApi.getNonsensitiveInfo(req)
		)
		delete copy.descriptionByCohortBasedOnUserRole
	}
	return copy
}
