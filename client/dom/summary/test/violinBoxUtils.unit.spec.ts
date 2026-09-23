import tape from 'tape'
import { setDescrStatsByTerm } from '../violinBoxUtils'


/** Tests
 *  - setDescrStatsByTerm sets descrStats on terms
 */

/**************
 test section
***************/

tape('\n', function (test) {
	test.comment('-***- dom/summary/violinBoxUtils -***-')
	test.end()
})

tape('setDescrStatsByTerm sets descrStats on terms', t => {
	const terms = [
		{ $id: 'term1', q: {} },
		{ $id: 'term2', q: {} },
		undefined
	] as any
	const descrStatsByTerm = {
		term1: { mean: 1, median: 1 },
		term2: { mean: 2, median: 2 }
	} as any

	setDescrStatsByTerm(terms, descrStatsByTerm)

	t.deepEqual((terms[0].q as any).descrStats, descrStatsByTerm.term1, 'term1 descrStats set correctly')
	t.deepEqual((terms[1].q as any).descrStats, descrStatsByTerm.term2, 'term2 descrStats set correctly')
	t.notOk((terms[2] as any)?.q?.descrStats, 'undefined term does not have descrStats')
	t.notOk((terms[0].q as any).descrStats === undefined, 'term1 descrStats is defined')
	t.notOk((terms[1].q as any).descrStats === undefined, 'term2 descrStats is defined')
	t.end()
})