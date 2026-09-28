import tape from 'tape'
import { labelValidationRun } from '../postOnSlack.ts'

/**
 * Tests
 * 		labelValidationRun()
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- postOnSlack specs -***-')
	test.end()
})

tape('labelValidationRun()', function (test) {
	const message = 'Startup error on: https://pp.example.org \nError: failed'
	test.equal(
		labelValidationRun(message, ['node', 'start.js', 'validate']),
		`[validation run only] ${message}`,
		'should label a message from a validation run'
	)
	test.equal(labelValidationRun(message, ['node', 'start.js']), message, 'should not label a live server message')
	test.equal(
		labelValidationRun(message, ['node', 'start.js', '--validate-something']),
		message,
		'should only match the exact validate argument'
	)
	test.end()
})
