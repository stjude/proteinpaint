import tape from 'tape'
import { makeCacheid, validate } from '../termdb.snp.js'
import { snpgtCacheFile } from '../utils.js'

/* test sections

makeCacheid()
validate(): snptext
*/

tape('\n', test => {
	test.comment('-***- termdb.snp specs -***-')
	test.end()
})

tape('makeCacheid()', test => {
	const ds = { genomename: 'hg38', label: 'SJLife' }
	const cacheid = makeCacheid(ds)
	test.match(cacheid, /^hg38_SJLife_\d+_\d+$/, 'should join the genome, dslabel, time, and a random number')
	test.doesNotThrow(() => snpgtCacheFile(cacheid, ds), 'should be accepted by snpgtCacheFile() for the same ds')
	test.throws(
		() => snpgtCacheFile(cacheid, { genomename: 'hg38', label: 'Other' }),
		/invalid cacheid/,
		'should be rejected by snpgtCacheFile() for a different ds'
	)

	const ds2 = { genomename: 'hg38-test', label: 'a.b-c' }
	const cacheid2 = makeCacheid(ds2)
	test.match(cacheid2, /^hg38_test_a_b_c_\d+_\d+$/, 'should replace . and - in the genome and dslabel with _')
	test.doesNotThrow(() => snpgtCacheFile(cacheid2, ds2), 'should be accepted by snpgtCacheFile()')

	test.throws(() => makeCacheid({}), /does not support/, 'should throw for a ds without genomename and label')
	test.end()
})

tape('validate(): snptext', async test => {
	const genome = { snp: { bigbedfile: 'x.bb' }, chrlookup: {} }
	const ds = { queries: { snvindel: { byrange: { _tk: {} } } } }
	const lines = n => Array.from({ length: n }, (_, i) => 'rs' + i).join('\n')

	const tooMany = await validate({ snptext: lines(1001) }, null, ds, genome)
	test.ok(String(tooMany.error).includes('must have 1000 or fewer'), 'should reject more than 1000 lines')

	const noTrack = await validate({ snptext: lines(2) }, null, { queries: {} }, genome)
	test.ok(
		String(noTrack.error).includes('not supported by dataset'),
		'should reject a dataset without a genotype track'
	)

	const notString = await validate({ snptext: ['rs1'] }, null, ds, genome)
	test.ok(String(notString.error).includes('not string'), 'should reject a non-string snptext')
	test.end()
})
