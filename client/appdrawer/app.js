import { getAppInit } from '#rx'
import { compLayoutInit } from './layout'
import { cardInit } from './card'
import { buttonInit } from './dsButton'
import { select } from 'd3-selection'
import { event as d3event } from 'd3-selection'
import { dofetch3, sayerror } from '#src/client'
import { appDrawerStoreInit } from './store'

/*
.opts{}
    .holder
    .apps_sandbox_div
    .apps_off()
    .genomes{}
        - client-side genome object
    .indexJson{}

TODOs: 
- Accommodate layout = none
- Update and add documentation link

Questions: 
*/

class AppDrawerApp {
	constructor(opts) {
		this.type = 'app'
		// this.opts = this.validateOpts(opts)
		// this.drawerRendered = false

		const drawerRow = opts.holder
			.append('div')
			.style('position', 'relative')
			.style('overflow-x', 'visible')
			.style('overflow-y', 'hidden')
			.style('height', '0px')
		const sandboxDiv = opts.holder.append('div').style('margin-top', '15px')

		const drawerDiv = drawerRow
			.append('div')
			.style('position', 'relative')
			.style('margin', '0 20px')
			.style('padding', `0 ${opts.padw_sm}`)
			.style('top', `-${window.screen.height}px`)
			.style('display', 'inline-block')
			.style('overflow', 'hidden')
			.style('background-color', '#f5f5f5')
			.style('border-radius', '0px 0px 5px 5px')
			.style('width', '93vw')

		const btnWrapper = opts.headbox
			.append('div')
			.style('position', 'relative')
			.style('display', 'inline-block')
			.style('margin-left', '5px')
			.style('margin-right', '5px')
			.style('border-radius', '5px')

		this.dom = {
			drawerRow,
			sandboxDiv,
			btnWrapper,
			btn: btnWrapper.append('div'),
			drawerHint: btnWrapper.append('div'),
			drawerArrow: btnWrapper.append('div'),
			drawerArrowOpen: btnWrapper.append('div'),
			drawerDiv,
			holder: drawerDiv, //rename
			wrapper: drawerDiv.append('div') //rename
		}
	}

	validateOpts(opts = {}) {
		if (!opts.holder) throw `missing opts.holder in the MassApp constructor argument`
		return opts
	}

	async init() {
		this.drawerRendered = false //move to store
		this.appBtnActive = false //move to store
		this.drawerFullHeight = '1000'
		try {
			if (this.drawerRendered == true) return
			this.drawerRendered = true
			this.store = await appDrawerStoreInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			this.indexJson = await getCardsJson(this.dom.holder)
			this.elements = this.indexJson.elements.filter(e => !e.hidden)
			this.layout = this.indexJson.columnsLayout ? this.indexJson.columnsLayout : null
			addAppsBtn(this, 'Apps', this.padw_sm) //Change to component?
			this.components = {
				layout: await compLayoutInit({ app: this.api, dom: this.dom, index: this.indexJson })
			}
			// this.drawerFullHeight = this.dom.drawerDiv.node().getBoundingClientRect().height + 5
			await this.api.dispatch()
		} catch (e) {
			throw e
		}
	}

	async main() {
		slideDrawer(this)
		loadElements(this)
		return {
			appsOff,
			apps_sandbox_div: this.dom.sandboxDiv
		}
	}
}

export const appDrawerInit = getAppInit(AppDrawerApp)

async function getCardsJson(holder) {
	const re = await dofetch3('/cardsjson')
	if (re.error) {
		sayerror(holder.append('div'), re.error)
		return
	}

	return re.json
}

function appsOff(self) {
	//move to the store
	self.appsBtnActive = false
	if (self.dom.drawerDiv !== undefined) slideDrawer(self)
}

function addAppsBtn(self, btnLabel, padw_sm) {
	self.dom.btnWrapper
		.style('background-color', self.appBtnActive ? '#b2b2b2' : '#f2f2f2')
		.style('color', self.appBtnActive ? '#fff' : '#000')
		.on('click', async () => {
			d3event.stopPropagation()
			self.appBtnActive = !self.appBtnActive
			appDrawerInit
			slideDrawer(self)
			if (self.appBtnActive) {
				setTimeout(() => {
					// self.drawerFullHeight = self.dom.drawerDiv.node().getBoundingClientRect().height + 5
				}, self.state.duration + 5)
			}
		})

	self.dom.btn
		.attr('class', 'sja_menuoption')
		.style('display', 'inline-block')
		.style('background-color', 'transparent')
		.style('color', self.appBtnActive ? '#fff' : '#000')
		.style('padding', padw_sm)
		.style('margin', '0px 5px')
		.style('cursor', 'pointer')
		.text(btnLabel)

	// an empty spacer div, needed since the arrows are absolutely positioned
	self.dom.drawerHint
		.style('position', 'relative')
		.style('display', 'inline-block') //self.appBtnActive ? '' : 'inline-block')
		.style('height', self.state.arrowSize.closed + 'px')
		.style('width', self.appBtnActive ? self.state.hintWidth.open : self.state.hintWidth.closed)
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
		.style('opacity', self.appBtnActive ? 0 : 1)
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
		.style('opacity', self.appBtnActive ? 1 : 0)
		.style('cursor', 'pointer')
		.style('pointer-events', self.appBtnActive ? 'auto' : 'none')
		.html('&#9660;')

	// detect whether to show examples right away, which is when the url is barebone without any route paths or search parameters
	self.appBtnActive = window.location.pathname == '/' && !window.location.search.length
	// if an app is loaded when the page opens, delay the loading
	// of examples in order to not affect that loading,
	// otherwise load trigger the loading of examples right away

	//Fix for index.json loading before Apps btn is clicked
	if (self.appBtnActive) {
		appDrawerInit
	}
}

function slideDrawer(self) {
	self.dom.btnWrapper
		.transition()
		.duration(self.state.duration)
		.style('background-color', self.appBtnActive ? '#b2b2b2' : '#f2f2f2')
		.style('color', self.appBtnActive ? '#fff' : '#000')

	self.dom.btn
		.transition()
		.duration(self.state.duration)
		.style('color', self.appBtnActive ? '#fff' : '#000')

	self.dom.drawerDiv
		.style('display', 'inline-block')
		.transition()
		.duration(self.state.duration)
		.style('top', self.appBtnActive ? '0px' : '-' + self.drawerFullHeight + 'px')

	self.dom.drawerRow
		.transition()
		.duration(self.state.duration)
		.style('height', self.appBtnActive ? self.drawerFullHeight + 'px' : '0px')

	self.dom.drawerHint
		.transition()
		.duration(self.state.duration)
		.style('width', self.appBtnActive ? self.state.hintWidth.open : self.state.hintWidth.closed)

	self.dom.drawerArrow
		.transition()
		.duration(self.state.duration)
		.style('opacity', self.appBtnActive ? 0 : 1)

	self.dom.drawerArrowOpen
		.style('pointer-events', self.appBtnActive ? 'auto' : 'none')
		.transition()
		.duration(self.state.duration)
		.style('opacity', self.appBtnActive ? 1 : 0)
}

function loadElements(self) {
	self.elements.forEach(element => {
		const holder = select(self.layout ? `#${element.section} > .sjpp-element-list` : `.sjpp-element-list`)
		if (element.type == 'card' || element.type == 'nestedCard') {
			cardInit({
				app: self.api,
				holder: holder
					.style('display', 'grid')
					.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
					.style('gap', '10px')
					.style('list-style', 'none')
					.style('margin', '15px 0px'),
				element,
				appsOff
				// pageArgs: self.opts
			})
		} else if (element.type == 'dsButton') {
			buttonInit({
				app: self.api,
				holder,
				element,
				appsOff
				// pageArgs: self.opts
			})
		}
	})
}
