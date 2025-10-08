import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../index.ts'
import type { NumRegularBin, NumCustomBins, NumCont, NumSpline } from '#tw'
import { Tabs } from '#dom'

type NumericTabCallback = (event: PointerEvent, tab: TabData) => void

type TabData = {
	mode: 'continuous' | 'discrete' | 'binary' | 'spline'
	label: string
	callback: NumericTabCallback
	isRendered?: boolean
	contentHolder?: any //
	active?: boolean
}

// Temporary class, to be renamed
export class NumericHandler extends HandlerBase implements Handler {
	tw: NumRegularBin | NumCustomBins | NumCont | NumSpline
	tabs: TabData[]

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
		const callback = (event, tabData) => this.tabCallback(event, tabData)

		if (self.opts.numericEditMenuVersion.includes('continuous')) {
			tabs.push({
				mode: 'continuous',
				label: self.term.type == 'survival' ? 'Time to Event' : 'Continuous',
				callback
			})
		}

		if (self.opts.numericEditMenuVersion.includes('discrete')) {
			tabs.push({
				mode: 'discrete',
				label: self.term.type == 'survival' ? 'Exit code' : 'Discrete',
				callback
			})
		}

		if (self.opts.numericEditMenuVersion!.includes('spline')) {
			tabs.push({
				mode: 'spline',
				label: 'Cubic spline',
				callback
			})
		}

		if (self.opts.numericEditMenuVersion!.includes('binary')) {
			tabs.push({
				mode: 'binary',
				label: 'Binary',
				callback
			})
		}
		return tabs
	}

	async tabCallback(event: PointerEvent, tab: TabData) {
		if (!tab) return
		const self = this.termsetting
		console.log(72, this)
		if (!self.handlerByType[tab.mode]) {
			switch (tab.mode) {
				case 'discrete': {
					const { getHandler } = await import('./numeric.discrete.ts')
					self.handlerByType.discrete = getHandler(self)
					break
				}
				case 'continuous': {
					const { getHandler } = await import('./numeric.continuous.ts')
					self.handlerByType.continuous = getHandler(self)
					break
				}
				case 'binary': {
					const { getHandler } = await import('./numeric.binary.ts')
					self.handlerByType.binary = getHandler(self)
					break
				}
				case 'spline': {
					const { getHandler } = await import('./numeric.spline.ts')
					self.handlerByType.spline = getHandler(self)
					break
				}
				default:
					throw `unknown numeric tab.mode='${tab.mode}'`
			}
		}
		tab.isRendered = true
		await self.handlerByType[tab.mode].showEditMenu(tab.contentHolder)
	}

	async showEditMenu(div) {
		const self = this.tw
		for (const t of this.tabs) {
			// reset the tracked state of each tab data on each call of showEditMenu();
			// NOTE: when clicking on a tab on the parent menu, showEditMenu() will not be called again,
			// so this loop will not be called and the tracked rendered state in the tab.callback will apply
			delete t.isRendered
			t.active = self.q!.mode == t.mode || (t.mode == 'continuous' && !self.q!.mode)
		}

		const topBar = div.append('div').style('padding', '10px')
		topBar.append('span').html('Use as&nbsp;')

		new Tabs({
			holder: topBar.append('div').style('display', 'inline-block'),
			contentHolder: div.append('div'),
			noTopContentStyle: true,
			tabs: this.tabs
		}).main()
	}
}
