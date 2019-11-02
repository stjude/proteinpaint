const rx = require('./core')

class Recover {
	constructor(app, opts) {
		this.opts = this.opts
		this.app = app
		this.api = rx.getComponentApi(this)
		this.app = app

		this.dom = {
			holder: opts.holder
				.append('div')
				.style('position', 'sticky')
				.style('top', '12px')
				.style('right', '20px')
				.style('margin', '5px')
				.style('text-align', 'right')
		}

		this.currIndex = -1
		this.history = []
		// only activate if there is no app.opts.state[.tree],
		// which is assumed to indicate testing other components
		// no need for history and thus lighter testing
		this.isActive = !isNaN(this.app.opts.maxRecoverableHistory) && +this.app.opts.maxRecoverableHistory > 0
		if (this.isActive) {
			setRenderers(this)
			this.initUi()
		}
		this.bus = new rx.Bus('recover', ['postInit', 'postRender'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	async main() {
		// assume that the presence of app.opts.state
		// indicates testing, no need for history in that case
		if (!this.isActive) return
		this.trackState()
		this.render()
		if (this.projectName) this.saveState()
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

		if (this.history.length > this.app.opts.maxRecoverableHistory) {
			this.history.shift()
			this.currIndex += -1
		}
	}

	goto(i) {
		if (i < 0 && this.currIndex + i > -1) this.currIndex += i
		else if (i > 0 && this.currIndex + i < this.history.length) this.currIndex += i
		else return
		this.isRecovering = true
		const state = this.history[this.currIndex] //console.log(state)
		this.app.dispatch({ type: 'app_refresh', state })
	}

	setProjectName() {
		if (this.value == self.projectName) return
		if (self.projectName) self.saveState()
		self.projectName = this.value
		const nameStr = window.localStorage.getItem('tdbProjectNames')
		const names = nameStr ? JSON.parse(nameStr) : []
		if (!names.includes(self.projectName)) names.push(self.projectName)
		window.localStorage.setItem('tdbProjectNames', JSON.stringify(names))
		const state = JSON.parse(window.localStorage.getItem('tdbState-' + self.projectName))
		self.api.dispatch({ type: 'app_refresh', state })
	}

	saveState() {
		//console.log(152, 'save', self.projectName)
		if (!self.projectName) return
		window.localStorage.setItem('tdbState-' + self.projectName, rx.toJson(self.state))
		//self.dom.saveBtn.style('background-color', '#008a1c')
	}
}

function setRenderers(self) {
	self.initUi = function() {
		self.dom.undoBtn = self.dom.holder
			.append('button')
			.html('undo')
			.style('margin', '2px 5px')
			.on('click', () => self.goto(-1))

		self.dom.redoBtn = self.dom.holder
			.append('button')
			.html('redo')
			.style('margin', '2px 5px')
			.on('click', () => self.goto(1))
		/*
		self.dom.projectBtn = self.dom.holder.append('button')
			.html("project")
			.style('margin', '2px 5px')
			.on('click', self.openMenu)

		//label.append('span').html('Project')
		
		/*
		label.append('input')
			.attr('type', 'text')
			.attr('placeholder', 'project name')
			.attr('title', 'Enter a project name to save/recover your current/previous views')
			.on('change', self.setProjectName)
		*/
	}

	self.render = function() {
		self.dom.undoBtn.property('disabled', self.currIndex < 1)
		self.dom.redoBtn.property('disabled', self.history.length < 2 || self.currIndex >= self.history.length - 1)
	}
}

exports.recoverInit = rx.getInitFxn(Recover)
