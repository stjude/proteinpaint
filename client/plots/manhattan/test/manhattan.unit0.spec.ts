import tape from 'tape'
import { ViewModel } from '../viewModel/ViewModel.js'

/**
 * DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING
 * AND MANUAL CHECKS ONLY. Only enable on CI when
 * data is available in TermdbTest.
 *
 * Test:
 *   - Example unit test
 *   - Example integration test
 */

function getViewModel() {
	return new ViewModel({})
}

tape('\n', function (test) {
	//CHANGEME: Update this for the file that is being tested
	test.comment('-***- plots/manhattan/ViewModel -***-')
	test.end()
})

/** Example unit test
 * Please make sure your message works for a passing and failing test.
 * Starting with Should .... is a good way to do this.
 *
 * .skip ignores the test.
 * .only runs only this test
 */
tape.only('Test ViewModel', function (test) {
	test.timeoutAfter(100)
	const viewModel = getViewModel()
	const data = viewModel.formatData()
	test.equal(typeof data, 'object', `Example unit test message: Should create a data object`)

	test.end()
})
