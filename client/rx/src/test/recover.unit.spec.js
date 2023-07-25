import tape from 'tape'
import { select } from 'd3-selection'
import { recoverInit } from '../recover.js'

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return select('body')
		.append('div')
		.style('max-width', '500px')
		.style('margin', '10px 30px')
		.style('border', '1px solid #aaa')
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- rx/recover -***-')
	test.end()
})

tape('initial render', async test => {
	const state = { a: 0 }
	const [undoHtml, redoHtml, resetHtml] = ['-UNDO-', '-REDO-', '-RESET-']
	// simulate an initialized rx appApi
	{
		const recover = await recoverInit({
			app: {
				opts: {
					debug: true,
					recover: {
						debug: true
					}
				},
				dispatch: () => {},
				getState: () => state,
				register: () => {}
			},
			holder: getHolder(),
			maxHistoryLen: 10,
			undoHtml,
			redoHtml,
			//resetHtml,
			wait: 0
		})

		const [undoBtn, redoBtn, resetBtn] = [
			recover.Inner.dom.undoBtn,
			recover.Inner.dom.redoBtn,
			recover.Inner.dom.resetBtn
		]
		test.equal(resetBtn, undefined, `should not render a reset button if opts.resetHtml is not supplied`)
		test.deepEqual(
			[undoBtn.html(), redoBtn.html()],
			[undoHtml, redoHtml],
			`should use opts.undoHtml, redoHtml, resetHtml as button labels, if supplied`
		)
		test.equal(recover.Inner.history.length, 0, `should have no history on init`)
		test.deepEqual(
			[undoBtn.property('disabled'), redoBtn.property('disabled')],
			[true, true],
			`should disable both buttons when there is no history`
		)
		if (test._ok) recover.destroy()
	}

	{
		const recover = await recoverInit({
			app: {
				opts: {
					debug: true,
					recover: {
						debug: true
					}
				},
				dispatch: () => {},
				getState: () => state,
				register: () => {}
			},
			holder: getHolder(),
			maxHistoryLen: 10,
			resetHtml,
			wait: 0
		})

		const [undoBtn, redoBtn, resetBtn] = [
			recover.Inner.dom.undoBtn,
			recover.Inner.dom.redoBtn,
			recover.Inner.dom.resetBtn
		]
		test.equal(resetBtn?.html(), resetHtml, `should render a reset button if opts.resetHtml is supplied`)
		if (test._ok) recover.destroy()
	}

	test.end()
})

tape('direct api and instance method calls', async test => {
	const state = { a: 0 }
	const [undoHtml, redoHtml, resetHtml] = ['-UNDO-', '-REDO-', '-RESET-']
	// simulate an initialized rx appApi
	const app = {
		opts: {
			debug: true,
			recover: {
				debug: true
			}
		},
		dispatch: action => {
			app.state = Object.freeze(structuredClone(action.state))
			recover.update({ appState: app.state })
		},
		getState: () => app.state,
		register: () => {}
	}
	const recover = await recoverInit({
		app,
		holder: getHolder(),
		maxHistoryLen: 10,
		undoHtml,
		redoHtml,
		resetHtml,
		wait: 0
	})

	const [undoBtn, redoBtn, resetBtn] = [
		recover.Inner.dom.undoBtn,
		recover.Inner.dom.redoBtn,
		recover.Inner.dom.resetBtn
	]

	// the rx store is expected to supply a frozen state copy
	app.state = Object.freeze(structuredClone(state))
	await recover.update({ appState: app.state })
	await sleep(0)
	test.deepEqual(recover.Inner.history[0], state, `should correctly track a copy of the first state`)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled')],
		[true, true],
		`should disable both buttons when there is only 1 entry in the history`
	)

	state.b = 2
	app.state = Object.freeze(structuredClone(state))
	await recover.update({ appState: app.state })
	await sleep(0)
	test.deepEqual(recover.Inner.history[1], state, `should correctly track a copy of the second state`)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled')],
		[false, true],
		`should disable both buttons when there is only 1 entry in the history`
	)

	state.c = 3
	app.state = Object.freeze(structuredClone(state))
	await recover.update({ appState: app.state })
	await sleep(0)
	const n = recover.Inner.history.length
	test.deepEqual(
		recover.Inner.currIndex,
		n - 1,
		`should match the currIndex with the last index in history, when no undo has been clicked`
	)
	await recover.Inner.goto(-1)
	await sleep(1)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled')],
		[false, false],
		`should enable both buttons when there only 1 entry in the history`
	)
	test.deepEqual(app.state, recover.Inner.history[n - 2], `goto(-1) should recover the previous state`)

	await recover.Inner.goto(1)
	await sleep(1)
	test.deepEqual(app.state, recover.Inner.history[n - 1], `goto(1) should recover the subsequent state`)

	await recover.Inner.reset()
	await sleep(1)
	test.deepEqual(app.state, recover.Inner.history[0], `restore() should reset to the initial state`)

	if (test._ok) recover.destroy()
	test.end()
})

tape('triggered button clicks', async test => {
	const state = { a: 0 }
	const [undoHtml, redoHtml, resetHtml] = ['-UNDO-', '-REDO-', '-RESTORE-']
	// simulate an initialized rx appApi
	const app = {
		opts: {
			debug: true,
			recover: {
				debug: true
			}
		},
		dispatch: action => {
			app.state = Object.freeze(structuredClone(action.state))
			recover.update({ appState: app.state })
		},
		getState: () => app.state,
		register: () => {}
	}
	const recover = await recoverInit({
		app,
		holder: getHolder(),
		maxHistoryLen: 10,
		undoHtml,
		redoHtml,
		resetHtml,
		wait: 0
	})

	await recover.update({ appState: Object.freeze({ a: 1 }) })
	await sleep(0)
	await recover.update({ appState: Object.freeze({ b: 2 }) })
	await sleep(0)
	await recover.update({ appState: Object.freeze({ c: 3 }) })
	await sleep(0)
	await recover.update({ appState: Object.freeze({ d: 4 }) })
	await sleep(0)
	app.state = Object.freeze({ e: 5 })
	await recover.update({ appState: app.state })
	await sleep(0)

	const [undoBtn, redoBtn, resetBtn] = [
		recover.Inner.dom.undoBtn,
		recover.Inner.dom.redoBtn,
		recover.Inner.dom.resetBtn
	]
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled')],
		[false, true],
		`should start with a disabled redo button `
	)

	undoBtn.node().click()
	await sleep(0)
	undoBtn.node().click()
	await sleep(0)
	undoBtn.node().click()
	await sleep(0)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled'), resetBtn.property('disabled')],
		[false, false, false],
		`should enable all buttons`
	)
	test.deepEqual(app.state, { b: 2 }, `should recover the correct state on multiple undo clicks`)

	redoBtn.node().click()
	await sleep(0)
	redoBtn.node().click()
	await sleep(0)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled'), resetBtn.property('disabled')],
		[false, false, false],
		`should enable all buttons`
	)
	test.deepEqual(app.state, { d: 4 }, `should recover the correct state on multiple reset clicks`)

	resetBtn.node().click()
	await sleep(0)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled'), resetBtn.property('disabled')],
		[true, false, true],
		`should disable the undo and reset buttons on reset`
	)
	test.deepEqual(app.state, { a: 1 }, `should reset to the initial state on reset button click`)

	if (test._ok) recover.destroy()
	test.end()
})
