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
		// TODO: may adjust the default group name based on automatically detected term types
		// otherwise, should define it via opts or overrides
		termGroupName: 'Gene Expression',
		clusterSamples: true,
		clusterMethod: 'average', // complete
		distanceMethod: 'euclidean',
		zScoreCap: 5,
		xDendrogramHeight: 100,
		yDendrogramHeight: 200,
		colorScale: { domain: [0, 0.5, 1], range: ['blue', 'white', 'red'] }
	}
	const overrides = app.vocabApi.termdbConfig.hierCluster || {}
	copyMerge(config.settings.hierCluster, overrides.settings, opts.settings?.hierCluster || {})

	// okay to validate state here?
	{
		const c = config.settings.hierCluster.colorScale
		if (!c) throw 'colorScale missing'
		if (!Array.isArray(c.domain) || c.domain.length == 0) throw 'colorScale.domain must be non-empty array'
		if (!Array.isArray(c.range) || c.range.length == 0) throw 'colorScale.range must be non-empty array'
		if (c.domain.length != c.range.length) throw 'colorScale domain[] and range[] of different length'
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
		const genes = opts.terms || []
		if (!Array.isArray(opts.terms)) throw 'opts.genes[] not array (may show geneset edit ui)'

		const twlst = []
		for (const i of opts.terms) {
			let tw
			// FIXME: should not hardcode term type here
			// hierarchical clustering will need to be performed
			// on any numeric term.
			if (typeof i.term == 'object' && i.term.type == 'geneVariant') {
				// i is already well-formed tw object
				tw = i
			} else {
				// shape i into term{} and nest into tw{}
				i.type = 'geneVariant'
				if (!i.gene && !i.name) throw 'no gene or name present'
				if (!i.gene) i.gene = i.name
				tw = { term: i }
			}
			await fillTermWrapper(tw, app.vocabApi)
			twlst.push(tw)
		}

		hcTermGroup.lst = twlst
		if (config.termgroups.indexOf(hcTermGroup) == -1) config.termgroups.unshift(hcTermGroup)
	}

	config.settings.matrix.maxSample = 100000
	return config
}
