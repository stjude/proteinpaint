import tape from 'tape'
import { getGeneVariantWildtypeGrp } from '../regression.inputs.term.js'

/*
Tests:
	getGeneVariantWildtypeGrp() - snv/indel groupset, returns the wildtype group
	getGeneVariantWildtypeGrp() - continuous cnv groupset, returns the neutral (cnvWT) group
	getGeneVariantWildtypeGrp() - custom groupset, returns the wildtype group
	getGeneVariantWildtypeGrp() - groupset without a wildtype group
	getGeneVariantWildtypeGrp() - wildtype group without samples
	getGeneVariantWildtypeGrp() - q.type='values', no groupset in use
	getGeneVariantWildtypeGrp() - missing groupset of q.predefined_groupset_idx
*/

/*************************
 reusable helper functions
**************************/

// wrap a tvs into the filter of a group, mimicking getWrappedTvslst()
function filterOf(tvs) {
	return { type: 'tvslst', in: true, join: '', lst: [{ type: 'tvs', tvs }] }
}

// groups of a snv/indel groupset, mimicking getNonCnvGroupset()
const snvindelGroups = [
	{
		name: 'TP53 SNV/indel Mutated',
		type: 'filter',
		filter: filterOf({ values: [{ key: 'M' }], genotype: 'variant', mcount: 'any' })
	},
	{
		name: 'TP53 SNV/indel Wildtype',
		type: 'filter',
		filter: filterOf({ values: [], genotype: 'wt' })
	}
]

// groups of a continuous cnv groupset, mimicking getContCnvGroupset()
// note the wildtype group is named "Neutral" and is flagged by tvs.cnvWT
const contCnvGroups = [
	{
		name: 'TP53 CNV Gain',
		type: 'filter',
		filter: filterOf({ values: [], continuousCnv: true, cnvGainCutoff: 0.2, cnvLossCutoff: -99 })
	},
	{
		name: 'TP53 CNV Loss',
		type: 'filter',
		filter: filterOf({ values: [], continuousCnv: true, cnvGainCutoff: 99, cnvLossCutoff: -0.2 })
	},
	{
		name: 'TP53 CNV Neutral',
		type: 'filter',
		filter: filterOf({ values: [], continuousCnv: true, cnvWT: true, cnvGainCutoff: 0.2, cnvLossCutoff: -0.2 })
	}
]

// groups of the bi-/mono-allelic groupset, which has no wildtype group
// filters are nested tvslst, mimicking mayGetAllelicGroupset()
const allelicGroups = [
	{
		name: 'Bi-allelic alteration',
		type: 'filter',
		filter: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [
				{ type: 'tvs', tvs: { values: [], continuousCnv: true, cnvGainCutoff: 99, cnvLossCutoff: -1 } },
				{ type: 'tvs', tvs: { values: [{ key: 'M' }], genotype: 'variant', mcount: 'any' } }
			]
		}
	},
	{
		name: 'Mono-allelic alteration',
		type: 'filter',
		filter: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [{ type: 'tvs', tvs: { values: [{ key: 'M' }], genotype: 'variant', mcount: 'all' } }]
		}
	}
]

// gene variant tw using a predefined groupset
function predefinedTw(groups, idx = 0) {
	return {
		term: {
			type: 'geneVariant',
			name: 'TP53',
			groupsetting: { disabled: false, lst: [{ name: 'SNV/indel', groups }] }
		},
		q: { type: 'predefined-groupset', predefined_groupset_idx: idx }
	}
}

// gene variant tw using a custom groupset
function customTw(groups) {
	return {
		term: { type: 'geneVariant', name: 'TP53' },
		q: { type: 'custom-groupset', customset: { groups } }
	}
}

// sample counts as returned by getCategories(), keyed by group name
function sampleCountsOf(groups, counts) {
	return groups.map((g, i) => ({ key: g.name, label: g.name, samplecount: counts[i] }))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/regression.inputs.term -***-')
	test.end()
})

tape('getGeneVariantWildtypeGrp() - snv/indel groupset, returns the wildtype group', test => {
	test.plan(1)
	const tw = predefinedTw(snvindelGroups)
	// wildtype group is the smaller group, to verify it is not chosen by sample count
	const sampleCounts = sampleCountsOf(snvindelGroups, [500, 20])
	test.equal(
		getGeneVariantWildtypeGrp(tw, sampleCounts),
		'TP53 SNV/indel Wildtype',
		'should return the group with tvs.genotype="wt"'
	)
})

tape('getGeneVariantWildtypeGrp() - continuous cnv groupset, returns the neutral (cnvWT) group', test => {
	test.plan(1)
	const tw = predefinedTw(contCnvGroups)
	const sampleCounts = sampleCountsOf(contCnvGroups, [100, 80, 30])
	test.equal(
		getGeneVariantWildtypeGrp(tw, sampleCounts),
		'TP53 CNV Neutral',
		'should return the group with tvs.cnvWT, despite it not being named "Wildtype"'
	)
})

tape('getGeneVariantWildtypeGrp() - custom groupset, returns the wildtype group', test => {
	test.plan(1)
	const tw = customTw(snvindelGroups)
	const sampleCounts = sampleCountsOf(snvindelGroups, [500, 20])
	test.equal(
		getGeneVariantWildtypeGrp(tw, sampleCounts),
		'TP53 SNV/indel Wildtype',
		'should read groups from q.customset'
	)
})

tape('getGeneVariantWildtypeGrp() - groupset without a wildtype group', test => {
	test.plan(1)
	const tw = predefinedTw(allelicGroups)
	const sampleCounts = sampleCountsOf(allelicGroups, [50, 150])
	test.equal(
		getGeneVariantWildtypeGrp(tw, sampleCounts),
		undefined,
		'should return undefined for the bi-/mono-allelic groupset'
	)
})

tape('getGeneVariantWildtypeGrp() - wildtype group without samples', test => {
	test.plan(1)
	const tw = predefinedTw(snvindelGroups)
	// wildtype group is absent from sample counts
	const sampleCounts = [{ key: 'TP53 SNV/indel Mutated', label: 'TP53 SNV/indel Mutated', samplecount: 500 }]
	test.equal(
		getGeneVariantWildtypeGrp(tw, sampleCounts),
		undefined,
		'should return undefined when the wildtype group has no samples'
	)
})

tape("getGeneVariantWildtypeGrp() - q.type='values', no groupset in use", test => {
	test.plan(1)
	const tw = { term: { type: 'geneVariant', name: 'TP53' }, q: { type: 'values' } }
	test.equal(getGeneVariantWildtypeGrp(tw, []), undefined, 'should return undefined when no groupset is in use')
})

tape('getGeneVariantWildtypeGrp() - missing groupset of q.predefined_groupset_idx', test => {
	test.plan(1)
	// index is out of range of term.groupsetting.lst[]
	const tw = predefinedTw(snvindelGroups, 5)
	const sampleCounts = sampleCountsOf(snvindelGroups, [500, 20])
	test.equal(getGeneVariantWildtypeGrp(tw, sampleCounts), undefined, 'should return undefined and not throw')
})
