import tape from 'tape'
import { load_driver } from '../mds3.load.js'
import { guessSsmid } from '../mds3.variant2samples.js'

/* test sections

load_driver()
guessSsmid()
*/

tape('\n', function (test) {
	test.comment('-***- mds3 unit tests -***-')
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
		test.equal(r.cnv.cnvs.length, 1, 'r.cnv.length=1')
	}
	{
		// q.hardcodeCnvOnly=1 and should only return cnv
		const r = await load_driver(Object.assign({ hardcodeCnvOnly: 1 }, q), ds)
		test.equal(r.skewer.length, 0, 'r.skewer.length=0 when hardcodeCnvOnly=1')
		test.equal(r.cnv.cnvs.length, 1, 'r.cnv.length=1')
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
		test.equal(r.cnv.cnvs.length, 1, 'r.cnv.length=1')
	}

	test.end()
})

tape('guessSsmid()', async function (test) {
	test.throws(() => guessSsmid('invalid'), /unknown ssmid/, 'should throw')

	// snvindel
	test.throws(() => guessSsmid('chr1__invalidPos__A__T'), /ssmid snvindel pos not integer/, 'should throw')
	test.deepEqual(guessSsmid('chr1__123__A__T'), { dt: 1, l: ['chr1', 123, 'A', 'T'] }, 'good snvindel')

	// cnv
	test.throws(
		() => guessSsmid('chr1__invalidstart__456__CNV_amp__1'),
		/ssmid cnv start\/stop not integer/,
		'should throw'
	)
	test.deepEqual(
		guessSsmid('chr1__123__456__CNV_amp__1'),
		{ dt: 4, l: ['chr1', 123, 456, 'CNV_amp', 1] },
		'cnv with value'
	)
	test.deepEqual(
		guessSsmid('chr1__123__456__CNV_amp__1__sample1'),
		{ dt: 4, l: ['chr1', 123, 456, 'CNV_amp', 1, 'sample1'] },
		'cnv with value, with sample'
	)
	test.deepEqual(
		guessSsmid('chr1__123__456__CNV_amp__'),
		{ dt: 4, l: ['chr1', 123, 456, 'CNV_amp', null] },
		'cnv with no value'
	)
	test.deepEqual(
		guessSsmid('chr1__123__456__CNV_amp____sample1'),
		{ dt: 4, l: ['chr1', 123, 456, 'CNV_amp', null, 'sample1'] },
		'cnv with no value, with sample'
	)

	// svfusion
	test.throws(() => guessSsmid('invalidDt__chr1__111__+__1__xx'), /ssmid dt not sv\/fusion/, 'should throw')
	test.throws(() => guessSsmid('2__chr1__invaliPos__+__1__xx'), /ssmid svfusion position not integer/, 'should throw')
	test.deepEqual(guessSsmid('2__chr1__123__+__1__xx'), { dt: 2, l: [2, 'chr1', 123, '+', 1, 'xx'] }, 'good fusion')
	test.deepEqual(guessSsmid('5__chr1__123__+__1__xx'), { dt: 5, l: [5, 'chr1', 123, '+', 1, 'xx'] }, 'good sv')

	test.end()
})

///////////////////// constants

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
				return { cnvs: [{}] }
			}
		}
	}
}
