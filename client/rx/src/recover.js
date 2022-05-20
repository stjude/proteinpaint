import { getCompInit, toJson } from '../index'
import { Menu } from '../../dom/menu'

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
	}

	init() {
		this.currIndex = -1
		this.history = []
		// turn off during testing of other components for lighter memory usage
		this.isActive = !isNaN(this.opts.maxHistoryLen) && +this.opts.maxHistoryLen > 0
		if (this.isActive) {
			setInteractivity(this)
			setRenderers(this)
			this.initUi()
		}
		this.eventTypes = ['postInit', 'postRender']
	}

	getState(appState) {
		return appState
	}

	async main() {
		// assume that the presence of app.opts.state
		// indicates testing, no need for history in that case
		if (!this.isActive) return
		this.trackState()
		this.render()
		// if autosave == true
		//if (this.projectName) this.saveState()
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
		const state = this.history[this.currIndex] //console.log(state)
		this.app.dispatch({ type: 'app_refresh', state })
	}
}

export const recoverInit = getCompInit(Recover)

function setRenderers(self) {
	self.initUi = function() {
		self.dom.undoBtn = self.dom.holder
			.append('button')
			.html('undo')
			//.style('margin', '2px 0')
			.on('click', () => self.goto(-1))

		self.dom.redoBtn = self.dom.holder
			.append('button')
			.html('redo')
			//.style('margin', '2px 0')
			.on('click', () => self.goto(1))

		/*self.dom.projectBtn = self.dom.holder
			.append('button')
			.html('Project ...')
			.style('margin', '2px 0')
			.on('click', self.openMenu)

		const table = self.menu.d.append('table')
		const projectRow = table.append('tr')
		projectRow.append('td').html('Project')
		const td0 = projectRow.append('td')
		self.dom.projectInput = td0
			.append('input')
			.attr('type', 'text')
			//.attr('placeholder', '')
			//.on('change', self.openProject)
			.on('input', self.toggleSaveBtn)

		const local = table.append('tr') //.style('padding', '5px').style('text-align', 'center')
		local.append('td').html('Disk')
		const td1 = local.append('td').style('text-align', 'center')
		self.dom.localOpenBtn = td1
			.append('button')
			.style('width', '45%')
			.html('Open')
			.on('click', self.openProject)
		self.dom.localSaveBtn = td1
			.append('button')
			.style('width', '45%')
			.html('Save')
			.on('click', self.saveState)

		const cloud = table.append('tr')
		cloud.append('td').html('Cloud')
		const td2 = cloud.append('td').style('text-align', 'center')
		self.dom.cloudOpenBtn = td2
			.append('button')
			.style('width', '45%')
			.html('Open')
			.on('click', self.openProject)
		self.dom.cloudSaveBtn = td2
			.append('button')
			.style('width', '45%')
			.html('Save')
			.on('click', () => alert('feature under development'))*/
	}

	self.render = function() {
		self.dom.undoBtn.property('disabled', self.currIndex < 1)
		self.dom.redoBtn.property('disabled', self.history.length < 2 || self.currIndex >= self.history.length - 1)
	}

	self.openMenu = function() {
		self.dom.localSaveBtn.property('disabled', self.dom.projectInput.property('value') ? false : true)
		self.dom.cloudOpenBtn.property('disabled', true)
		self.dom.cloudSaveBtn.property('disabled', true) // to-do !self.projectName)
		self.menu.showunder(self.dom.projectBtn.node())
	}

	self.toggleSaveBtn = function() {
		self.dom.localSaveBtn.property('disabled', self.dom.projectInput.property('value') ? false : true)
		self.dom.projectInput.node().focus()
	}
}

function setInteractivity(self) {
	self.openProject = function() {
		const projectName = self.dom.projectInput.property('value')
		if (projectName == self.projectName) return
		self.projectName = 'tdbApp-' + projectName
		const nameStr = window.localStorage.getItem('tdbProjectNames')
		const names = nameStr ? JSON.parse(nameStr) : []
		if (names.includes(projectName)) {
			const state = JSON.parse(window.localStorage.getItem(self.projectName))
			self.app.dispatch({ type: 'app_refresh', state })
		} else {
			alert(`Project=${projectName} not found`)
		}
		self.menu.hide()
	}

	self.saveState = function() {
		const projectName = self.dom.projectInput.property('value')
		if (!projectName) return
		self.projectName = 'tdbApp-' + projectName
		window.localStorage.setItem(self.projectName, toJson(self.state))
		const nameStr = window.localStorage.getItem('tdbProjectNames')
		const names = nameStr ? JSON.parse(nameStr) : []
		if (!names.includes(projectName)) {
			names.push(projectName)
			window.localStorage.setItem('tdbProjectNames', JSON.stringify(names))
		}
	}
}
