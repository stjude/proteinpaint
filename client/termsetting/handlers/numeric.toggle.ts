import { Tabs } from '#dom'
import { getPillNameDefault } from '../termsetting'
import type { PillData, HandlerGenerator, Handler } from '../types'

/*
********************** EXPORTED
getHandler(self)
	- self: a termsetting instance
	getPillName() // Print term name in the pill
	getPillStatus() // Returns 'cubic spline' or bin-size or custom bin count
	showEditMenu(div) // toogle tabs with continuous edit menu rendered as default 
fillTW()
********************** INTERNAL
	set_hiddenvalues()
*/

type NumericTabCallback = (event: PointerEvent, tab: TabData) => void

type TabData = {
	mode: 'continuous' | 'discrete' | 'binary' | 'spline'
	label: string
	callback: NumericTabCallback
	isRendered?: boolean
	contentHolder?: any //
}

// self is the termsetting instance
export async function getHandler(self) {
	self.tabCallback = async (event: PointerEvent, tab: TabData) => {
		if (!tab) return
		if (!self.q) throw `Missing .q{} [numeric.toggle getHandler()]`
		self.q.mode = tab.mode
		const typeMode = `numeric.${tab.mode}`
		if (!self.handlerByType![typeMode]) {
			const _: HandlerGenerator = await import(`./numeric.${tab.mode}.ts`)
			self.handlerByType![typeMode] = (await _.getHandler(self)) as Handler
		}
		tab.isRendered = true
		await self.handlerByType![typeMode].showEditMenu(tab.contentHolder)
	}
	// set numeric toggle tabs data here as a closure,
	// so that the data is not recreated each time that showEditMenu() is called;
	// also, do not trigger `await import(handler_code)` until needed
	// *** ASSUMES that the numericEditMenuVersion[] remains the same
	//     after pill initialization and throughout its lifetime ***
	const tabs: any = []
	if (self.opts.numericEditMenuVersion!.includes('continuous')) {
		tabs.push({
			mode: 'continuous',
			label: self.term.type == 'survival' ? 'Time to Event' : 'Continuous',
			callback: self.tabCallback
		})
	}

	if (self.opts.numericEditMenuVersion!.includes('discrete')) {
		tabs.push({
			mode: 'discrete',
			label: self.term.type == 'survival' ? 'Exit code' : 'Discrete',
			callback: self.tabCallback
		})
	}

	if (self.opts.numericEditMenuVersion!.includes('spline')) {
		tabs.push({
			mode: 'spline',
			label: 'Cubic spline',
			callback: self.tabCallback
		})
	}

	if (self.opts.numericEditMenuVersion!.includes('binary')) {
		tabs.push({
			mode: 'binary',
			label: 'Binary',
			callback: self.tabCallback
		})
	}

	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			if (!self.q) throw `Missing .q{} [numeric.toggle getPillStatus()]`
			let text = self.q.mode as string
			if (self.q.mode == 'spline') {
				text = 'cubic spline'
			} else if (self.q.mode == 'discrete') {
				if (self.usecase?.target == 'regression') {
					text = 'discrete'
				} else if (self.q.type == 'custom-bin') {
					text = self.q.lst!.length + ' bins'
				} else {
					text = 'bin size=' + self.q.bin_size
				}
			}
			return { text }
		},

		async showEditMenu(div: any) {
			for (const t of tabs) {
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
				tabs
			}).main()
		}
	}
}
