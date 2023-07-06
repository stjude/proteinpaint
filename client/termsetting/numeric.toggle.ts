import { Tabs } from '#dom/toggleButtons'
import { getPillNameDefault, set_hiddenvalues } from '#termsetting'
import { copyMerge } from '#rx'
import { PillData, TW, TermSettingInstance, VocabApi, NumericQ } from '#shared/types'

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

// self is the termsetting instance
export async function getHandler(self: TermSettingInstance) {
	self.tabCallback = async (event: any, tab: any) => {
		if (!tab) return
		if (!self.q) throw `Missing .q{} [numeric.toggle getHandler()]`
		self.q.mode = tab.subType
		const typeSubtype = `numeric.${tab.subType}`
		if (!self.handlerByType![typeSubtype]) {
			const _ = await import(`./handlers/${typeSubtype}.ts`)
			self.handlerByType![typeSubtype] = await _.getHandler(self)
		}
		tab.isRendered = true
		await self.handlerByType![typeSubtype].showEditMenu(tab.contentHolder)
	}
	// set numeric toggle tabs data here as a closure,
	// so that the data is not recreated each time that showEditMenu() is called;
	// also, do not trigger `await import(handler_code)` until needed
	// *** ASSUMES that the numericEditMenuVersion[] remains the same
	//     after pill initialization and throughout its lifetime ***
	const tabs: any = []
	if (self.opts.numericEditMenuVersion!.includes('continuous')) {
		tabs.push({
			subType: 'continuous',
			label: 'Continuous',
			callback: self.tabCallback
		})
	}

	if (self.opts.numericEditMenuVersion!.includes('discrete')) {
		tabs.push({
			subType: 'discrete',
			label: 'Discrete',
			callback: self.tabCallback
		})
	}

	if (self.opts.numericEditMenuVersion!.includes('spline')) {
		tabs.push({
			subType: 'spline',
			label: 'Cubic spline',
			callback: self.tabCallback
		})
	}

	if (self.opts.numericEditMenuVersion!.includes('binary')) {
		tabs.push({
			subType: 'binary',
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
				t.active = self.q!.mode == t.subType || (t.subType == 'continuous' && !self.q!.mode)
			}

			const topBar = div.append('div').style('padding', '10px')
			topBar.append('span').html('Use as&nbsp;')

			new Tabs({
				holder: topBar.append('div').style('display', 'inline-block'),
				contentHolder: div.append('div'),
				tabs
			}).main()
		}
	}
}

export async function fillTW(tw: TW, vocabApi: VocabApi, defaultQ = null) {
	// when missing, defaults mode to discrete
	if (!tw.q.mode && !(defaultQ as NumericQ | null)?.mode) tw.q.mode = 'discrete'

	if (tw.q.mode !== 'continuous' && !valid_binscheme(tw.q)) {
		/*
		if q is already initiated, do not overwrite
		to be tested if can work with partially declared state
		always copies from .bins.default
		*/
		copyMerge(tw.q, tw.term.bins!.default)
	}

	if (defaultQ) {
		//TODO change when Q objects separated out
		;(defaultQ as NumericQ).isAtomic = true
		if ((defaultQ as NumericQ).preferredBins == 'median') {
			/*
			do following computing to fill the q{} object
			call vocab method to get median value (without filter)
			and create custom list of two bins
			used for cuminc overlay/divideby
			*/

			if (!(defaultQ as NumericQ).type || (defaultQ as NumericQ).type != 'custom-bin')
				throw '.type must be custom-bin when .preferredBins=median'
			const result = await vocabApi.getPercentile(tw.term.id!, [50])
			if (!result.values) throw '.values[] missing from vocab.getPercentile()'
			const median = result.values[0]
			if (!Number.isFinite(median)) throw 'median value not a number'
			tw.q = JSON.parse(JSON.stringify(defaultQ))
			delete (tw.q as NumericQ).preferredBins
			tw.q.lst! = [
				{
					startunbounded: true,
					stop: median,
					stopinclusive: false,
					label: '<' + median // if label is missing, cuminc will break with "unexpected seriesId", cuminc.js:367
				},
				{
					start: median,
					startinclusive: true,
					stopunbounded: true,
					label: '≥' + median
				}
			]
		} else if ((defaultQ as NumericQ).preferredBins == 'less') {
			/* this flag is true, use term.bins.less
			in this case, defaultQ{} is not an actual q{} object
			*/
			tw.q = JSON.parse(JSON.stringify(tw.term.bins?.less || tw.term.bins!.default))
		} else {
			// defaultQ is an actual q{} object
			// merge it into tw.q
			copyMerge(tw.q, defaultQ)
		}
	}

	set_hiddenvalues(tw.q, tw.term)
}

function valid_binscheme(q: any) {
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
		if (q.first_bin.startunbounded) {
			if (Number.isInteger(q.first_bin.stop_percentile) || Number.isFinite(q.first_bin.stop)) {
				return true
			}
		} else {
			if (Number.isInteger(q.first_bin.start_percentile) || Number.isFinite(q.first_bin.start)) {
				return true
			}
		}
	}
	return false
}
/*
function getQlst() {
	
	const qlst = self.vocabApi.getCustomTermQLst(self.term).sort((a, b) => (a.name === self.q.name ? -1 : 0))

	const templateQ = JSON.parse(JSON.stringify(self.q))
	delete templateQ.name
	qlst.push(templateQ)

	const div = _div.append('div').style('display', 'grid') //.style('grid-auto-columns', '1fr')
	for (const q of qlst) {
		const qIsActive = q.name && self.q.name === q.name
		div
			.append('div')
			.datum(q)
			.style('margin', '5px')
			.style('text-align', 'center')
			//.style('display', 'inline-block')
			//.style('width', '80%')
			.style('padding', '5px')
			.style('background-color', qIsActive ? '#fff' : '#eee')
			//.style('border', qIsActive ? '1px solid #' : 'none')
			.style('border-radius', '5px')
			.style('font-size', '.9em')
			.style('cursor', qIsActive ? '' : 'pointer')
			.html(!q.name ? 'Redivide bins' : qIsActive ? `Using ${q.name}` : `Use ${q.name}`)
			.on('click', qIsActive ? null : editQ)

		if (q.name) {
			div
				.append('div')
				.style('grid-column', '2/3')
				.style('margin', '5px')
				.style('padding', '5px')
				.style('cursor', 'pointer')
				.style('color', '#999')
				.style('font-size', '.8em')
				.text('DELETE')
				.on('click', async () => {
					await self.vocabApi.uncacheTermQ(self.term, self.q)
					if (q.name === self.q.name) delete self.q.name
					self.dom.tip.hide()
				})
		}
	}

	function editQ(q) {
		if (!q.name) {
			div.selectAll('*').remove()
			showBinsMenu(self, div)
		} else self.runCallback({ q })
	}

	self.renderQNameInput(div, `Binning`)
	
}*/
