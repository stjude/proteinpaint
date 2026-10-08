import tape from 'tape'
import bedj_request_closure from '../bedj.js'

/*
Specs for the /tkbedj route, client-supplied item list branch.

test sections:
- /tkbedj: list length limit
*/

const maxBedItems = 1000
const genomes = { hg38: { name: 'hg38' } }
const handler = bedj_request_closure(genomes)

function makeItems(count) {
	return Array.from({ length: count }, (_, i) => ({ chr: 'chr1', start: i, stop: i + 1 }))
}

// resolves with the res.send() payload
function send(query) {
	return new Promise(resolve => {
		const req = { query }
		const res = { send: resolve }
		Promise.resolve(handler(req, res)).catch(e => resolve({ error: String(e) }))
	})
}

tape('\n', test => {
	test.comment('-***- bedj specs -***-')
	test.end()
})

tape('/tkbedj: list length limit', async test => {
	const rglst = [{ chr: 'chr1', start: 0, stop: maxBedItems + 1 }]

	const atLimit = await send({ genome: 'hg38', getdata: 1, bedItems: makeItems(maxBedItems), rglst })
	test.equal(atLimit.error, undefined, 'should not error for a list at the maximum length')
	test.equal(atLimit.items?.length, maxBedItems, 'should return all items at the maximum length')

	const overLimit = await send({ genome: 'hg38', getdata: 1, bedItems: makeItems(maxBedItems + 1), rglst })
	test.ok(overLimit.error, 'should reject a list over the maximum length')

	test.end()
})
