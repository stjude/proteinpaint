import { copyMerge } from '#rx'
import { getPlotConfig as getMatrixPlotConfig } from './matrix.config'
import { fillTermWrapper, get$id } from '#termsetting'
import { NumericModes, TermTypes, numericTypes } from '#shared/terms.js'

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
		zScoreTransformation: true,
		xDendrogramHeight: 100,
		yDendrogramHeight: 200,
		colorScale: 'blueWhiteRed'
	}
	const overrides = app.vocabApi.termdbConfig.hierCluster || {}

	// hierClusterSubTypeOverrides has settings from specific hierCluster type, such as geneExpression, metaboliteIntensity, numericDictTermCluster.
	// should override config so that each hierCluster type could have its own customized settings that are different from the other hierCluster
	// types in the same dataset. e.g. redomics could do z-score transformation for gene expression cluster and do not do z-score tranformation for
	// metabolite intensity cluster
	const hierClusterSubTypeOverrides = app.vocabApi.termdbConfig[`${config.dataType}Cluster`] || {}

	copyMerge(
		config.settings.hierCluster,
		overrides.settings,
		opts.settings?.hierCluster || {},
		hierClusterSubTypeOverrides.settings
	)

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
				if (config.dataType == TermTypes.GENE_EXPRESSION || config.dataType == TermTypes.METABOLITE_INTENSITY) {
					// set missing term type based on data type
					tw.term.type = config.dataType
				} else {
					throw `term type missing and cannot be assigned by dataType`
				}
			} else if (!numericTypes.has(tw.term.type)) {
				// May add other term type in hierCluster
				throw 'term type is not numeric'
			} else if (config.dataType && !canTermBeInHierGrp(config.dataType, tw.term.type)) {
				throw `cannot have term type ${tw.term.type} in ${config.dataType} term group`
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

// checking if a tw type could exist in a hierCluster group type
function canTermBeInHierGrp(grpType, twType) {
	if (grpType == 'numericDictTerm') {
		if (twType == 'float' || twType == 'integer') return true
	}
	return twType == grpType
}
