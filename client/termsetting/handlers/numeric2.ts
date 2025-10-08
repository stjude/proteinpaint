import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../index.ts'
import type { NumRegularBin, NumCustomBins, NumCont, NumSpline } from '#tw'
import { Tabs } from '#dom'
import { violinRenderer } from '#dom'
// import { setDensityPlot } from './density'

type NumericTabCallback = (event: PointerEvent, tab: TabData) => void

type TabData = {
	mode: 'continuous' | 'discrete' | 'binary' | 'spline'
	label: string
	callback: NumericTabCallback
	contentHolder?: any //
	active?: boolean
}

//
export class NumericHandler extends HandlerBase implements Handler {
	tw: NumRegularBin | NumCustomBins | NumCont | NumSpline
	tabs: TabData[] = []
	vr!: violinRenderer
	density_data!: any
	handlerByType: {
		[twType: string]: Handler
	} = {}
	editHandler!: Handler
	toggleBtns!: Tabs

	dom: {
		[name: string]: any
	} = {}

	constructor(opts) {
		super(opts)
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
		this.tabs = this.setTabs()
	}

	getPillStatus() {
		return this.tw.getStatus(this.termsetting.usecase)
	}

	setTabs() {
		const self = this.termsetting
		const tabs: TabData[] = []
		const callback = async (event, tabData) => {
			if (event) event.stopPropagation()
			await this.setEditHandler(tabData)
			this.dom.editDiv.selectAll('*').remove()
			this.editHandler.showEditMenu(this.dom.editDiv)
		}
		console.log(53, this.tw.q.mode)
		if (self.opts.numericEditMenuVersion.includes('continuous')) {
			tabs.push({
				mode: 'continuous',
				label: self.term.type == 'survival' ? 'Time to Event' : 'Continuous',
				callback
				//active: this.tw.q.mode === 'continuous'
			})
		}

		if (self.opts.numericEditMenuVersion.includes('discrete')) {
			tabs.push({
				mode: 'discrete',
				label: self.term.type == 'survival' ? 'Exit code' : 'Discrete',
				callback
				//active: this.tw.q.mode === 'discrete'
			})
		}

		if (self.opts.numericEditMenuVersion.includes('binary')) {
			tabs.push({
				mode: 'binary',
				label: 'Binary',
				callback
				//active: this.tw.q.mode === 'binary'
			})
		}

		if (self.opts.numericEditMenuVersion.includes('spline')) {
			tabs.push({
				mode: 'spline',
				label: 'Cubic spline',
				callback
				//active: this.tw.q.mode === 'spline'
			})
		}

		return tabs
	}

	async setEditHandler(tabData) {
		if (!this.handlerByType[tabData.mode]) {
			console.log(88, tabData.mode)
			switch (tabData.mode) {
				case 'continuous': {
					const { getHandler } = await import('./NumRegularBin.ts') // TODO
					this.handlerByType.continuous = getHandler(this)
					break
				}
				case 'discrete': {
					const { getHandler } = await import('./NumRegularBin.ts')
					this.handlerByType.discrete = getHandler(this)
					break
				}
				case 'binary': {
					const { getHandler } = await import('./NumRegularBin.ts') // TODO
					this.handlerByType.binary = getHandler(this)
					break
				}
				case 'spline': {
					const { getHandler } = await import('./NumRegularBin.ts') // TODO
					this.handlerByType.spline = getHandler(this)
					break
				}
				default:
					throw `unexpected numeric tabData.mode='${tabData.mode}'`
					break
			}
		}
		this.editHandler = this.handlerByType[tabData.mode]
	}

	async showEditMenu(div) {
		div.selectAll('*').remove()
		const self = this.tw
		for (const t of this.tabs) {
			t.active = self.q.mode == t.mode || (t.mode == 'continuous' && !self.q.mode)
		}

		const topBar = div.append('div').style('padding', '10px')
		topBar.append('span').html('Use as&nbsp;')
		const contentHolder = div.append('div')

		await this.showViolin(div.append('div'))
		this.setEditHandler(this.tabs.find(t => t.active))
		this.dom.editDiv = div.append('div')

		console.log(130, this.tabs, this.density_data)
		if (this.tabs.length > 1) {
			new Tabs({
				holder: topBar.append('div').style('display', 'inline-block'),
				contentHolder,
				noTopContentStyle: true,
				tabs: this.tabs
			}).main()
		}

		//this.editHandler.showEditMenu(this.dom.editDiv)
	}

	async showViolin(div) {
		const self = this.termsetting
		//this.setqDefaults(self)

		div.style('padding', '5px').selectAll('*').remove()

		const loadingDiv = div
			.append('div')
			.style('padding', '10px')
			.style('text-align', 'center')
			.html('Getting distribution data ...<br/>')

		const densityDiv = div.append('div')

		const plot_size = {
			width: 500,
			height: 100,
			xpad: 10,
			ypad: 20,
			radius: 8
		}

		this.density_data = await self.vocabApi.getViolinPlotData(
			{
				tw: { term: self.term, q: self.q },
				svgw: plot_size.width,
				radius: plot_size.radius,
				filter: self.filter
			},
			self.opts.getBodyParams?.()
		)

		loadingDiv.remove()

		this.vr = new violinRenderer({
			holder: densityDiv,
			rd: this.density_data,
			width: plot_size.width,
			height: plot_size.height,
			radius: plot_size.radius
		})

		this.vr.render()
	}
}
