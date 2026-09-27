import tape from 'tape'
import { createTapFailureTracker } from './tapFailures.js'

/**
 * Tests
 * 		createTapFailureTracker()
 */

// TAP output lines as emitted by tape, one console message per line
const tapLines = [
	'TAP version 13',
	'# -***- dom/summary/ListSamples -***-',
	'# getData() for term=numeric',
	'ok 1 should return 97 samples',
	'# getData() for term=gene exp',
	'not ok 2 getData() for term=gene exp timed out after 3000ms',
	'  ---',
	'    operator: fail',
	'    stack: |-',
	'      Error: getData() for term=gene exp timed out after 3000ms',
	'          at Test.assert [as _assert] (http://localhost:6789/bin/test/chunk-6LH5HYYL.js:10531:54)',
	'  ...',
	'not ok 3 should match the data object',
	'  ---',
	'    operator: deepEqual',
	'    expected: |-',
	`      { samples: [ ${'"sample", '.repeat(50)}] }`,
	'    actual: |-',
	'      { samples: [] }',
	'    stack: |-',
	'      Error: should match the data object',
	'          at Test.assert [as _assert] (http://localhost:6789/bin/test/chunk-6LH5HYYL.js:10531:54)',
	'          at Test.<anonymous> (http://localhost:6789/bin/test/ListSamples.integration.spec-JVL5JXAD.js:362:14)',
	'  ...',
	'# no section title test',
	'not ok 4 should be true',
	'  ---',
	'    operator: ok',
	'    expected: true',
	'    actual:   false',
	'  ...',
	'',
	'1..4',
	'# tests 4',
	'# pass  1',
	'# fail  3'
]

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- test/tapFailures -***-')
	test.end()
})

tape('createTapFailureTracker() tracks each failed assertion with its section and test name', test => {
	const tracker = createTapFailureTracker()
	for (const line of tapLines) tracker.add(line)
	test.deepEqual(
		tracker.failures.map(f => [f.section, f.testName, f.message]),
		[
			['dom/summary/ListSamples', 'getData() for term=gene exp', 'getData() for term=gene exp timed out after 3000ms'],
			['dom/summary/ListSamples', 'getData() for term=gene exp', 'should match the data object'],
			['dom/summary/ListSamples', 'no section title test', 'should be true']
		],
		'should track the failed assertions, not the passed ones or the summary comments'
	)
	test.equal(tracker.failures[1].details.operator, 'deepEqual', 'should parse a YAML key value')
	test.equal(tracker.failures[1].details.actual, '{ samples: [] }', 'should parse a multi-line YAML value')
	test.end()
})

tape('createTapFailureTracker() accepts a multi-line console message', test => {
	const tracker = createTapFailureTracker()
	tracker.add(tapLines.join('\n'))
	test.equal(tracker.failures.length, 3, 'should track the same failures as when added one line at a time')
	test.end()
})

tape('format() emits a compact failure summary', test => {
	const tracker = createTapFailureTracker()
	for (const line of tapLines) tracker.add(line)
	const summary = tracker.format({ maxValueLength: 40 })
	test.ok(summary.startsWith('=== Failed assertions: 3 in 2 test(s) ==='), 'should count the failures and tests')
	test.ok(
		summary.includes('[dom/summary/ListSamples] (ListSamples.integration.spec)'),
		'should title a section with the spec file detected in a stack'
	)
	test.ok(summary.includes('  x getData() for term=gene exp'), 'should list the failed test name')
	test.ok(summary.includes('      operator: deepEqual'), 'should show a non-fail operator')
	test.ok(/expected: \{ samples: .{20,}\.\.\. \(\d+ chars\)/.test(summary), 'should truncate a large expected value')
	test.ok(summary.includes('at: ListSamples.integration.spec (bundle line 362)'), 'should show the spec frame')
	test.notOk(summary.includes('chunk-6LH5HYYL'), 'should not show the tape stack frames')
	test.equal(createTapFailureTracker().format(), '', 'should be empty when there are no failures')
	test.end()
})
