import { getCompInit, toJson } from '../index.js'
import { Menu } from '../../dom/menu.js'

/*
opts:{}
	app:{} (required)
	holder: STR (required)
	maxHistoryLen: INT (required)
*/

class Recover {
	constructor(opts = {}) {
		this.type = 'recover'
		this.dom = {
			holder: opts.holder
				.append('div')
				.style('position', 'sticky')
				.style('top', '12px')
				.style('right', '20px')
				.style('margin', '10px')
				.style('text-align', 'right')
		}
		this.menu = new Menu({ padding: '5px' })
		this.state = opts.getState || (appState => appState)
		this.reactsTo = opts.reactsTo || (() => true) // could be undefined
		this.getState = opts.getState || (appState => appState)
	}

	init() {
		this.currIndex = -1
		this.history = []
		// turn off during testing of other components for lighter memory usage
		this.isActive = !isNaN(this.opts.maxHistoryLen) && +this.opts.maxHistoryLen > 0
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
		this.trackState()
		this.render()
	}

	trackState() {
		if (this.isRecovering) {
			this.isRecovering = false
			return
		}
		this.isRecovering = false
		if (this.currIndex < this.history.length - 1) {
			this.history.splice(this.currIndex, this.history.length - (this.currIndex + 1))
		}
		this.history.push(this.state)
		this.currIndex += 1

		if (this.history.length > this.opts.maxHistoryLen) {
			this.history.shift()
			this.currIndex += -1
		}
	}

	goto(i) {
		if (i < 0 && this.currIndex + i > -1) this.currIndex += i
		else if (i > 0 && this.currIndex + i < this.history.length) this.currIndex += i
		else return
		this.isRecovering = true
		const state = this.history[this.currIndex]
		if (this.opts.plot_id)
			this.app.dispatch({ type: 'plot_edit', id: this.opts.plot_id, config: structuredClone(state.config) })
		else this.app.dispatch({ type: 'app_refresh', state })
	}
}

export const recoverInit = getCompInit(Recover)

function setRenderers(self) {
	self.initUi = function() {
		self.dom.undoBtn = self.dom.holder
			.append('button')
			//Maybe change to bootstrap icon? Add to dom/control.icons
			.html('&#8634;')
			.style('padding', '2px 5px')
			.on('click', () => self.goto(-1))

		self.dom.redoBtn = self.dom.holder
			.append('button')
			.html('&#8635;')
			.style('padding', '2px 5px')
			.on('click', () => self.goto(1))
	}

	self.render = function() {
		self.dom.undoBtn.property('disabled', self.currIndex < 1)
		self.dom.redoBtn.property('disabled', self.history.length < 2 || self.currIndex >= self.history.length - 1)
	}
}
