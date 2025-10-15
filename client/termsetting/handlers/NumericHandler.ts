import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../index.ts'
import type { NumRegularBin, NumCustomBins, NumCont, NumSpline } from '#tw'
import { Tabs } from '#dom'
import { NumericDensity } from './NumericDensity.ts'

type NumericTabCallback = (event: PointerEvent, tab: TabData) => void

type TabData = {
	mode: 'continuous' | 'discrete' | 'binary' | 'spline'
	label: string
	callback: NumericTabCallback
	contentHolder?: any //
	active?: boolean
}

/*
	NumericHandler 
	- NumericDensity
	- NumericDiscrete
		 - NumRegularBinEditor
		 - NumCustomBinEditor
*/

export class NumericHandler extends HandlerBase implements Handler {
	opts: any // TODO
	tw: NumRegularBin | NumCustomBins | NumCont | NumSpline
	tabs: TabData[] = []
	handlerByMode: {
		[twType: string]: Handler
	} = {}
	editHandler!: Handler
	toggleBtns!: Tabs

	dom: {
		[name: string]: any
	} = {}

	density: NumericDensity
	density_data!: any

	constructor(opts) {
		super(opts)
		this.opts = opts
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
		this.tabs = this.setTabs()
		this.density = new NumericDensity(opts, this)
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
			//this.dom.editDiv.selectAll('*').remove()
			this.editHandler.showEditMenu(tabData.contentHolder) //this.dom.editDiv)
		}

		if (self.opts.numericEditMenuVersion.includes('continuous')) {
			tabs.push({
				mode: 'continuous',
				label: self.term.type == 'survival' ? 'Time to Event' : 'Continuous',
				callback,
				active: this.tw.q.mode === 'continuous'
			})
		}

		if (self.opts.numericEditMenuVersion.includes('discrete')) {
			tabs.push({
				mode: 'discrete',
				label: self.term.type == 'survival' ? 'Exit code' : 'Discrete',
				callback,
				active: this.tw.q.mode === 'discrete'
			})
		}

		if (self.opts.numericEditMenuVersion.includes('binary')) {
			tabs.push({
				mode: 'binary',
				label: 'Binary',
				callback,
				active: this.tw.q.mode === 'binary'
			})
		}

		if (self.opts.numericEditMenuVersion.includes('spline')) {
			tabs.push({
				mode: 'spline',
				label: 'Cubic spline',
				callback,
				active: this.tw.q.mode === 'spline'
			})
		}

		return tabs
	}

	async setEditHandler(tabData) {
		if (!this.handlerByMode[tabData.mode]) {
			switch (tabData.mode) {
				case 'continuous': {
					const { NumContEditor } = await import('./NumContEditor.ts') // TODO
					this.handlerByMode.continuous = new NumContEditor(this.opts, this)
					break
				}
				case 'discrete': {
					const { NumDiscrete } = await import('./NumDiscrete.ts')
					this.handlerByMode.discrete = new NumDiscrete(this.opts, this)
					break
				}
				case 'binary': {
					const { NumDiscrete } = await import('./NumDiscrete.ts') // TODO
					this.handlerByMode.binary = new NumDiscrete(this.opts, this)
					break
				}
				case 'spline': {
					const { NumDiscrete } = await import('./NumDiscrete.ts') // TODO
					this.handlerByMode.spline = new NumDiscrete(this.opts, this)
					break
				}
				default:
					throw `unexpected numeric tabData.mode='${tabData.mode}'`
					break
			}
		}
		this.editHandler = this.handlerByMode[tabData.mode]
	}

	async showEditMenu(div) {
		div.selectAll('*').remove()

		// const twType = this.termsetting.tw.type
		// if (
		// 	twType == 'NumTWRegularBin' ||
		// 	twType == 'NumTWCustomBin' ||
		// 	twType == 'NumTWCont' ||
		// 	//twType == 'NumTWBinary' ||
		// 	twType == 'NumTWSpline'

		// 	// this.termsetting.tw instanceof NumRegularBin ||
		// 	// this.termsetting.tw instanceof NumCustomBins ||
		// 	// this.termsetting.tw instanceof NumCont ||
		// 	// this.termsetting.tw instanceof NumSpline
		// )
		// throw `invalid numeric tw.type='${twType}'`
		this.tw = this.termsetting.tw as NumRegularBin | NumCustomBins | NumCont | NumSpline // TODO: do not force type
		//console.log(135, 'NumericHandler showEditMenu()')

		const self = this.tw
		for (const t of this.tabs) {
			t.active = self.q.mode == t.mode || (t.mode == 'continuous' && !self.q.mode)
		}

		this.density_data = await this.density.setData()

		const topBar = div.append('div').style('padding', '10px')
		topBar.append('span').html('Use as&nbsp;')
		const contentHolder = div.append('div')

		this.setEditHandler(this.tabs.find(t => t.active))
		this.dom.editDiv = div.append('div')

		if (this.tabs.length > 1) {
			new Tabs({
				holder: topBar.append('div').style('display', 'inline-block'),
				contentHolder,
				noTopContentStyle: true,
				tabs: this.tabs
			}).main()
		}
	}

	applyEdits() {
		this.editHandler.applyEdits()
		this.termsetting.dom.tip.hide()
		this.termsetting.api.runCallback()
	}
}
