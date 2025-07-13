import tape from 'tape'
import { niceNumLabels } from '../niceNumLabels'

tape('\n', test => {
	test.comment('-***- dom/niceNumberLabels -***-')
	test.end()
})

tape('niceNumLabels', test => {
	test.timeoutAfter(100)
	test.plan(3)

	let nums: number[], result: number[], expected: number[]

	//No decimals, >=10
	nums = [0, 1, 2, 3.4, 4, 5, 6.36, 7, 8, 9, 10]
	result = niceNumLabels(nums)
	expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
	test.deepEqual(result, expected, `Should return a corrected number array with no decimals: ${expected}`)

	//1 decimal, 10-1
	nums = [0, 0.002, 1, 0.23, 0.4]
	result = niceNumLabels(nums)
	expected = [0, 0, 0.2, 0.4, 1]
	test.deepEqual(result, expected, `Should return a corrected number array with 1 decimal: ${expected}`)

	//5 decimals
	nums = [0, 0.0002, 0.0000173485678, 0.00023, 0.000489374598732489]
	result = niceNumLabels(nums)
	expected = [0, 0.00002, 0.0002, 0.00023, 0.00049]
	test.deepEqual(result, expected, `Should return a corrected number array with a max of 5 decimals: ${expected}`)
})
