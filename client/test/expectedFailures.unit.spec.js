import tape from 'tape'
import { compareFailures, compareIncompleteGroups, formatComparison, getFailureId } from './expectedFailures.js'

/**
 * Tests
 * 		compareFailures()
 * 		compareIncompleteGroups()
 * 		formatComparison()
 */

// failures as tracked by tapFailures.js
const failures = [
	{ section: 'plots/survival', testName: 'render survival', message: 'should render 2 series', details: {} },
	{ section: 'plots/survival', testName: 'render survival', message: 'should have a legend', details: {} },
	{ section: 'plots/violin', testName: 'p-values', message: 'should show a p-value table', details: {} },
	{
		section: '',
		testName: 'no section title test',
		message: 'should be true',
		details: {
			stack:
				'Error\n    at Test.<anonymous> (http://localhost:6789/bin/test/ListSamples.integration.spec-JVL5JXAD.js:362:14)'
		}
	}
]

tape('\n', test => {
	test.comment('-***- test/expectedFailures -***-')
	test.end()
})

tape('getFailureId() uses the spec file name when there is no section title', test => {
	test.deepEqual(getFailureId(failures[3]), {
		section: 'ListSamples.integration.spec',
		test: 'no section title test',
		assertion: 'should be true'
	})
	test.end()
})

tape('compareFailures() matches by test, or by test and assertion', test => {
	const expectedList = [
		// every assertion of the test
		{ section: 'plots/survival', test: 'render survival', reason: 'R: survival.R' },
		// only this assertion
		{ section: 'plots/violin', test: 'p-values', assertion: 'another assertion', reason: 'rust: wilcoxon' },
		{ section: 'plots/cuminc', test: 'render cuminc', reason: 'R: cuminc.R' }
	]
	const result = compareFailures(failures, expectedList)
	test.deepEqual(
		result.expected.map(f => f.assertion),
		['should render 2 series', 'should have a legend'],
		'should expect both failed assertions of a test without an assertion'
	)
	test.deepEqual(
		result.unexpected.map(f => f.assertion),
		['should show a p-value table', 'should be true'],
		'should not expect another assertion of a test, or a test that is not listed'
	)
	test.deepEqual(
		result.notFailing.map(e => e.test),
		['p-values', 'render cuminc'],
		'should list the entries that no failure matched'
	)
	test.end()
})

tape('compareFailures() with no failures and no expected failures', test => {
	test.deepEqual(compareFailures([], []), { expected: [], unexpected: [], notFailing: [] })
	test.end()
})

tape('compareFailures() rejects an entry without a section string, test or reason', test => {
	for (const key of ['section', 'test', 'reason']) {
		const entry = { section: 's', test: 't', reason: 'r' }
		delete entry[key]
		test.throws(
			() => compareFailures([], [entry]),
			new RegExp(`must have a (non-empty )?${key}`),
			`should require ${key}`
		)
	}
	test.doesNotThrow(
		() => compareFailures([], [{ section: '', test: 't', reason: 'r' }]),
		'should allow an empty section, of a failure without a section title or spec frame'
	)
	test.throws(
		() => compareFailures([], [{ section: 's', test: 't', reason: 'r', assertion: 1 }]),
		/assertion must be a string/,
		'should require a string assertion'
	)
	test.end()
})

tape('formatComparison() lists the unexpected failures first', test => {
	const text = formatComparison(
		compareFailures(failures.slice(0, 3), [
			{ section: 'plots/survival', test: 'render survival', reason: 'R: survival.R' }
		])
	)
	const lines = text.split('\n')
	test.equal(
		lines[0],
		'=== expected failures: 2 expected, 1 unexpected; incomplete groups: 0 expected, 0 unexpected ==='
	)
	test.ok(
		text.indexOf('UNEXPECTED failures:') < text.indexOf('expected failures:\n'),
		'should list the unexpected before the expected failures'
	)
	test.ok(text.includes('[plots/survival] render survival › should render 2 series  (R: survival.R)'))
	test.end()
})

tape('compareIncompleteGroups() matches by pattern', test => {
	const expectedList = [
		{ pattern: 'dir=mds3&name=*', reason: 'bcftools: snvindel bcf file' },
		{ pattern: 'dir=violin&name=*', reason: 'R: density.R' }
	]
	const result = compareIncompleteGroups(['dir=mds3&name=*', 'dir=src&name=*'], expectedList)
	test.deepEqual(result.expected, [expectedList[0]], 'should expect a listed pattern')
	test.deepEqual(result.unexpected, [{ pattern: 'dir=src&name=*' }], 'should not expect a pattern that is not listed')
	test.deepEqual(result.notFailing, [expectedList[1]], 'should list the entries of groups that completed')
	test.throws(() => compareIncompleteGroups([], [{ pattern: 'x' }]), /must have a non-empty reason/)
	const text = formatComparison(compareFailures([], []), result)
	test.ok(
		text.indexOf('UNEXPECTED incomplete groups:\n  dir=src&name=*') > 0,
		'should list the unexpected incomplete groups'
	)
	test.end()
})
