import tape from 'tape'
import { dofetch3 } from '../dofetch.js'

/*************************
 reusable helper functions
**************************/

const text2buf = new TextEncoder()

/**************
 test sections
***************/

console.log(`-***- common/dofetch integration -***-`)

tape('processFormData', async test => {
	const res1 = await dofetch3('/genomes')
	const res2 = await dofetch3('/genomes')
	test.deepEqual(res1, res2, `should have the same exact response from 2 different requests to /genomes route`)
	test.end()
})
