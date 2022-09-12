import { getCompInit } from '#rx'
import { event as d3event } from 'd3-selection'
import { appDrawerInit } from './app'

class MainHeadboxBtn {
	constructor(opts) {
		this.type = 'mainBtn'
		this.opts = this.validateOpts(opts)
		this.dom = opts.dom
		this.state = opts.state
	}

	validateOpts(opts) {
		return opts.app.opts
	}

	async init() {
		try {
			this.drawerFullHeight = ''
		} catch (e) {}
	}

	async main() {
		if (this.state.appBtnActive == true)
			this.drawerFullHeight = this.dom.drawerDiv.node().getBoundingClientRect().height + 5
		makeAppsBtn(this)
	}
}

export const mainBtnInit = getCompInit(MainHeadboxBtn)

async function makeAppsBtn(self) {
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

	// detect whether to show examples right away, which is when the url is barebone without any route paths or search parameters
	// self.state.appBtnActive = window.location.pathname == '/' && !window.location.search.length
	// if an app is loaded when the page opens, delay the loading
	// of examples in order to not affect that loading,
	// otherwise load trigger the loading of examples right away

	//Fix for index.json loading before Apps btn is clicked
	// if (self.state.appBtnActive) {
	//    await appDrawerInit
	// }
}

function slideDrawer(self) {
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
