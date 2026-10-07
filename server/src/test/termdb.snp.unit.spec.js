import tape from 'tape'
import { makeCacheid } from '../termdb.snp.js'
import { snpgtCacheFile } from '../utils.js'

/* test sections

makeCacheid()
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
