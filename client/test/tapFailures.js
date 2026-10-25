/*
	Tracks the failed assertions in tape's TAP output, which is streamed one console line at a time,
	and formats a compact summary to emit at the end of a long test run:

	- a section is a spec's `test.comment('-***- <title> -***-')`, or else the spec file name
	  as detected in a failure stack
	- each failed assertion is listed under its test name, with its operator, a truncated
	  expected/actual value, and the spec file location from the stack instead of the whole stack

	This module has no dependencies, so that it may also be tested as a client unit spec.
*/

const SECTION = /^# -\*\*\*- (.+) -\*\*\*-$/
// a spec bundle as named by esbuild, e.g. ListSamples.integration.spec-JVL5JXAD.js
const SPEC_FRAME = /\/([^/\s()]+\.(?:unit|integration)\.spec)-[A-Z0-9]+\.js:(\d+):\d+/

export function createTapFailureTracker() {
	const failures = []
	let section = ''
	let testName = ''
	let current // the failure whose YAML block is being parsed
	let yaml // { lines: [], key, inBlock }

	function addLine(line) {
		if (yaml) return addYamlLine(line)
		if (line.startsWith('not ok ')) {
			current = { section, testName, message: line.replace(/^not ok \d+ /, ''), details: {} }
			failures.push(current)
			return
		}
		if (current && line.trim() == '---') {
			yaml = { key: '' }
			return
		}
		current = undefined
		const sectionMatch = SECTION.exec(line)
		if (sectionMatch) {
			section = sectionMatch[1].trim()
			testName = ''
		} else if (line.startsWith('# ') && !isSummaryLine(line)) {
			testName = line.slice(2).trim()
		}
	}

	// the YAML block of a failed assertion, with `key: value` lines and multi-line `key: |-` blocks
	function addYamlLine(line) {
		if (line.trim() == '...') {
			yaml = undefined
			current = undefined
			return
		}
		const keyMatch = /^ {4}([A-Za-z_]+):\s?(.*)$/.exec(line)
		if (keyMatch) {
			const [, key, value] = keyMatch
			yaml.key = key
			current.details[key] = value == '|-' || value == '|' || value == '>-' ? '' : value
		} else if (yaml.key) {
			const text = line.trim()
			current.details[yaml.key] = current.details[yaml.key] ? `${current.details[yaml.key]}\n${text}` : text
		}
	}

	return {
		failures,
		// accepts a console message, which may have more than one line
		add(message) {
			for (const line of String(message).split('\n')) addLine(line)
		},
		format(opts) {
			return formatFailures(failures, opts)
		}
	}
}

function isSummaryLine(line) {
	return /^# (tests|pass|fail|ok|todo|skip)\b/.test(line)
}

export function formatFailures(failures, { maxValueLength = 200, title = 'Failed assertions' } = {}) {
	if (!failures.length) return ''
	const groups = new Map()
	for (const f of failures) {
		const location = getSpecLocation(f.details.stack) || getSpecLocation(f.details.at)
		const sectionTitle = f.section || location?.spec || '(no section title)'
		if (!groups.has(sectionTitle)) groups.set(sectionTitle, { specs: new Set(), tests: new Map() })
		const group = groups.get(sectionTitle)
		if (location?.spec) group.specs.add(location.spec)
		const testName = f.testName || '(no test name)'
		if (!group.tests.has(testName)) group.tests.set(testName, [])
		group.tests.get(testName).push({ ...f, location })
	}

	const testCount = [...groups.values()].reduce((sum, g) => sum + g.tests.size, 0)
	const lines = [`=== ${title}: ${failures.length} in ${testCount} test(s) ===`]
	for (const [sectionTitle, group] of groups) {
		const specs = [...group.specs].filter(spec => spec != sectionTitle)
		lines.push('', `[${sectionTitle}]${specs.length ? ` (${specs.join(', ')})` : ''}`)
		for (const [testName, testFailures] of group.tests) {
			lines.push(`  x ${testName}`)
			for (const f of testFailures) {
				lines.push(`    - ${truncate(f.message, maxValueLength)}`)
				const { operator, expected, actual } = f.details
				if (operator && operator != 'fail') lines.push(`      operator: ${operator}`)
				if (expected !== undefined) lines.push(`      expected: ${truncate(expected, maxValueLength)}`)
				if (actual !== undefined) lines.push(`      actual:   ${truncate(actual, maxValueLength)}`)
				if (f.location) lines.push(`      at: ${f.location.spec} (bundle line ${f.location.line})`)
			}
		}
	}
	return lines.join('\n')
}

// the first stack frame in a spec bundle, not in a shared tape or helper chunk
function getSpecLocation(stack) {
	if (!stack) return
	for (const frame of stack.split('\n')) {
		const m = SPEC_FRAME.exec(frame)
		if (m) return { spec: m[1], line: m[2] }
	}
}

// collapses whitespace, since a large expected/actual value may be a multi-line object
function truncate(value, maxLength) {
	const text = String(value).replace(/\s+/g, ' ').trim()
	return text.length > maxLength ? `${text.slice(0, maxLength)}... (${text.length} chars)` : text
}
