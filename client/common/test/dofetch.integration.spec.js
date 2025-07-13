import tape from 'tape'
import { dofetch3 } from '../dofetch.js'

/*************************
 reusable helper functions
**************************/

/**************
 test sections
***************/

tape('\n', test => {
	test.comment(`-***- common/dofetch integration -***-`)
	test.end()
})

tape('processFormData', async test => {
	const res1 = await dofetch3('/genomes')
	const res2 = await dofetch3('/genomes')
	test.deepEqual(res1, res2, `should have the same exact response from 2 different requests to /genomes route`)
	test.end()
})
