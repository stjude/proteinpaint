import tape from 'tape'
import { getBEDitems } from '../bedj.js'

/*
Specs for getBEDitems(), the client-supplied list branch.

test sections:
- getBEDitems(): list length limit
*/

const maxBedItems = 1000

function makeItems(count) {
	return Array.from({ length: count }, (_, i) => ({ chr: 'chr1', start: i, stop: i + 1 }))
}

tape('\n', test => {
	test.comment('-***- bedj specs -***-')
	test.end()
})

tape('getBEDitems(): list length limit', async test => {
	const rglst = [{ chr: 'chr1', start: 0, stop: maxBedItems + 1 }]

	const atLimit = await getBEDitems({ query: { bedItems: makeItems(maxBedItems), rglst } })
	test.equal(atLimit.length, maxBedItems, 'should accept a list at the maximum length')

	try {
		await getBEDitems({ query: { bedItems: makeItems(maxBedItems + 1), rglst } })
		test.fail('should have thrown for a list over the maximum length')
	} catch (e) {
		test.pass('should reject a list over the maximum length')
	}

	test.end()
})
