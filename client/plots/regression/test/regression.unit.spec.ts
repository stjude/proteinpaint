import tape from 'tape'
import { getGeneVariantWildtypeGrp } from '../regression.inputs.term.js'
import { isLoneOutcome } from '../Regression.ts'

/*
Tests:
	getGeneVariantWildtypeGrp() - snv/indel groupset, returns the wildtype group
	getGeneVariantWildtypeGrp() - continuous cnv groupset, returns the neutral (cnvWT) group
	getGeneVariantWildtypeGrp() - custom groupset, returns the wildtype group
	getGeneVariantWildtypeGrp() - groupset without a wildtype group
	getGeneVariantWildtypeGrp() - wildtype group without samples
	getGeneVariantWildtypeGrp() - q.type='values', no groupset in use
	getGeneVariantWildtypeGrp() - missing groupset of q.predefined_groupset_idx
	isLoneOutcome() - lone survival term and no condition term in the ds
	isLoneOutcome() - lone survival term but the ds also has condition terms
	isLoneOutcome() - a lone term of each type
	isLoneOutcome() - ds without loneTermByType
	isLoneOutcome() - regression type other than cox
	isLoneOutcome() - per cohort of a ds with subcohorts
	isLoneOutcome() - unknown active cohort of a ds with subcohorts
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

/*************************
 isLoneOutcome()
**************************/

const survivalTerm = { id: 'os', name: 'Overall survival', type: 'survival' }
const conditionTerm = { id: 'grade', name: 'Max grade', type: 'condition' }

// termdbConfig of a ds without subcohorts, thus loneTermByType is keyed by the empty cohort string
function tdbConfig(byType, allowedTermTypes) {
	return { loneTermByType: { '': byType }, allowedTermTypes }
}

tape('isLoneOutcome() - lone survival term and no condition term in the ds', test => {
	test.plan(1)
	const termdbConfig = tdbConfig({ survival: survivalTerm }, ['survival', 'categorical', 'float'])
	test.equal(isLoneOutcome('cox', termdbConfig), true, 'should be true, there is nothing to replace the term with')
})

tape('isLoneOutcome() - lone survival term but the ds also has condition terms', test => {
	test.plan(1)
	// condition is absent from loneTermByType while listed in allowedTermTypes,
	// so the ds has 2+ condition terms that can serve as the outcome
	const termdbConfig = tdbConfig({ survival: survivalTerm }, ['survival', 'condition'])
	test.equal(isLoneOutcome('cox', termdbConfig), false, 'should be false, condition terms are replacements')
})

tape('isLoneOutcome() - a lone term of each type', test => {
	test.plan(1)
	const termdbConfig = tdbConfig({ survival: survivalTerm, condition: conditionTerm }, ['survival', 'condition'])
	test.equal(isLoneOutcome('cox', termdbConfig), false, 'should be false, the two lone terms replace each other')
})

tape('isLoneOutcome() - ds without loneTermByType', test => {
	test.plan(2)
	test.equal(isLoneOutcome('cox', { allowedTermTypes: ['survival'] }), false, 'should be false without loneTermByType')
	test.equal(isLoneOutcome('cox', undefined), false, 'should be false and not throw without termdbConfig')
})

tape('isLoneOutcome() - regression type other than cox', test => {
	test.plan(2)
	const termdbConfig = tdbConfig({ survival: survivalTerm }, ['survival'])
	// linear/logistic outcomes also accept numeric and categorical terms, thus never lone
	test.equal(isLoneOutcome('linear', termdbConfig), false, 'should be false for linear')
	test.equal(isLoneOutcome('logistic', termdbConfig), false, 'should be false for logistic')
})

tape('isLoneOutcome() - per cohort of a ds with subcohorts', test => {
	test.plan(2)
	const termdbConfig = {
		selectCohort: { values: [{ keys: ['ABC'] }, { keys: ['XYZ', 'ABC'] }] },
		// only the first cohort has a lone survival term
		loneTermByType: { ABC: { survival: survivalTerm } },
		allowedTermTypes: ['survival']
	}
	test.equal(isLoneOutcome('cox', termdbConfig, 0), true, 'should be true for the cohort with a lone term')
	test.equal(isLoneOutcome('cox', termdbConfig, 1), false, 'should be false for the cohort without a lone term')
})

tape('isLoneOutcome() - unknown active cohort of a ds with subcohorts', test => {
	test.plan(1)
	const termdbConfig = {
		selectCohort: { values: [{ keys: ['ABC'] }] },
		loneTermByType: { ABC: { survival: survivalTerm } },
		allowedTermTypes: ['survival']
	}
	// e.g. when restoring a session, before the active cohort is known
	test.equal(isLoneOutcome('cox', termdbConfig), false, 'should be false when the cohort key cannot be determined')
})
