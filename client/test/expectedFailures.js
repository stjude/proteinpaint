/*
	Compares the failed assertions of a test run, as tracked by tapFailures.js, with a list of expected failures, such as
	for an image whose server does not have R or python, see puppet.js and the PP_EXPECTED_FAILURES env variable.

	An expected failure is identified by its section, which is a spec's `test.comment('-***- <title> -***-')` or else
	the spec file name, its test name, and optionally its assertion message; without an assertion, every failed
	assertion of the test is expected. Each entry has a reason, such as 'R: survival.R', so that a reviewer can tell
	why it is expected.

	A spec pattern group that did not complete, such as when a spec hangs after an uncaught error, is identified by its
	pattern, such as 'dir=mds3&name=*', which depends on how puppet.js splits the specs into groups. Its failed
	assertions before the hang are still compared as above.

	This module has no dependencies other than tapFailures.js, so that it may also be tested as a client unit spec.
*/

import { getSpecLocation } from './tapFailures.js'

/** returns the identifying fields of a failure that tapFailures.js tracked */
export function getFailureId(failure) {
	return {
		section:
			failure.section || (getSpecLocation(failure.details?.stack) || getSpecLocation(failure.details?.at))?.spec || '',
		test: failure.testName || '',
		assertion: failure.message
	}
}

/**
 * returns { expected, unexpected, notFailing }: the failures that match an entry of expectedList, the failures that do
 * not, and the entries that no failure matched, which may be removed from the list
 */
export function compareFailures(failures, expectedList) {
	for (const [i, entry] of expectedList.entries()) {
		// a failure has an empty section when its spec has no section comment and its stack has no spec bundle frame
		if (typeof entry.section != 'string') throw `expected failure [${i}] must have a section string`
		for (const key of ['test', 'reason']) {
			if (typeof entry[key] != 'string' || !entry[key]) throw `expected failure [${i}] must have a non-empty ${key}`
		}
		if ('assertion' in entry && typeof entry.assertion != 'string')
			throw `expected failure [${i}].assertion must be a string`
	}
	const matched = new Set()
	const expected = []
	const unexpected = []
	for (const failure of failures) {
		const id = getFailureId(failure)
		const entry = expectedList.find(
			e => e.section == id.section && e.test == id.test && (!('assertion' in e) || e.assertion == id.assertion)
		)
		if (entry) {
			matched.add(entry)
			expected.push({ ...id, reason: entry.reason })
		} else unexpected.push(id)
	}
	return { expected, unexpected, notFailing: expectedList.filter(e => !matched.has(e)) }
}

/**
 * returns { expected, unexpected, notFailing } for the { pattern, phase, assertions } of the groups that did not
 * complete, compared with the expectedList of { pattern, reason }. Only a group that did not complete in its test phase
 * after at least one TAP assertion, such as a spec that hangs, may be expected: an error in the browser setup, the page
 * navigation or the coverage collection, such as a page that is not found, and a test phase without any assertion,
 * such as when the test bundle does not load, are never expected, even for a listed pattern.
 */
export function compareIncompleteGroups(groups, expectedList) {
	for (const [i, entry] of expectedList.entries()) {
		for (const key of ['pattern', 'reason']) {
			if (typeof entry[key] != 'string' || !entry[key])
				throw `expected incomplete group [${i}] must have a non-empty ${key}`
		}
	}
	const expected = []
	const unexpected = []
	for (const { pattern, phase, assertions } of groups) {
		const entry = phase == 'test' && assertions > 0 ? expectedList.find(e => e.pattern == pattern) : undefined
		if (entry) expected.push(entry)
		else unexpected.push({ pattern, phase, assertions })
	}
	// an entry whose group did not complete in another phase is not listed as a group that completed
	const notFailing = expectedList.filter(e => !groups.some(g => g.pattern == e.pattern))
	return { expected, unexpected, notFailing }
}

/** returns the comparisons of compareFailures() and, optionally, compareIncompleteGroups() as lines of text */
export function formatComparison(failures, groups = { expected: [], unexpected: [], notFailing: [] }) {
	const lines = [
		`=== expected failures: ${failures.expected.length} expected, ${failures.unexpected.length} unexpected; ` +
			`incomplete groups: ${groups.expected.length} expected, ${groups.unexpected.length} unexpected ===`
	]
	const add = (title, list, withReason) => {
		if (!list.length) return
		lines.push('', title)
		for (const f of list) {
			const id = f.pattern
				? `${f.pattern}${
						f.phase && f.phase != 'test'
							? ` (in the ${f.phase} step)`
							: f.phase == 'test' && !(f.assertions > 0)
							? ' (before any test ran)'
							: ''
				  }`
				: `[${f.section}] ${f.test}${f.assertion ? ` › ${f.assertion}` : ''}`
			lines.push(`  ${id}${withReason ? `  (${f.reason})` : ''}`)
		}
	}
	add('UNEXPECTED incomplete groups:', groups.unexpected, false)
	add('UNEXPECTED failures:', failures.unexpected, false)
	add('expected incomplete groups:', groups.expected, true)
	add('expected failures:', failures.expected, true)
	add('expected incomplete groups that completed, which may be removed from the list:', groups.notFailing, true)
	add('expected failures that did not fail, which may be removed from the list:', failures.notFailing, true)
	return lines.join('\n')
}
