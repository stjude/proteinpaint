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
	const cacheid = makeCacheid({ genome: 'hg38', dslabel: 'SJLife' })
	test.match(cacheid, /^hg38_SJLife_\d+_\d+$/, 'should join the genome, dslabel, time, and a random number')

	const cacheid2 = makeCacheid({ genome: 'hg38-test', dslabel: 'a.b-c' })
	test.match(cacheid2, /^hg38_test_a_b_c_\d+_\d+$/, 'should replace . and - in the genome and dslabel with _')
	test.doesNotThrow(() => snpgtCacheFile(cacheid2), 'should be accepted by snpgtCacheFile()')
	test.end()
})
