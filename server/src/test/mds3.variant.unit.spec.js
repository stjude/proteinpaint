import tape from 'tape'
import { get_mds3variantData } from '../mds3.variant.js'

/*
Specs for the request checks of get_mds3variantData(), which run before any data query.

test sections:
- get_mds3variantData: dataset without snvindel.details
- get_mds3variantData: region
*/

const chrlen = 248956422
const genome = { chrlookup: { CHR1: { name: 'chr1', len: chrlen } } }
const details = { groups: [{ type: 'population', key: 'gnomAD' }] }

// a byrange.get() that records whether a data query was made, so a rejected request can be told apart
function getDs(withDetails = true) {
	const ds = {
		queried: false,
		queries: {
			snvindel: {
				byrange: {
					get: async () => {
						ds.queried = true
						return []
					}
				}
			}
		}
	}
	if (withDetails) ds.queries.snvindel.details = details
	return ds
}

async function getError(q, ds) {
	try {
		await get_mds3variantData(q, { send: () => {} }, ds, genome)
	} catch (e) {
		return String(e)
	}
	return ''
}

tape('\n', test => {
	test.comment('-***- mds3.variant specs -***-')
	test.end()
})

tape('get_mds3variantData: dataset without snvindel.details', async test => {
	const ds = getDs(false)
	const error = await getError({ chr: 'chr1', start: 0, stop: 10, details }, ds)
	test.ok(error.includes('snvindel.details not supported'), 'should reject a dataset without snvindel.details')
	test.notOk(ds.queried, 'should not query the data')
	test.end()
})

tape('get_mds3variantData: region', async test => {
	for (const [region, message, label] of [
		[{ chr: 'chr1', start: 0, stop: chrlen + 1 }, 'stop out of bound', 'a region past the chromosome end'],
		[{ chr: 'chrZ', start: 0, stop: 10 }, 'invalid chr name', 'a region on an unknown chromosome'],
		[{ chr: 'chr1', start: 10, stop: 10 }, 'stop < start', 'a region with stop not after start']
	]) {
		const ds = getDs()
		const error = await getError({ ...region, details }, ds)
		test.ok(error.includes(message), `should reject ${label}`)
		test.notOk(ds.queried, `should not query the data for ${label}`)
	}
	test.end()
})
