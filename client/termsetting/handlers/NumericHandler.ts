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
		this.tabs = this.setTabData()
		this.density = new NumericDensity(opts, this)
	}

	getPillStatus() {
		return this.tw.getStatus(this.termsetting.usecase)
	}

	setTabData() {
		const self = this.termsetting
		const tabs: TabData[] = []
		const callback = async (event, tabData) => {
			if (event) event.stopPropagation()
			await this.setEditHandler(tabData)
			//this.dom.editDiv.selectAll('*').remove()
			await this.editHandler.showEditMenu(tabData.contentHolder) //this.dom.editDiv)
		}

		const numTabs = self.opts.numericEditMenuVersion.length
		if (self.opts.numericEditMenuVersion.includes('continuous')) {
			tabs.push({
				mode: 'continuous',
				label: self.term.type == 'survival' ? 'Time to Event' : 'Continuous',
				callback,
				active: this.tw.q.mode === 'continuous' || numTabs === 1
			})
		}

		if (self.opts.numericEditMenuVersion.includes('discrete')) {
			tabs.push({
				mode: 'discrete',
				label: self.term.type == 'survival' ? 'Exit code' : 'Discrete',
				callback,
				active: this.tw.q.mode === 'discrete' || numTabs === 1
			})
		}

		if (self.opts.numericEditMenuVersion.includes('spline')) {
			tabs.push({
				mode: 'spline',
				label: 'Cubic spline',
				callback,
				active: this.tw.q.mode === 'spline' || numTabs === 1
			})
		}

		if (self.opts.numericEditMenuVersion.includes('binary')) {
			tabs.push({
				mode: 'binary',
				label: 'Binary',
				callback,
				active: this.tw.q.mode === 'binary' || numTabs === 1
			})
		}

		return tabs
	}

	async setEditHandler(tabData) {
		if (!this.handlerByMode[tabData.mode]) {
			switch (tabData.mode) {
				case 'continuous': {
					const { NumContEditor } = await import('./NumContEditor.ts')
					this.handlerByMode.continuous = new NumContEditor(this.opts, this)
					break
				}
				case 'discrete': {
					const { NumDiscreteEditor } = await import('./NumDiscreteEditor.ts')
					this.handlerByMode.discrete = new NumDiscreteEditor(this.opts, this)
					break
				}
				case 'binary': {
					const { NumBinaryEditor } = await import('./NumBinaryEditor.ts')
					this.handlerByMode.binary = new NumBinaryEditor(this.opts, this)
					break
				}
				case 'spline': {
					const { NumDiscreteEditor } = await import('./NumDiscreteEditor.ts') // TODO
					this.handlerByMode.spline = new NumDiscreteEditor(this.opts, this)
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
		this.tw = this.termsetting.tw as NumRegularBin | NumCustomBins | NumCont | NumSpline // TODO: do not force type

		const self = this.tw
		for (const t of this.tabs) {
			t.active = this.tabs.length === 1 || self.q.mode == t.mode || (t.mode == 'continuous' && !self.q.mode)
		}

		this.density_data = await this.density.setData()
		await this.setEditHandler(this.tabs.find(t => t.active))
		this.dom.editDiv = div.append('div')

		if (this.tabs.length > 1) {
			this.dom.topBar = this.dom.editDiv.append('div').style('padding', '10px')
			this.dom.topBar.append('span').html('Use as&nbsp;')
			new Tabs({
				holder: this.dom.topBar.append('div').style('display', 'inline-block'),
				contentHolder: this.dom.editDiv.append('div'),
				noTopContentStyle: true,
				tabs: this.tabs
			}).main()
		} else {
			this.editHandler.showEditMenu(div)
		}
	}

	applyEdits() {
		this.editHandler.applyEdits()
		this.termsetting.dom.tip.hide()
		this.termsetting.api.runCallback()
	}

	undoEdits() {
		this.editHandler.undoEdits()
	}
}
