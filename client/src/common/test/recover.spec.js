const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38'
	},
	debug: 1,
	recover: {
		maxHistoryLen: 8
	}
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb/recover -***-')
	test.end()
})

tape('history processing', function(test) {
	test.timeoutAfter(3000)

	runpp({
		recover: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let s, tree
	function runTests(_recover) {
		const recover = _recover.Inner
		const tree = recover.app.Inner.components.tree
		recover.bus.on('postRender.test', null)

		test.equal(recover.history.length, 1, 'should have one history entry after the initial render')
		test.equal(recover.currIndex, 0, 'should have its currIndex at 0 after the initial render')
		s = [recover.state]

		helpers
			.rideInit({ arg: tree, bus: tree, eventType: 'postRender.test' })
			.use(triggerExpand1)
			.use(triggerExpand2, { wait: 1000 })
			.to(testDispatchedTracking, { arg: recover })
			.use(triggerUndo, { arg: recover, bus: _recover })
			.to(testUndo, { arg: recover, bus: _recover, wait: 20 })
			.done(test)
	}

	function triggerExpand1(tree) {
		tree.Inner.app.dispatch({
			type: 'app_refresh',
			state: { tree: { expandedTermIds: ['root', 'Clinically-assessed Variables'] } }
		})
	}

	let _tree
	function triggerExpand2(tree) {
		tree.Inner.app.dispatch({
			type: 'app_refresh',
			state: { tree: { expandedTermIds: ['root', 'Clinically-assessed Variables', 'ctcae_graded'] } }
		})
		_tree = tree
	}

	function testDispatchedTracking(recover) {
		test.equal(recover.currIndex, 2, 'should have its currIndex at 2- after 2 dispatches')
		test.deepEqual(recover.state, recover.history[2], 'should set the state to the corresponding history entry')
		_tree.on('postRender.test', null)
	}

	function triggerUndo(recover) {
		recover.goto(-1)
	}

	function testUndo(recover) {
		test.equal(recover.currIndex, 1, 'should have its currIndex at 1 after undo')
		test.deepEqual(recover.state, recover.history[1], 'should set the state to the corresponding history entry')
	}
})

tape('rendered buttons', function(test) {
	test.timeoutAfter(1000)

	runpp({
		recover: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let undoBtn, redoBtn
	function runTests(recover) {
		recover.Inner.bus.on('postRender.test', null)

		undoBtn = recover.Inner.dom.holder.selectAll('button').filter(function() {
			return this.innerHTML == 'undo'
		})
		test.equal(undoBtn.size(), 1, 'should have 1 undo button')
		test.true(undoBtn.property('disabled'), 'undo button should should be disabled initially')
		redoBtn = recover.Inner.dom.holder.selectAll('button').filter(function() {
			return this.innerHTML == 'redo'
		})
		test.equal(redoBtn.size(), 1, 'should have 1 redo button')
		test.true(redoBtn.property('disabled'), 'redo button should should be disabled initially')

		helpers
			.rideInit({ arg: recover, bus: recover, eventType: 'postRender.test' })
			.use(dispatchFake1)
			.to(testUndoEnabled)
			.use(triggerUndoClick)
			.to(testRedoEnabled, { wait: 50 })
			.done(test)
	}

	function dispatchFake1(recover) {
		recover.Inner.app.dispatch({
			type: 'app_refresh',
			state: { tree: { expandedTermIds: ['root', 'Clinically-assessed Variables', 'ctcae_graded'] } }
		})
	}

	function testUndoEnabled(recover) {
		test.false(undoBtn.property('disabled'), 'undo button should should be enabled initially')
	}

	function triggerUndoClick() {
		undoBtn.node().click()
	}

	function testRedoEnabled(recover) {
		test.false(redoBtn.property('disabled'), 'redo button should should be enabled initially')
	}
})

tape('stored state recovery', function(test) {
	test.timeoutAfter(2500)
	const projName = 'test-aaa'
	window.localStorage.removeItem(projName)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographic Variables', 'sex'],
				visiblePlotIds: ['sex'],
				plots: {
					sex: {
						id: 'sex',
						term: { id: 'sex' },
						term2: { id: 'diaggrp' }
					}
				}
			}
		},
		tree: {
			callbacks: {
				'postRender.test': saveState
			}
		}
	})

	let initialAppState, recover
	function saveState(tree) {
		tree.on('postRender.test', null)
		initialAppState = tree.Inner.app.getState()
		const recover = tree.Inner.app.Inner.components.recover.Inner
		recover.dom.projectInput.property('value', projName)
		recover.dom.localSaveBtn.node().click() //saveState.call(recover.dom.projectInput.node())

		setTimeout(() => {
			runpp({
				tree: {
					// no state overrides
					callbacks: {
						'postRender.test': runTests
					}
				}
			})
		}, 500)
	}

	function runTests(tree) {
		tree.on('postRender.test', null)
		const recover = tree.Inner.app.Inner.components.recover.Inner
		recover.dom.projectInput.property('value', projName)
		recover.openProject.call(recover.dom.projectInput.node())
		setTimeout(() => {
			test.deepEqual(initialAppState, tree.Inner.app.getState(), 'should open a project with its saved state')
			test.end()
		}, 100)
	}
})
