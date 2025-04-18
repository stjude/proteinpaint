import { getCompInit } from '#rx'
import { layoutInit } from './layout'

/*
.opts{}
    .app{}
	.dom{}
	.state{}

TODOs: 
- Replace drawerFullHeight with a different approach
	- Causes the drawer to only partially appear when the window zooms in
*/

class MainHeadboxBtn {
	constructor(opts) {
		this.type = 'mainBtn'
		this.opts = this.validateOpts(opts)
		this.dom = opts.dom
		this.state = opts.state
		this.hasStatePreMain = true
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

	async init() {
		this.btnRendered = false
		this.drawerFullHeight = ''
		try {
			//detect whether to show examples right away, which is when the url is barebone without any route paths or search parameters
			if (window.location.pathname == '/' && !window.location.search.length)
				await this.app.dispatch({ type: 'is_apps_btn_active', value: true })
			this.components = {
				layout: []
			}
		} catch (e) {
			throw e
		}
	}

	async main(appState) {
		if (this.app.getState(appState).appBtnActive == true && this.btnRendered == false) {
			this.dom.drawerDiv.style('background-color', '#f5f5f5') //Quick fix for drawerDiv initially appearing before layout init
			//Init layout only once when 'Apps' button is active for the first time
			this.components.layout.push(
				await layoutInit({
					app: this.app,
					dom: this.dom,
					state: this.state
				})
			)
			//Give the drawerDiv time to render before calculating height
			setTimeout(() => {
				//Use request animation frame to ensure the drawer is fully rendered
				requestAnimationFrame(() => {
					//Use scrollHeight to get the full height of the drawer,
					//both visible in the viewport and not visible to the user.
					this.drawerFullHeight = this.dom.drawerDiv.node().scrollHeight + 5
				})
			}, this.state.duration + 5)
			slideDrawer(this)
			this.btnRendered = true
		}
		if (this.state.appBtnActive == false && this.btnRendered == true) slideDrawer(this)
	}
}

export const mainBtnInit = getCompInit(MainHeadboxBtn)

function setRenderers(self) {
	self.dom.btnWrapper
		.style('background-color', self.state.appBtnActive ? '#b2b2b2' : '#f2f2f2')
		.style('color', self.state.appBtnActive ? '#fff' : '#000')
		.on('click', async event => {
			event.stopPropagation()
			await self.app.dispatch({ type: 'is_apps_btn_active' })
			slideDrawer(self)
			if (self.state.appBtnActive) {
				setTimeout(() => {
					self.drawerFullHeight = self.dom.drawerDiv.node().scrollHeight + 5
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
		.style('display', 'inline-block')
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

	self.drawerFullHeight = self.dom.drawerRow.node().scrollHeight + 5
}

export async function slideDrawer(self) {
	self.dom.btnWrapper
		.transition()
		.duration(self.opts.state.duration)
		.style('background-color', self.state.appBtnActive ? '#b2b2b2' : '#f2f2f2')
		.style('color', self.state.appBtnActive ? '#fff' : '#000')

	self.dom.btn
		.transition()
		.duration(self.opts.state.duration)
		.style('color', self.state.appBtnActive ? '#fff' : '#000')

	self.dom.drawerDiv
		.style('display', 'inline-block')
		.transition()
		.duration(self.opts.state.duration)
		.style('top', self.state.appBtnActive ? '0px' : '-' + self.drawerFullHeight + 'px')

	self.dom.drawerRow
		.transition()
		.duration(self.opts.state.duration)
		.style('height', self.state.appBtnActive ? self.drawerFullHeight + 'px' : '0px')

	self.dom.drawerHint
		.transition()
		.duration(self.opts.state.duration)
		.style('width', self.state.appBtnActive ? self.opts.state.hintWidth.open : self.opts.state.hintWidth.closed)

	self.dom.drawerArrow
		.transition()
		.duration(self.opts.state.duration)
		.style('opacity', self.state.appBtnActive ? 0 : 1)

	self.dom.drawerArrowOpen
		.style('pointer-events', self.state.appBtnActive ? 'auto' : 'none')
		.transition()
		.duration(self.opts.state.duration)
		.style('opacity', self.state.appBtnActive ? 1 : 0)
}
