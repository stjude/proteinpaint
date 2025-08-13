import { Tabs } from '#dom'
import { getPillNameDefault, set_hiddenvalues } from '../termsetting'
import { copyMerge } from '#rx'
import type { PillData, HandlerGenerator, Handler } from '../types'
import type { VocabApi } from '#types'
import { roundValueAuto } from '#shared/roundValue.js'
import type {
	NumericQ,
	NumericTW,
	DefaultMedianQ,
	DefaultBinnedQ,
	DefaultNumericQ,
	BinaryNumericQ,
	StartUnboundedBin,
	StopUnboundedBin,
	BinnedNumericQ
} from '#types'

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
	valid_binscheme()
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

export async function fillTW(tw: NumericTW, vocabApi: VocabApi, defaultQ?: DefaultNumericQ) {
	// when missing, defaults mode to discrete
	//const dq = defaultQ as DefaultNumericQ
	if (!tw.q.mode && !(defaultQ as DefaultNumericQ)?.mode) (tw.q as NumericQ).mode = 'discrete'

	if (tw.q.mode !== 'continuous' && !valid_binscheme(tw.q as BinnedNumericQ)) {
		/*
		if q is already initiated, do not overwrite
		to be tested if can work with partially declared state
		always copies from .bins.default
		*/
		copyMerge(tw.q, tw.term.bins.default)
	}

	if (defaultQ) {
		defaultQ.isAtomic = true
		const dmq = defaultQ as DefaultMedianQ
		const dbq = defaultQ as DefaultBinnedQ
		if (dmq.preferredBins == 'median') {
			const q = dmq
			/*
			do following computing to fill the q{} object
			call vocab method to get median value (without filter)
			and create custom list of two bins
			used for cuminc overlay/divideby
			*/
			if (!q.type || q.type != 'custom-bin') throw '.type must be custom-bin when .preferredBins=median'
			const result = await vocabApi.getPercentile(tw.term, [50])
			if (!result.values) throw '.values[] missing from vocab.getPercentile()'
			const median = roundValueAuto(result.values[0])
			if (!Number.isFinite(median)) throw 'median value not a number'
			const medianQ = JSON.parse(JSON.stringify(defaultQ))
			delete medianQ.preferredBins
			tw.q = medianQ as BinaryNumericQ
			tw.q.lst = [
				{
					startunbounded: true,
					stop: median,
					stopinclusive: false,
					label: '<' + median // if label is missing, cuminc will break with "unexpected seriesId", cuminc.js:367
				} as StartUnboundedBin,
				{
					start: median,
					startinclusive: true,
					stopunbounded: true,
					label: '≥' + median
				} as StopUnboundedBin
			]
		} else if (dbq.preferredBins == 'less' || dbq.preferredBins == 'default') {
			/* this flag is true, use term.bins.less
			in this case, defaultQ{} is not an actual q{} object
			*/
			tw.q = JSON.parse(JSON.stringify(tw.term.bins[dbq.preferredBins]))
		} else {
			// defaultQ is an actual q{} object
			// merge it into tw.q
			copyMerge(tw.q, defaultQ)
		}
	}

	set_hiddenvalues(tw.q, tw.term)
}

// return false for failed validation
// TODO this may not be needed as checks are auto-done by ts?
function valid_binscheme(q: BinnedNumericQ) {
	/*if (q.mode == 'continuous') { console.log(472, q)
		// only expect a few keys for now "mode", "scale", "transform" keys for now
		const supportedKeys = ['mode', 'scale', 'transform']
		const unsupportedKeys = Object.keys(q).filter(key => supportedKeys.includes(key))
		if (unsupportedKeys.length) return false 
		// throw `${JSON.stringify(unsupportedKeys)} not supported for q.mode='continuous'`
		return true
	}*/

	if (q.type == 'custom-bin') {
		if (!Array.isArray(q.lst)) return false
		return true
	}
	if (Number.isFinite(q.bin_size) && q.first_bin) {
		if (Number.isFinite(q.first_bin.stop)) return true
	}
	return false
}
