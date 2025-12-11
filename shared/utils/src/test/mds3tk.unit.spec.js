import tape from 'tape'
import { summarize_mclass, guessSsmid } from '../mds3tk.js'

/* Tests

summarize_mclass()
guessSsmid()

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
