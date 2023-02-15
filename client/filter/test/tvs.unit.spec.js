import tape from 'tape'
import { select } from 'd3-selection'
import { TVSInit, showTvsMenu } from '../tvs'
import { vocabInit } from '#termdb/vocabulary'
import { detectElement } from '../../test/test.helpers'
import { getExample } from '#termdb/test/vocabData'

const vocab = getExample()
const vocabApi = vocabInit({ state: { vocab } })

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

	const term = vocab.terms.find(t => t.type === termType)
	const item = {
		type: 'tvs',
		tvs: {
			term
		}
	}

	if (termType == 'categorical') item.tvs.values = [{ key: Object.keys(term.values)[0] }]
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

		/*** tests for the expected handler API methods ***/
		// group tests by handler method
		test.equal(typeof handler?.term_name_gen, 'function', 'should have a term_name_gen() method')
		const t1 = { term: { name: 'short name' } }
		test.equal(handler?.term_name_gen(t1), t1.term.name, 'should not truncate a short term name')
		const t2 = { term: { name: 'abcdefghijklmnopqrstuvwxyz 012345678999999999' } }
		const truncatedName =
			handler
				?.term_name_gen(t2)
				.split('>')[1]
				?.split('.')[0] || '>'
		test.true(t2.term.name.startsWith(truncatedName), 'should truncate a long term name')

		// TODO: create >1 tests for each of these methods, similar to the above tests for term_name_gen()
		test.equal(typeof handler?.get_pill_label, 'function', 'should have a get_pill_label() method')
		test.equal(typeof handler?.getSelectRemovePos, 'function', 'should have a getSelectRemovePos() method')
		test.equal(typeof handler?.fillMenu, 'function', 'should have a fillMenu() method')
		test.equal(typeof handler?.setTvsDefaults, 'function', 'should have a setTvsDefaults() method')
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

		/*** tests for the expected handler API methods ***/
		// group tests by handler method
		test.equal(typeof handler?.term_name_gen, 'function', 'should have a term_name_gen() method')
		const t1 = { term: { name: 'short name' } }
		test.equal(handler?.term_name_gen(t1), t1.term.name, 'should not truncate a short term name')
		const t2 = { term: { name: 'abcdefghijklmnopqrstuvwxyz 012345678999999999' } }
		const truncatedName =
			handler
				?.term_name_gen(t2)
				.split('>')[1]
				?.split('.')[0] || '>'
		test.true(t2.term.name.startsWith(truncatedName), 'should truncate a long term name')

		// TODO: create >1 tests for each of these methods, similar to the above tests for term_name_gen()
		test.equal(typeof handler?.get_pill_label, 'function', 'should have a get_pill_label() method')
		test.equal(typeof handler?.getSelectRemovePos, 'function', 'should have a getSelectRemovePos() method')
		test.equal(typeof handler?.fillMenu, 'function', 'should have a fillMenu() method')
		test.equal(typeof handler?.setTvsDefaults, 'function', 'should have a setTvsDefaults() method')
		pill.Inner.dom.holder.remove()
		// TODO: test condition tvs that uses a groupsetting
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

		/*** tests for the expected handler API methods ***/
		// group tests by handler method
		test.equal(typeof handler?.term_name_gen, 'function', 'should have a term_name_gen() method')
		const t1 = { term: { name: 'short name' } }
		test.equal(handler?.term_name_gen(t1), t1.term.name, 'should not truncate a short term name')
		const t2 = { term: { name: 'abcdefghijklmnopqrstuvwxyz 012345678999999999' } }
		const truncatedName =
			handler
				?.term_name_gen(t2)
				.split('>')[1]
				?.split('.')[0] || '>'
		test.true(t2.term.name.startsWith(truncatedName), 'should truncate a long term name')

		// TODO: create >1 tests for each of these methods, similar to the above tests for term_name_gen()
		test.equal(typeof handler?.get_pill_label, 'function', 'should have a get_pill_label() method')
		test.equal(typeof handler?.getSelectRemovePos, 'function', 'should have a getSelectRemovePos() method')
		test.equal(typeof handler?.fillMenu, 'function', 'should have a fillMenu() method')
		test.equal(typeof handler?.setTvsDefaults, 'function', 'should have a setTvsDefaults() method')
		pill.Inner.dom.holder.remove()
		// TODO: test condition tvs that uses a groupsetting
	} catch (e) {
		test.fail('test error: ' + e)
	}
	test.end()
})
