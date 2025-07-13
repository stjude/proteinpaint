import tape from 'tape'
import { summarize_mclass } from '../mds3tk.js'

/* Tests

summarize_mclass()

*/

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- mds3tk -***-')
	test.end()
})

tape('summarize_mclass()', function (test) {
	// with categorical cnv
	const re1 = summarize_mclass([
		{ dt: 1, class: 'M' },
		{ dt: 1, class: 'F' },
		{ dt: 1, class: 'F' },
		{ dt: 4, class: 'CNV_loss' },
		{ dt: 4, class: 'CNV_loss' },
		{ dt: 4, class: 'CNV_loss' },
		{ dt: 2 },
		{ dt: 2 },
		{ dt: 2 },
		{ dt: 2 }
	])
	test.deepEqual(
		re1,
		[
			[2, 4],
			['CNV_loss', 3],
			['F', 2],
			['M', 1]
		],
		'correct with categorical cnv'
	)

	// with cnv with numeric values
	const re2 = summarize_mclass([
		{ dt: 1, class: 'M' },
		{ dt: 1, class: 'F' },
		{ dt: 1, class: 'F' },
		{ dt: 4, class: 'CNV_loss', value: -1 },
		{ dt: 4, class: 'CNV_loss', value: -1 },
		{ dt: 4, class: 'CNV_loss', value: -1 },
		{ dt: 2 },
		{ dt: 2 },
		{ dt: 2 },
		{ dt: 2 }
	])
	test.deepEqual(
		re2,
		[
			[2, 4],
			[4, 3],
			['F', 2],
			['M', 1]
		],
		'correct with numeric cnv'
	)

	test.end()
})
