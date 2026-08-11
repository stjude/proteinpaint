import tape from 'tape'
import { getDtTermValues, handler } from '../tvs.dt.js'
import { FrontendVocab } from '#termdb/FrontendVocab'
import { mclass } from '#shared/common.js'

/*
test sections:
	- getDtTermValues: classes and mnames, byOrigin
	- getDtTermValues: classes and mnames, no byOrigin
	- getDtTermValues: response without mnames
	- getDtTermValues: empty mname list for origin
	- getDtTermValues: frontend vocab keeps cached values
	- get_pill_label: mname values
*/

tape('\n', test => {
	test.comment('-***- filter/tvs.dt unit tests-***-')
	test.end()
})

/*********
Helpers
*********/

function getDtTerm(origin?: string) {
	const term: any = {
		id: 'snvindel',
		type: 'dtsnvindel',
		name: 'SNV/indel',
		dt: 1,
		parentTerm: { type: 'geneVariant', name: 'KRAS' }
	}
	if (origin) term.origin = origin
	return term
}

// stub vocabApi returning a fixed /termdb/categories response
function getVocabApi(categories: any, byOrigin = false) {
	return {
		getCategories: async () => categories,
		termdbConfig: {
			assayAvailability: byOrigin ? { byDt: { 1: { byOrigin: { germline: {}, somatic: {} } } } } : undefined
		}
	}
}

const categoriesByOrigin = {
	lst: [
		{
			dt: 1,
			classes: {
				byOrigin: {
					germline: { WT: 5, M: 1 },
					somatic: { WT: 4, M: 2, F: 1, Blank: 3 }
				}
			},
			mnames: {
				byOrigin: {
					germline: [{ mname: 'P34R', class: 'M', samplecount: 1 }],
					somatic: [
						{ mname: 'G12D', class: 'M', samplecount: 2 },
						{ mname: 'K100fs', class: 'F', samplecount: 1 }
					]
				}
			}
		}
	]
}

const categoriesFlat = {
	lst: [
		{
			dt: 1,
			classes: { WT: 5, M: 2, Blank: 1 },
			mnames: [
				{ mname: 'G12D', class: 'M', samplecount: 2 },
				{ mname: 'G12V', class: 'M', samplecount: 1 }
			]
		}
	]
}

/*********
Tests
*********/

tape('getDtTermValues: classes and mnames, byOrigin', async test => {
	const dtTerm = getDtTerm('somatic')
	await getDtTermValues(dtTerm, undefined, getVocabApi(categoriesByOrigin, true))

	test.deepEqual(
		dtTerm.values,
		{
			M: { key: 'M', label: mclass.M.label },
			F: { key: 'F', label: mclass.F.label }
		},
		'values should have somatic classes, excluding WT and Blank'
	)
	test.deepEqual(
		dtTerm.mnames,
		[
			{ mname: 'G12D', class: 'M', samplecount: 2 },
			{ mname: 'K100fs', class: 'F', samplecount: 1 }
		],
		'mnames should be the somatic list'
	)
	test.end()
})

tape('getDtTermValues: classes and mnames, no byOrigin', async test => {
	const dtTerm = getDtTerm()
	await getDtTermValues(dtTerm, undefined, getVocabApi(categoriesFlat))

	test.deepEqual(
		dtTerm.values,
		{ M: { key: 'M', label: mclass.M.label } },
		'values should have classes, excluding WT and Blank'
	)
	test.deepEqual(
		dtTerm.mnames,
		[
			{ mname: 'G12D', class: 'M', samplecount: 2 },
			{ mname: 'G12V', class: 'M', samplecount: 1 }
		],
		'mnames should be the flat list'
	)
	test.end()
})

tape('getDtTermValues: response without mnames', async test => {
	const categories = { lst: [{ dt: 1, classes: { WT: 5, M: 2 } }] }
	const dtTerm = getDtTerm()
	await getDtTermValues(dtTerm, undefined, getVocabApi(categories))

	test.deepEqual(dtTerm.values, { M: { key: 'M', label: mclass.M.label } }, 'values should still be filled')
	test.equal(dtTerm.mnames, undefined, 'mnames should be undefined when absent from response')
	test.end()
})

tape('getDtTermValues: empty mname list for origin', async test => {
	const categories = structuredClone(categoriesByOrigin)
	categories.lst[0].mnames.byOrigin.germline = []
	const dtTerm = getDtTerm('germline')
	await getDtTermValues(dtTerm, undefined, getVocabApi(categories, true))

	test.equal(dtTerm.mnames, undefined, 'mnames should be undefined when origin list is empty')
	test.end()
})

tape('getDtTermValues: frontend vocab keeps cached values', async test => {
	const cachedValues = { M: { key: 'M', label: 'MISSENSE' } }
	const cachedMnames = [{ mname: 'G12D', class: 'M', samplecount: 2 }]
	const dtTerm = getDtTerm()
	dtTerm.values = cachedValues
	dtTerm.mnames = cachedMnames

	// frontend vocab is used by the geneVariant groupset edit ui, where
	// values/mnames are prefetched onto the dt term with the real vocabApi
	const vocabApi = new FrontendVocab({ state: { vocab: { terms: [dtTerm] } } })
	let queried = false
	;(vocabApi as any).getCategories = async () => {
		queried = true
	}
	await getDtTermValues(dtTerm, undefined, vocabApi)

	test.equal(queried, false, 'getCategories should not be queried')
	test.equal(dtTerm.values, cachedValues, 'cached values should be preserved')
	test.equal(dtTerm.mnames, cachedMnames, 'cached mnames should be preserved')
	test.end()
})

tape('get_pill_label: mname values', test => {
	{
		const tvs = {
			term: { dt: 1, type: 'dtsnvindel' },
			genotype: 'variant',
			values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }]
		}
		test.deepEqual(handler.get_pill_label(tvs), { txt: 'G12D' }, 'single mname value should show its label')
	}
	{
		const tvs = {
			term: { dt: 1, type: 'dtsnvindel' },
			genotype: 'variant',
			values: [
				{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' },
				{ key: 'M', label: 'G12V', value: 'G12V', mname: 'G12V' }
			]
		}
		test.deepEqual(handler.get_pill_label(tvs), { txt: 'Mutated' }, 'multiple values should show Mutated for snvindel')
	}
	{
		const tvs = {
			term: { dt: 1, type: 'dtsnvindel' },
			genotype: 'wt',
			values: []
		}
		test.deepEqual(handler.get_pill_label(tvs), { txt: 'Wildtype' }, 'wildtype genotype should show Wildtype')
	}
	test.end()
})
