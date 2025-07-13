import tape from 'tape'
import { select } from 'd3-selection'
import { recoverInit } from '../src/recover.js'

/*************************
 reusable helper functions
**************************/

async function getAppRecover(state = {}, opts = {}) {
	const app = {
		opts: {
			debug: true,
			recover: Object.assign(
				{
					debug: true
				},
				opts
			)
		},
		dispatch: action => {
			app.state = Object.freeze(structuredClone(action.state))
			api.update({ appState: app.state })
		},
		getState: () => app.state,
		register: () => {},
		deregister: () => {}
	}

	// !!! NOTE !!!
	// actual opts.resetHtml and other defaults may be different within Recover
	// setting values here for testing convenience only
	const testOnlyDefaults = {
		undoHtml: '-UNDO-',
		redoHtml: '-REDO-',
		resetHtml: '-RESET-',
		wait: 0
	}

	const api = await recoverInit(
		Object.assign(
			{
				app,
				holder: getHolder()
			},
			testOnlyDefaults,
			opts
		)
	)

	return {
		app,
		api,
		self: api.Inner
	}
}

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
	test.comment('-***- rx/recover -***-')
	test.end()
})

tape('initial render', async test => {
	const state = { a: 0 }
	// simulate an initialized rx appApi
	{
		const { app, api, self } = await getAppRecover(state, { resetHtml: '' })
		const { undoBtn, redoBtn, resetBtn } = self.dom
		test.equal(resetBtn, undefined, `should not render a reset button if opts.resetHtml is not supplied`)
		test.deepEqual(
			[undoBtn.html(), redoBtn.html()],
			[self.opts.undoHtml, self.opts.redoHtml],
			`should use opts.undoHtml, redoHtml, resetHtml as button labels, if supplied`
		)
		test.equal(self.history.length, 0, `should have no history on init`)
		test.deepEqual(
			[undoBtn.property('disabled'), redoBtn.property('disabled')],
			[true, true],
			`should disable both buttons when there is no history`
		)
		if (test._ok) api.destroy()
	}

	{
		const { app, api, self } = await getAppRecover(state)
		const { undoBtn, redoBtn, resetBtn } = self.dom
		test.equal(resetBtn?.html(), self.opts.resetHtml, `should render a reset button if opts.resetHtml is supplied`)
		if (test._ok) api.destroy()
	}

	test.end()
})

tape('direct api and instance method calls', async test => {
	const state = { a: 0 }
	const { app, api, self } = await getAppRecover(state)
	const { undoBtn, redoBtn, resetBtn } = self.dom

	// the rx store is expected to supply a frozen state copy
	app.state = Object.freeze(structuredClone(state))
	await api.update({ appState: app.state })
	await sleep(0)
	test.deepEqual(self.history[0], state, `should correctly track a copy of the first state`)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled')],
		[true, true],
		`should disable both buttons when there is only 1 entry in the history`
	)

	state.b = 2
	app.state = Object.freeze(structuredClone(state))
	await api.update({ appState: app.state })
	await sleep(0)
	test.deepEqual(self.history[1], state, `should correctly track a copy of the second state`)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled')],
		[false, true],
		`should disable both buttons when there is only 1 entry in the history`
	)

	state.c = 3
	app.state = Object.freeze(structuredClone(state))
	await api.update({ appState: app.state })
	await sleep(0)
	const n = self.history.length
	test.deepEqual(
		self.currIndex,
		n - 1,
		`should match the currIndex with the last index in history, when no undo has been clicked`
	)
	await self.goto(-1)
	await sleep(1)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled')],
		[false, false],
		`should enable both buttons when there only 1 entry in the history`
	)
	test.deepEqual(app.state, self.history[n - 2], `goto(-1) should recover the previous state`)

	await self.goto(1)
	await sleep(1)
	test.deepEqual(app.state, self.history[n - 1], `goto(1) should recover the subsequent state`)

	await self.reset()
	await sleep(1)
	test.deepEqual(app.state, self.history[0], `restore() should reset to the initial state`)

	if (test._ok) api.destroy()
	test.end()
})

tape('triggered button clicks', async test => {
	const state = { a: 0 }
	const { app, api, self } = await getAppRecover(state, { maxHistoryLen: 5 })
	await api.update({ appState: Object.freeze({ a: 1 }) })
	await sleep(0)
	await api.update({ appState: Object.freeze({ b: 2 }) })
	await sleep(0)
	await api.update({ appState: Object.freeze({ c: 3 }) })
	await sleep(0)
	await api.update({ appState: Object.freeze({ d: 4 }) })
	await sleep(0)
	app.state = Object.freeze({ e: 5 })
	await api.update({ appState: app.state })
	await sleep(0)

	const { undoBtn, redoBtn, resetBtn } = self.dom
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
	test.deepEqual(app.state, { d: 4 }, `should recover the correct state on multiple redo clicks`)

	resetBtn.node().click()
	await sleep(0)
	test.deepEqual(
		[undoBtn.property('disabled'), redoBtn.property('disabled'), resetBtn.property('disabled')],
		[true, false, true],
		`should disable the undo and reset buttons on reset`
	)
	test.deepEqual(app.state, { a: 1 }, `should reset to the initial state on reset button click`)

	let i = 0 // prevent infinite loop
	while (self.currIndex < self.history.length - 1) {
		redoBtn.node().click()
		await sleep(0)
		i++
		if (i > self.opts.maxHistoryLen + 1) return
	}
	test.deepEqual(app.state, { e: 5 }, `should recover the last tracked state on multiple redo clicks, after a reset`)
	await api.update({ appState: Object.freeze({ f: 6 }) })
	await sleep(0)
	await api.update({ appState: Object.freeze({ g: 7 }) })
	await sleep(0)
	test.equal(self.history.length, self.maxHistoryLen, `history length should not exceed [opts|self].maxHistoryLen`)
	test.deepEqual(self.history[0], self.origState, `should always keep the initial state as the history[0] entry`)

	if (test._ok) api.destroy()
	test.end()
})
