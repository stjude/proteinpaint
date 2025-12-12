import tape from 'tape'
import { vocabInit } from '#termdb/vocabulary'
//import { TermCollection } from '../termCollection.ts'

/*************************
 reusable helper functions
**************************/

const vocabApi = await vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
if (!vocabApi) console.log(`!!! missing vocabApi !!!`)

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/categorical.unit -***-')
	test.end()
})

tape('fill(invalid tw)', async test => {
	// todo
	test.end()
})
