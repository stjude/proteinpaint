import { getCompInit } from '#rx'
import { event as d3event } from 'd3-selection'
import { appDrawerInit } from './app'

class MainHeadboxBtn {
	constructor(opts) {
		this.type = 'mainBtn'
		this.opts = this.validateOpts(opts)
		this.dom = opts.dom
		this.state = opts.state
		setRenderers(this)
	}

	validateOpts(opts) {
		return opts.app.opts
	}

	getState(appState) {
		return {
			appBtnActive: appState.appBtnActive
		}
	}

	async init(appState) {
		// this.btnRendered = false
		this.state = this.getState(appState)
		this.appBtnActive = this.state.appBtnActive
		if (this.appBtnActive == false) return
		this.drawerFullHeight = ''
		if (window.location.pathname == '/' && !window.location.search.length) {
			await this.app.dispatch({ type: 'toggle_apps_off', value: true })
			console.log('homepage')
		} else {
			await this.app.dispatch({ type: 'toggle_apps_off', value: false })
		}
	}

	main() {
		// if (this.btnRendered == true) return
		// this.btnRendered = true
		// detect whether to show examples right away, which is when the url is barebone without any route paths or search parameters
		// if (window.location.pathname == '/' && !window.location.search.length) {
		//     this.app.dispatch({ type: 'toggle_apps_off', value: true })
		//     console.log()
		// } else {
		//     this.app.dispatch({ type: 'toggle_apps_off', value: false })
		//     slideDrawer(this)
		// }
	}
}

export const mainBtnInit = getCompInit(MainHeadboxBtn)

function setRenderers(self) {
	console.log('button', self.state.appBtnActive)
	self.dom.btnWrapper
		.style('background-color', self.state.appBtnActive ? '#b2b2b2' : '#f2f2f2')
		.style('color', self.state.appBtnActive ? '#fff' : '#000')
		.on('click', async () => {
			d3event.stopPropagation()
			await self.app.dispatch({ type: 'toggle_apps_off' })
			slideDrawer(self)
			if (self.state.appBtnActive) {
				setTimeout(() => {
					self.drawerFullHeight = self.dom.drawerDiv.node().getBoundingClientRect().height + 5
				}, self.state.duration + 5)
			}
		})

	self.dom.btn
		.attr('class', 'sja_menuoption')
		.style('display', 'inline-block')
		.style('background-color', 'transparent')
		.style('color', self.state.appBtnActive ? '#fff' : '#000')
		.style('padding', self.opts.padw_sm)
		.style('margin', '0px 5px')
		.style('cursor', 'pointer')
		.text('Apps')

	// an empty spacer div, needed since the arrows are absolutely positioned
	self.dom.drawerHint
		.style('position', 'relative')
		.style('display', 'inline-block') //self.state.appBtnActive ? '' : 'inline-block')
		.style('height', self.state.arrowSize.closed + 'px')
		.style('width', self.state.appBtnActive ? self.state.hintWidth.open : self.state.hintWidth.closed)
		.style('background-color', 'transparent')
		.style('text-align', 'center')
		.style('cursor', 'pointer')

	self.dom.drawerArrow
		.style('position', 'absolute')
		.style('font-size', self.state.arrowSize.closed + 'px')
		.style('right', self.state.hintPos.closed.rt + 'px')
		.style('bottom', self.state.hintPos.closed.btm + 'px')
		.style('background-color', 'transparent')
		.style('color', self.state.arrowColor.closed)
		.style('opacity', self.state.appBtnActive ? 0 : 1)
		.style('cursor', 'pointer')
		.html('&#9660;')

	self.dom.drawerArrowOpen
		.style('position', 'absolute')
		.style('font-size', self.state.arrowSize.open + 'px')
		.style('left', self.state.hintPos.open.left + 'px')
		.style('bottom', self.state.hintPos.open.btm + 'px')
		.style('transform', 'rotate(180deg)')
		.style('background-color', 'transparent')
		.style('color', self.state.arrowColor.open)
		.style('opacity', self.state.appBtnActive ? 1 : 0)
		.style('cursor', 'pointer')
		.style('pointer-events', self.state.appBtnActive ? 'auto' : 'none')
		.html('&#9660;')
}

function slideDrawer(self) {
	console.log('slide drawer', self.state.appBtnActive)
	self.dom.btnWrapper
		.transition()
		.duration(self.state.duration)
		.style('background-color', self.state.appBtnActive ? '#b2b2b2' : '#f2f2f2')
		.style('color', self.state.appBtnActive ? '#fff' : '#000')

	self.dom.btn
		.transition()
		.duration(self.state.duration)
		.style('color', self.state.appBtnActive ? '#fff' : '#000')

	self.dom.drawerDiv
		.style('display', 'inline-block')
		.transition()
		.duration(self.state.duration)
		.style('top', self.state.appBtnActive ? '0px' : '-' + self.drawerFullHeight + 'px')

	self.dom.drawerRow
		.transition()
		.duration(self.state.duration)
		.style('height', self.state.appBtnActive ? self.drawerFullHeight + 'px' : '0px')

	self.dom.drawerHint
		.transition()
		.duration(self.state.duration)
		.style('width', self.state.appBtnActive ? self.state.hintWidth.open : self.state.hintWidth.closed)

	self.dom.drawerArrow
		.transition()
		.duration(self.state.duration)
		.style('opacity', self.state.appBtnActive ? 0 : 1)

	self.dom.drawerArrowOpen
		.style('pointer-events', self.state.appBtnActive ? 'auto' : 'none')
		.transition()
		.duration(self.state.duration)
		.style('opacity', self.state.appBtnActive ? 1 : 0)
}
