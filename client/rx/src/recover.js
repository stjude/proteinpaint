import { getCompInit, toJson, deepFreeze, deepEqual } from '../index.js'

/*
opts:{}
	app:{} (required)
	holder: STR (required)
	maxHistoryLen: INT (optional) 
		- how many states to keep tracked in history
		- history[0] will always be the initial state
*/

class Recover {
	constructor(opts = {}) {
		this.type = 'recover'
		this.initialHolderDisplay = opts.holder.style('display')
		this.dom = {
			holder: opts.holder,
			btnDiv: opts.holder
				.append('div')
				.style('position', 'sticky')
				.style('top', '12px')
				.style('right', '20px')
				.style('margin', opts.margin ? opts.margin : '10px')
				.style('text-align', 'right')
		}
		this.hasStatePreMain = true
		this.reactsTo = opts.reactsTo || (() => true) // could be undefined
		this.getState = opts.getState || (appState => appState)
		// will be used for setTimeout, in case of rapid succession of state changes
		this.debouncedTrack = () => {
			this.trackPending = true
			this.trackState()
			this.render()
		}
		this.wait = 'wait' in opts ? opts.wait : 800
		this.maxHistoryLen = opts.maxHistoryLen || 10
	}

	preApiFreeze(api) {
		api.replaceLastState = appState => {
			if (this.isRecovering) return
			this.state = this.getState(appState)
			if (!this.trackPending) this.history[this.currIndex] = this.state
		}
	}

	init() {
		this.app.register(this.api)
		this.currIndex = -1
		this.history = []
		// turn off during testing of other components for lighter memory usage
		this.isActive = !isNaN(this.maxHistoryLen) && +this.maxHistoryLen > 0
		if (this.isActive) {
			setRenderers(this)
			this.initUi()
		}
		this.eventTypes = ['postInit', 'postRender']
	}

	async main() {
		// assume that the presence of app.opts.state
		// indicates testing, no need for history in that case
		if (!this.isActive) return
		if (this.opts.hide?.(this.state)) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', this.initialHolderDisplay || '')
		if (!this.timedTrack) {
			this.trackState()
			this.trackPending = true
			this.timedTrack = setTimeout(() => {}, this.wait)
			return
		}
		clearTimeout(this.timedTrack)
		this.trackPending = true
		this.timedTrack = setTimeout(this.debouncedTrack, this.wait)
	}

	trackState() {
		if (this.isRecovering) {
			this.isRecovering = false
			return
		}
		if (this.state._scope_ == 'none') return
		this.isRecovering = false
		const state = this.opts.adjustTrackedState ? this.opts.adjustTrackedState(this.state) : this.state
		if (!state) {
			console.error('no state to track')
			return
		}
		if (!Object.isFrozen(state)) deepFreeze(state)

		// the goto() code should not allow currIndex to go back to -1
		if (this.currIndex == -1) this.origState = state

		if (this.currIndex < this.history.length - 1) {
			this.history.splice(this.currIndex, this.history.length - (this.currIndex + 1))
		}

		if (deepEqual(state, this.history[this.history.length - 1])) return
		this.history.push(state)
		this.currIndex += 1

		if (this.history.length > this.maxHistoryLen) {
			// always keep the origState, so remove the 2nd entry in history
			this.history.splice(1, 1)
			this.currIndex += -1
		}
		this.trackPending = false
	}

	goto(i) {
		if (i < 0 && this.currIndex + i > -1) this.currIndex += i
		else if (i > 0 && this.currIndex + i < this.history.length) this.currIndex += i
		else return
		this.isRecovering = true
		const state = this.history[this.currIndex]
		this.render()
		if (this.opts.plot_id) {
			const copy = structuredClone(state)
			this.app.dispatch({ type: 'plot_edit', id: this.opts.plot_id, config: copy.config, _scope_: copy._scope_ })
		} else {
			this.app.dispatch({ type: 'app_refresh', state })
		}
	}

	reset() {
		this.currIndex = 0
		this.isRecovering = true
		const state = this.origState
		if (this.opts.plot_id) {
			const config = state.plots.find(p => p.id === this.opts.plot_id)
			this.app.dispatch({ type: 'plot_edit', id: this.opts.plot_id, config: structuredClone(config) })
		} else this.app.dispatch({ type: 'app_refresh', state })
	}
}

export const recoverInit = getCompInit(Recover)

function setRenderers(self) {
	self.initUi = function () {
		self.dom.undoBtn = self.dom.btnDiv
			.append('button')
			.attr('aria-label', 'undo the previous action')
			.property('disabled', true)
			.style('margin', '0 0 0 4px')
			.style('border', '1px solid #ccc')
			.style('vertical-align', 'middle')
			.html(
				self.opts.undoHtml ||
					`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#000" class="bi bi-arrow-counterclockwise" viewBox="0 0 16 16" style='vertical-align: middle'>
			  <path stroke='#000' stroke-width='0.25' fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
			  <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
			</svg>`
			)
			//.style('padding', '2px')
			.on('click', () => self.goto(-1))

		self.dom.redoBtn = self.dom.btnDiv
			.append('button')
			.attr('aria-label', 'redo a subsequent action')
			.property('disabled', true)
			.style('margin', self.opts.resetHtml ? '0' : '0 4px 0 0')
			.style('border', '1px solid #ccc')
			.style('vertical-align', 'middle')
			.html(
				self.opts.redoHtml ||
					`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#000" class="bi bi-arrow-clockwise" viewBox="0 0 16 16" style='vertical-align: middle'>
			  <path stroke='#000' stroke-width='0.25' fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
			  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
			</svg>`
			)
			//.style('padding', '2px')
			.on('click', () => self.goto(1))

		if (self.opts.resetHtml)
			self.dom.resetBtn = self.dom.btnDiv
				.append('button')
				.attr('aria-label', 'Restore the initial rendered state')
				.property('disabled', true)
				.style('margin', '0 4px 0 0')
				.style('border', '1px solid #ccc')
				.style('vertical-align', 'middle')
				.html(self.opts.resetHtml)
				//.style('padding', '2px')
				.on('click', () => self.reset())
	}

	self.render = function () {
		if (self.dom.undoBtn) self.dom.undoBtn.property('disabled', self.currIndex < 1 || self.history.length === 1)
		if (self.dom.redoBtn)
			self.dom.redoBtn.property('disabled', self.history.length < 2 || self.currIndex >= self.history.length - 1)
		if (self.dom.resetBtn) self.dom.resetBtn.property('disabled', self.currIndex === 0)
	}
}
