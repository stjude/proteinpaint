import tape from 'tape'
import { load_driver } from '../mds3.load.js'

tape('\n', function (test) {
	test.pass('-***- mds3.load specs -***-')
	test.end()
})

tape('load_driver()', async function (test) {
	// t.throws() cannot handle async function
	try {
		await load_driver({}, {})
	} catch (e) {
		test.equal(e, 'do not know what client wants', 'should throw')
	}

	const q = { forTrack: 1, skewer: 1, rglst: [{ chr: '1', start: 1, stop: 10 }] }

	// ds without requiresHardcodeCnvOnlyFlag flag and allows cnv to coshow with skewer data
	{
		// should return both skewer and cnv
		const r = await load_driver(q, ds)
		test.equal(r.skewer.length, 1, 'r.skewer.length=1')
		test.equal(r.cnv.length, 1, 'r.cnv.length=1')
	}
	{
		// q.hardcodeCnvOnly=1 and should only return cnv
		const r = await load_driver(Object.assign({ hardcodeCnvOnly: 1 }, q), ds)
		test.equal(r.skewer.length, 0, 'r.skewer.length=0 when hardcodeCnvOnly=1')
		test.equal(r.cnv.length, 1, 'r.cnv.length=1')
	}

	// ds change!
	ds.queries.cnv.requiresHardcodeCnvOnlyFlag = true
	{
		// should only return skewer. cnv will not be returned
		const r = await load_driver(q, ds)
		test.equal(r.skewer.length, 1, 'r.skewer.length=1')
		test.false(r.cnv, 'r.cnv is undefined when requiresHardcodeCnvOnlyFlag is set but q.hardcodeCnvOnly is not set')
	}
	{
		// should only return cnv but not skewer
		const r = await load_driver(Object.assign({ hardcodeCnvOnly: 1 }, q), ds)
		test.equal(r.skewer.length, 0, 'r.skewer.length=0 when hardcodeCnvOnly=1')
		test.equal(r.cnv.length, 1, 'r.cnv.length=1')
	}

	test.end()
})

///////// constants
const ds = {
	queries: {
		snvindel: {
			byrange: {
				get: () => {
					return [{ chr: '1', pos: 5 }]
				}
			}
		},
		cnv: {
			get: () => {
				return [{}]
			}
		}
	}
}
