import { copyMerge } from '../rx'
import { getPlotConfig as getMatrixPlotConfig } from './matrix.config'
import { fillTermWrapper, get$id } from '#termsetting'
import { NumericModes, TermTypes } from '../shared/terms.js'

export async function getPlotConfig(opts = {}, app) {
	opts.chartType = 'hierCluster'
	const config = await getMatrixPlotConfig(opts, app)
	// opts.genes will be processed as the hierCluster term group.lst
	delete config.genes

	config.settings.hierCluster = {
		/* type of data used for clustering
		exciting todo: (to introduce new dt values)
		- gene dependency
		- numeric dic term
		- non-gene genomic stuff that resolves into numeric quantities (cpg meth)
		- metabolite
		*/
		dataType: config.dataType,
		// adjust the default group name based on automatically detected term types
		// Done in matrix.cells.js: setHierClusterCellProps
		// termGroupName: 'Expression',
		clusterSamples: true,
		clusterMethod: 'average', // complete
		distanceMethod: 'euclidean',
		zScoreCap: 5,
		xDendrogramHeight: 100,
		yDendrogramHeight: 200,
		colorScale: 'blueWhiteRed'
	}
	const overrides = app.vocabApi.termdbConfig.hierCluster || {}
	copyMerge(config.settings.hierCluster, overrides.settings, opts.settings?.hierCluster || {})

	// okay to validate state here?
	{
		const c = config.settings.hierCluster.colorScale
		if (!c) throw 'colorScale missing'
	}

	config.settings.matrix.collabelpos = 'top'

	const termGroupName = config.settings.hierCluster.termGroupName
	const hcTermGroup = config.termgroups.find(g => g.type == 'hierCluster' || g.name == termGroupName) || {
		name: termGroupName
	}
	// TODO: should compose the term group in launchGdcHierCluster.js, since this handling is customized to only that dataset?
	// the opts{} object should be standard, should pre-process the opts outside of this getPlotConfig()

	hcTermGroup.type = 'hierCluster' // ensure that the group.type is correct for recovered legacy sessions

	if (!hcTermGroup.lst?.length) {
		if (!Array.isArray(opts.terms)) throw 'opts.terms[] not array (may show geneset edit ui)'

		const promises = []
		for (const i of opts.terms) {
			const tw = i.term ? i : { term: i }

			if (!tw.term.type) {
				// must provide term type for hierCluster
				throw `term type is missing`
			} else if (!['geneExpression', 'metaboliteIntensity', 'float'].includes(tw.term.type)) {
				// May add other term type in hierCluster
				throw 'term type not supported in hierCluster'
			}
			promises.push(fillTermWrapper(tw, app.vocabApi))
		}

		// make parallel requests for defaultBins
		hcTermGroup.lst = await Promise.all(promises)
		if (config.termgroups.indexOf(hcTermGroup) == -1) config.termgroups.unshift(hcTermGroup)
	}

	config.settings.matrix.maxSample = 100000
	return config
}
