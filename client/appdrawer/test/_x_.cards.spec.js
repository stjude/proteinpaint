import tape from 'tape'
import * as d3s from 'd3-selection'
import { dofetch3 } from '#common/dofetch'

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

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- server/src/cards -***-')
	test.end()
})

/* 
	async test callbacks are not handled properly by tape,
	it does not seem to `await callback(test)`
*/
tape('cards', test => {
	const dataMessage = "should download and parse each app drawer card's json"
	fetch('/cards/index.json')
		.then(r => r.json())
		.then(data => {
			test.pass(dataMessage)
			runTests(data, test)
		})
		.catch(e => {
			test.fail(dataMessage + ': ' + e)
		})
})

async function runTests(data, test) {
	// 1. Plan the tests
	// Track examples that are testable and how they should be tested
	const testable = [],
		notTested = { hidden: [], nonCards: [] }
	let numPlannedTests = 1 // including the cardsjson download
	for (const x of data.elements) {
		if (x.type != 'card') {
			notTested.nonCards.push(x.name)
			continue
		}
		if (!x.sandboxJson || x.hidden) {
			notTested.hidden.push(x.name)
			continue
		}

		const cardJson = await dofetch3(`/cards/${x.sandboxJson}.json`)
		const ppcalls = cardJson.ppcalls

		// to limit to a particular test, uncomment the line below
		// if (!['RNA splice junction of one sample'].includes(x.name)) continue
		if (!Array.isArray(ppcalls)) {
			test.fail('ppcalls should be an array for ' + x.name)
		} else {
			for (const call of ppcalls) {
				if (typeof call.runargs !== 'object') {
					test.fail('runargs is not object for ' + call.label)
				} else if (!call.isUi) {
					const tracks = call.runargs.tracks || []
					// for tracks, use callback tests only if there is one track
					// otherwise, use timed tests
					const useCallback = (tracks.length === 1 && tracks[0].type in eventCallbacks) || x.name in eventCallbacks
					/*
						an example call must have a testSpec: {selector1: count, ...}
						object in order to trigger testing per call
					*/
					const numElemToTest = Object.keys(call?.testSpec?.expected || {}).length
					if (numElemToTest) {
						numPlannedTests += numElemToTest
						testable.push({ x, call, useCallback })
					} else {
						if (!(x.name in notTested)) notTested[x.name] = []
						notTested[x.name].push(call.label || 'call#' + ppcalls.indexOf(call) + ': no testSpec')
					}
				}
			}
		}
	}

	if (!testable.length) {
		test.fail('no testable examples')
		test.end()
		return
	}

	if (notTested.hidden.length || Object.keys(notTested).length > 1) {
		console.info('Not Tested: ', JSON.stringify(notTested, null, 2))
	}

	test.plan(numPlannedTests)
	const numTests = testable.length
	// default number of seconds for each example to fully render
	const numSeconds = 5
	// since tracks are rendered in parallel, the total render time
	// is not additive, so lower the expected number of seconds to finish
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
		const arg = { holder, host: sessionStorage.getItem('hostURL') }
		const callback = tkInstance => {
			numCallsTested++
			for (const selector in t.call.testSpec.expected) {
				hasElem(holder, test, t.x.name, selector, t.call.testSpec.expected[selector])
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
		const arg = { holder, host: sessionStorage.getItem('hostURL') }
		const wait = t.call?.testSpec?.timeout || 5000

		setTimeout(() => {
			numCallsTested++
			const label = t.x.name + (t.call.label ? ' ' + t.call.label : '')
			for (const selector in t.call.testSpec.expected) {
				hasElem(holder, test, label, selector, t.call.testSpec.expected[selector])
			}
			mayRunOneCall()
		}, wait)

		numCallsStarted++
		runproteinpaint(Object.assign(arg, t.call.runargs))
	}
}
