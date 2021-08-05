const tape = require('tape')
const d3s = require('d3-selection')

/***********************************
 reusable helper vars and functions
************************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}

// holder: a dom element
// test: tape.test assert API
// label: label to attach to the test message
// minNumElems: the min number of expected elem counts in an SVG
function hasElem(holder, test, label, selector, minNumElem = 0) {
	const numElem = holder.querySelectorAll(selector).length
	test.true(
		numElem >= minNumElem,
		`should render  at least ${minNumElem} ${selector} element${
			minNumElem > 1 ? 's' : ''
		} for ${label}, actual ${numElem}`
	)
	//if (test._ok) holder.remove()
}

const eventCallbacks = {
	// postRender event handling are coded in branch issue-455
	// bigwig: 'postRender.test'
	// Lollipop: 'postRender.test'
}

// if a type or Example.name is not found in elemToTest,
// then the default test is to test for
// 1 svg element per runpp() call in an example
const elemToTest = {
	// for image tests, do not count nativeTracks here as
	// that is detected in runargs and added to the test automatically

	// by example.name
	Lollipop: { circle: 10 },
	'Sample Scatterplot': { circle: 10 },
	ASE: { rect: 20, line: 20 },

	// by track.type
	junction: { circle: 2 },
	mdsjunction: { circle: 2 },
	bigwig: { image: 1 },
	aicheck: { image: 1 },
	profilegenevalue: { image: 1 },
	bigwigstranded: { image: 1 },
	bigwig: { image: 1 },
	bedj: { image: 1 },
	hicstraw: { image: 1 },
	bam: { image: 1 },
	profilegenevalue: { image: 1 }
}

const excludedExamples = ['Hi-C', 'Single Cell']

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb/examples -***-')
	test.end()
})

/* 
	async test callbacks are not handled properly by tape,
	it does not seem to `await callback(test)`
*/
tape('examplejson', test => {
	const dataMessage = 'should download and parse examplejson'
	fetch('/examplejson')
		.then(r => r.json())
		.then(data => {
			test.pass(dataMessage)
			runTests(data, test)
		})
		.catch(e => {
			test.fail(dataMessage + ': ' + e)
		})
})

function runTests(data, test) {
	// 1. Plan the tests
	// Track examples that are testable and how they should be tested
	const testable = []
	let numPlannedTests = 1 // including the examplejson download
	for (const x of data.examples) {
		if (!x.ppcalls || x.hidden || excludedExamples.includes(x.name)) continue
		// to limit to a particular test, uncomment the line below
		// if (!['ASE'].includes(x.name)) continue

		if (!Array.isArray(x.ppcalls)) {
			test.fail('ppcalls should be an array for ' + x.name)
		} else {
			for (const call of x.ppcalls) {
				if (typeof call.runargs !== 'object') {
					test.fail('runargs is not object for ' + call.label)
				} else if (!x.sandbox.is_ui) {
					const tracks = call.runargs.tracks || []
					// for tracks, use callback tests only if there is one track
					// otherwise, use timed tests
					const useCallback = (tracks.length === 1 && tracks[0].type in eventCallbacks) || x.name in eventCallbacks
					const expected = getExpected({ x, call })
					numPlannedTests += Object.keys(expected).length
					testable.push({ x, call, useCallback, expected })
				}
			}
		}
	}

	if (!testable.length) {
		test.fail('no testable examples')
		test.end()
		return
	}

	test.plan(numPlannedTests)
	const numTests = testable.length
	const numSeconds = 6 // number of seconds for each example to fully render
	// since tracks are rendered in parallel, the total render time
	// is not additive, so lower the expected number of seconds
	test.timeoutAfter(numSeconds * 1000 * Math.max(2, Math.ceil(numTests / 4)))

	// 2. Recursively run tests with a limited number of concurrency
	let numCallsStarted = 0
	let numCallsTested = 0
	mayRunOneCall()

	function mayRunOneCall() {
		if (!testable.length) {
			if (numCallsTested >= numTests) test.end()
			return
		}

		// limit the number of concurrent pending tests
		if (numCallsStarted - numCallsTested > 4) return

		const t = testable.shift()
		if (t.useCallback) runCallbackTest(t)
		else runTimedTest(t)
		mayRunOneCall()
	}

	function runCallbackTest(t) {
		const holder = getHolder()
		const arg = { holder, host: window.location.origin }
		const callback = tkInstance => {
			numCallsTested++
			for (const selector in t.expected) {
				hasElem(holder, test, t.x.name, selector, t.expected[selector])
			}
			mayRunOneCall()
		}

		if (t.call.runargs.tracks) {
			const tk = t.call.runargs.tracks[0]
			if (!tk.callbacks) tk.callbacks = {}
			const eventName = eventCallbacks[tk.type]
			tk.callbacks[eventName] = callback
		} else {
			if (!arg.callbacks) arg.callbacks = {}
			if (!arg.callbacks.block) arg.callbacks.block = {}
			const eventName = eventCallbacks[t.x.name]
			arg.callbacks.block[eventName] = callback
		}

		numCallsStarted++
		runproteinpaint(Object.assign(arg, t.call.runargs))
	}

	function runTimedTest(t) {
		const holder = getHolder()
		const arg = { holder, host: window.location.origin }

		setTimeout(() => {
			numCallsTested++
			for (const selector in t.expected) {
				hasElem(holder, test, t.x.name, selector, t.expected[selector])
			}
			mayRunOneCall()
		}, numSeconds * 1000)

		numCallsStarted++
		runproteinpaint(Object.assign(arg, t.call.runargs))
	}
}

function getExpected(t) {
	// will delete unused 'svg' or 'image' key later
	const expected = { svg: 0, image: 0 }

	if (t.call.runargs.nativetracks) expected.image++

	if (t.x.name in elemToTest) {
		for (const selector in elemToTest[t.x.name]) {
			if (!(selector in expected)) expected[selector] = 0
			expected[selector] += elemToTest[t.x.name][selector]
		}
	} else {
		if (t.call.runargs.tracks) {
			for (const tk of t.call.runargs.tracks) {
				const label = t.x.name + ' ' + tk.type
				if (tk.type in elemToTest) {
					for (const selector in elemToTest[tk.type]) {
						if (!(selector in expected)) expected[selector] = 0
						expected[selector] += elemToTest[tk.type][selector]
					}
				} else {
					expected.svg++
				}
			}
		} else {
			expected.svg++
		}
	}

	for (const selector in expected) {
		if (!expected[selector]) delete expected[selector]
	}

	return expected
}
