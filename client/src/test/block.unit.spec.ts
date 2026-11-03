import tape from 'tape'
import { copyArgRglst } from '../block.js'

/* list of tests

copyArgRglst()

*/

tape('\n', function (test) {
	test.comment('-***- block -***-')
	test.end()
})

tape('copyArgRglst()', test => {
	{
		const rglst = copyArgRglst([{ chr: 'chr10', start: 100, stop: 200, bstart: 0, bstop: 1000, reverse: true }])
		test.deepEqual(
			rglst,
			[{ chr: 'chr10', bstart: 0, bstop: 1000, start: 100, stop: 200, reverse: true }],
			'should keep given region boundaries that enclose the view range'
		)
	}
	{
		const rglst = copyArgRglst([{ chr: 'chr10', start: 100, stop: 200 }])
		test.equal(rglst[0].bstart, 100, 'should default bstart to start when region boundaries are not given')
		test.equal(rglst[0].bstop, 200, 'should default bstop to stop when region boundaries are not given')
	}
	{
		const rglst = copyArgRglst([{ chr: 'chr10', start: 100, stop: 200, bstart: 0 }])
		test.deepEqual(
			[rglst[0].bstart, rglst[0].bstop],
			[100, 200],
			'should use the view range when only one region boundary is given'
		)
	}
	{
		const rglst = copyArgRglst([{ chr: 'chr10', start: 100, stop: 200, bstart: 150, bstop: 1000 }])
		test.deepEqual(
			[rglst[0].bstart, rglst[0].bstop],
			[100, 200],
			'should use the view range when bstart is after start'
		)
	}
	{
		const rglst = copyArgRglst([{ chr: 'chr10', start: 100, stop: 200, bstart: 0, bstop: 150 }])
		test.deepEqual([rglst[0].bstart, rglst[0].bstop], [100, 200], 'should use the view range when bstop is before stop')
	}
	{
		const input = [
			{ chr: 'chr1', start: 10, stop: 20, bstart: 0, bstop: 50 },
			{ chr: 'chr2', start: 30, stop: 40 }
		]
		const rglst = copyArgRglst(input)
		test.equal(rglst.length, 2, 'should copy every region')
		test.deepEqual(
			rglst.map(r => [r.chr, r.bstart, r.bstop]),
			[
				['chr1', 0, 50],
				['chr2', 30, 40]
			],
			'should check region boundaries of each region separately'
		)
		rglst[0].start = 5
		test.equal(input[0].start, 10, 'should not share region objects with the input')
	}
	test.end()
})
