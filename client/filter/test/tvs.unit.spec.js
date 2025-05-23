import tape from 'tape'
import { select } from 'd3-selection'
import { TVSInit, showTvsMenu } from '../tvs'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'
import { isDictionaryType } from '#shared/terms.js'
import { dtTerms } from '#shared/common.js'

const vocab = getExample()
const vocabApi = vocabInit({ state: { vocab } })
vocabApi.termdbConfig = { queries: { cnv: {} } }

/*************************
 reusable helper functions
**************************/

async function getPillFilterItem(termType) {
	if (!termType) throw `missing type`

	const holder = select('body')
		.append('div')
		.style('position', 'relative')
		.style('margin', '20px')
		.style('border', '1px solid #000')

	const pill = await TVSInit({
		vocabApi,
		holder,
		debug: true,
		callback: tvs => {
			console.log(tvs)
		}
	})

	const term = isDictionaryType(termType) ? vocab.terms.find(t => t.type === termType) : getNonDictTerm(termType)
	const item = {
		type: 'tvs',
		tvs: {
			term
		}
	}

	if (termType == 'categorical' || termType == 'survival') item.tvs.values = [{ key: Object.keys(term.values)[0] }]
	if (termType == 'condition') {
		item.tvs.bar_by_grade = 1
		item.tvs.values_by_max_grade = 1
		item.tvs.values = [{ key: 1, label: 'Grade 1' }]
	}
	if (termType == 'integer' || termType == 'float') {
		const values = vocabApi.datarows
			.filter(a => term.id in a.data)
			.map(a => a.data[term.id])
			.sort()
		item.tvs.ranges = [{ start: values[1], stop: values[2] }]
	}

	const filter = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [item]
	}

	return { pill, filter, item, term }
}

function getNonDictTerm(termType) {
	if (termType == 'geneVariant') return getGeneVariantTerm()
	if (dtTerms.map(t => t.type).includes(termType)) {
		const geneVariantTerm = getGeneVariantTerm()
		const dtTerm = geneVariantTerm.childTerms.find(t => t.type == termType)
		return dtTerm
	}
	throw `term type '${termType}' not recognized`
}

function getGeneVariantTerm() {
	const parentTerm = {
		kind: 'gene',
		id: 'TP53',
		gene: 'TP53',
		name: 'TP53',
		type: 'geneVariant',
		groupsetting: { disabled: false }
	}
	const childTerms = [
		{
			id: 'snvindel',
			query: 'snvindel',
			name: 'SNV/indel',
			parent_id: null,
			isleaf: true,
			type: 'dtsnvindel',
			dt: 1,
			values: {
				M: { label: 'MISSENSE' },
				F: { label: 'FRAMESHIFT' },
				WT: { label: 'Wildtype' }
			},
			name_noOrigin: 'SNV/indel',
			parentTerm
		},
		{
			id: 'cnv',
			query: 'cnv',
			name: 'CNV',
			parent_id: null,
			isleaf: true,
			type: 'dtcnv',
			dt: 4,
			values: {
				CNV_amp: { label: 'Copy number gain' },
				WT: { label: 'Wildtype' }
			},
			name_noOrigin: 'CNV',
			parentTerm
		},
		{
			id: 'fusion',
			query: 'svfusion',
			name: 'Fusion RNA',
			parent_id: null,
			isleaf: true,
			type: 'dtfusion',
			dt: 2,
			values: {
				Fuserna: { label: 'Fusion transcript' },
				WT: { label: 'Wildtype' }
			},
			name_noOrigin: 'Fusion RNA',
			parentTerm
		},
		{
			id: 'sv',
			query: 'svfusion',
			name: 'SV',
			parent_id: null,
			isleaf: true,
			type: 'dtsv',
			dt: 5,
			values: {
				SV: { label: 'Structural variation' },
				WT: { label: 'Wildtype' }
			},
			name_noOrigin: 'SV',
			parentTerm
		}
	]
	const term = Object.assign({}, parentTerm, { childTerms })
	return term
}

function testHandlerMethodsExists(test, handler) {
	test.equal(typeof handler?.term_name_gen, 'function', 'should have a term_name_gen() method')
	test.equal(typeof handler?.get_pill_label, 'function', 'should have a get_pill_label() method')
	test.equal(typeof handler?.getSelectRemovePos, 'function', 'should have a getSelectRemovePos() method')
	test.equal(typeof handler?.fillMenu, 'function', 'should have a fillMenu() method')
	test.equal(typeof handler?.setTvsDefaults, 'function', 'should have a setTvsDefaults() method')
}

function testTermNameGen(test, handler) {
	const t1 = { term: { name: 'short name' } }
	test.equal(handler?.term_name_gen(t1), t1.term.name, 'should not truncate a short term name')
	const t2 = { term: { name: 'abcdefghijklmnopqrstuvwxyz 012345678999999999' } }
	const truncatedName = handler?.term_name_gen(t2).split('>')[1]?.split('.')[0] || '>'
	test.true(t2.term.name.startsWith(truncatedName), 'should truncate a long term name')
}

/**************
 test sections
**************

*/

tape('\n', async test => {
	test.pass('-***- filter/tvs -***-')
	test.end()
})

tape('categorical tvs', async test => {
	//test.timeoutAfter(10000)
	//test.plan(5)
	const { pill, filter, item, term } = await getPillFilterItem('categorical')
	try {
		await pill.main({ tvs: item.tvs, filter })
		//test.equal(pill.Inner.dom.holder.node().querySelectorAll('.tvs_pill').length, 1, 'should render 1 pill for a single-tvs filter')
		const handler = pill.Inner.handler
		test.equal(handler.type, 'categorical', 'should use the categorical handler for a categorical term')
		testHandlerMethodsExists(test, handler)
		testTermNameGen(test, handler)
		// TODO: other handler methods may require different tests by term type
		// and may not be abstracted into a separate function, so put here
		// ...
		pill.Inner.dom.holder.remove()
	} catch (e) {
		test.fail('test error: ' + e)
	}
	test.end()
})

tape('survival tvs', async test => {
	//test.timeoutAfter(10000)
	//test.plan(5)
	const { pill, filter, item, term } = await getPillFilterItem('survival')
	try {
		await pill.main({ tvs: item.tvs, filter })
		test.equal(
			pill.Inner.dom.holder.node().querySelectorAll('.tvs_pill').length,
			1,
			'should render 1 pill for a single-tvs filter'
		)
		const handler = pill.Inner.handler
		test.equal(handler.type, 'survival', 'should use the survival handler for a survival term')
		testHandlerMethodsExists(test, handler)
		testTermNameGen(test, handler)
		pill.Inner.dom.holder.remove()
	} catch (e) {
		test.fail('test error: ' + e)
	}
	test.end()
})

tape('condition tvs', async test => {
	//test.timeoutAfter(10000)
	//test.plan(5)
	const { pill, filter, item, term } = await getPillFilterItem('condition')
	try {
		await pill.main({ tvs: item.tvs, filter })
		//test.equal(pill.Inner.dom.holder.node().querySelectorAll('.tvs_pill').length, 1, 'should render 1 pill for a single-tvs filter')
		const handler = pill.Inner.handler
		test.equal(handler.type, 'condition', 'should use the condition handler for a condition term')
		testHandlerMethodsExists(test, handler)
		testTermNameGen(test, handler)
		// TODO: other handler methods may require different tests by term type
		// and may not be abstracted into a separate function, so put here
		// ...
		pill.Inner.dom.holder.remove()
	} catch (e) {
		test.fail('test error: ' + e)
	}
	test.end()
})

tape('numeric tvs', async test => {
	//test.timeoutAfter(10000)
	//test.plan(5)
	const { pill, filter, item, term } = await getPillFilterItem('float')
	try {
		await pill.main({ tvs: item.tvs, filter })
		//test.equal(pill.Inner.dom.holder.node().querySelectorAll('.tvs_pill').length, 1, 'should render 1 pill for a single-tvs filter')
		const handler = pill.Inner.handler
		test.equal(handler.type, 'numeric', 'should use the numeric handler for a float term')
		testHandlerMethodsExists(test, handler)
		testTermNameGen(test, handler)
		// TODO: other handler methods may require different tests by term type
		// and may not be abstracted into a separate function, so put here
		// ...
		pill.Inner.dom.holder.remove()
	} catch (e) {
		test.fail('test error: ' + e)
	}
	test.end()
})

tape('geneVariant tvs', async test => {
	const { pill, filter, item, term } = await getPillFilterItem('geneVariant')
	try {
		// gene variant tvs
		await pill.main({ tvs: item.tvs, filter })
		const handler = pill.Inner.handler
		test.equal(handler.type, 'geneVariant', 'should use the geneVariant handler for a geneVariant term')
		testHandlerMethodsExists(test, handler)
		testTermNameGen(test, handler)
		pill.Inner.dom.holder.remove()
		// dt tvs
		for (const dtTerm of term.childTerms) {
			const { pill, filter, item } = await getPillFilterItem(dtTerm.type)
			await pill.main({ tvs: item.tvs, filter })
			const handler = pill.Inner.handler
			test.equal(handler.type, dtTerm.type, `should use the ${dtTerm.type} handler for a ${dtTerm.type} term`)
			testHandlerMethodsExists(test, handler)
			testTermNameGen(test, handler)
			pill.Inner.dom.holder.remove()
		}
	} catch (e) {
		test.fail('test error: ' + e)
	}
	test.end()
})
