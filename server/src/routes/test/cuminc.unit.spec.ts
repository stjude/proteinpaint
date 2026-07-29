import tape from 'tape'
import { get_cuminc } from '../termdb.cuminc.ts'

/**
 * Tests
 *  - get_cuminc() request validation, for a term wrapper posted whole and for the
 *    superseded split form
 *
 * The reassembly of a posted term wrapper is covered by termdb.twFromRequest.unit.spec.ts
 */

const conditionTerm = { id: 'Cardiac dysrhythmia', name: 'Cardiac dysrhythmia', type: 'condition' }
const catTerm = { id: 'sex', name: 'Sex', type: 'categorical' }

const mockDs = {
	cohort: {
		termdb: {
			q: {
				termjsonByOneid: (id: string) =>
					id == conditionTerm.id ? conditionTerm : { id, name: id, type: 'categorical' }
			}
		}
	}
}

/** get_cuminc() validates minSampleSize before it reads any term */
function getReq(props: any) {
	return Object.assign({ ds: mockDs, minSampleSize: 5 }, props)
}

async function getError(q: any) {
	try {
		await get_cuminc(q, mockDs)
		return
	} catch (e: any) {
		return e.message || e
	}
}

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.cuminc -***-')
	test.end()
})

tape('get_cuminc: rejects a request without term1', async function (test) {
	const error = await getError(getReq({ term2: { $id: 'tw2', term: catTerm, q: { type: 'values' } } }))
	test.equal(error, 'term1 is missing', 'Should report the missing term rather than fail on it')
	test.end()
})

tape('get_cuminc: requires a condition term1', async function (test) {
	const whole = await getError(getReq({ term1: { $id: 'tw1', term: catTerm, q: { type: 'values' } } }))
	test.equal(whole, 'term1 must be condition term', 'Should reject a non-condition term posted whole')
	const split = await getError(getReq({ term1_id: 'sex', term1_q: { type: 'values' }, term1_$id: 'tw1' }))
	test.equal(split, 'term1 must be condition term', 'Should apply the same validation to the split form')
	test.end()
})

tape('get_cuminc: rejects a condition overlay or divide-by term', async function (test) {
	const term1 = { $id: 'tw1', term: conditionTerm, q: { mode: 'discrete' } }
	const overlay = await getError(getReq({ term1, term2: { $id: 'tw2', term: conditionTerm, q: {} } }))
	test.equal(overlay, 'overlay term cannot be condition term', 'Should reject a condition term2')
	const divideBy = await getError(getReq({ term1, term0: { $id: 'tw0', term: conditionTerm, q: {} } }))
	test.equal(divideBy, 'divideBy term cannot be condition term', 'Should reject a condition term0')
	test.end()
})

tape('get_cuminc: rejects an invalid minSampleSize', async function (test) {
	const q: any = { ds: mockDs, term1: { $id: 'tw1', term: conditionTerm, q: { mode: 'discrete' } } }
	test.equal(await getError(q), 'invalid minSampleSize', 'Should require a numeric minSampleSize')
	test.end()
})
