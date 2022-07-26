import { init_tabs } from '#dom/toggleButtons'
import { getPillNameDefault, set_hiddenvalues } from '#termsetting'
import { copyMerge } from '#rx'

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
export async function getHandler(self) {
	async function callback(div) {
		const tab = this // since this function gets attached to a tab{} entry in tabs[]
		self.q.mode = tab.subType
		const typeSubtype = `numeric.${tab.subType}`
		if (!self.handlerByType[typeSubtype]) {
			const _ = await import(`./handlers/${typeSubtype}.js`)
			self.handlerByType[typeSubtype] = await _.getHandler(self)
		}
		tab.isRendered = true
		await self.handlerByType[typeSubtype].showEditMenu(div)
	}

	// set numeric toggle tabs data here as a closure,
	// so that the data is not recreated each time that showEditMenu() is called;
	// also, do not trigger `await import(handler_code)` until needed
	// *** ASSUMES that the numericEditMenuVersion[] remains the same
	//     after pill initialization and throughout its lifetime ***
	const tabs = []
	if (self.opts.numericEditMenuVersion.includes('continuous')) {
		tabs.push({
			subType: 'continuous',
			label: 'Continuous',
			callback
		})
	}

	if (self.opts.numericEditMenuVersion.includes('discrete')) {
		tabs.push({
			subType: 'discrete',
			label: 'Discrete',
			callback
		})
	}

	if (self.opts.numericEditMenuVersion.includes('spline')) {
		tabs.push({
			subType: 'spline',
			label: 'Cubic spline',
			callback
		})
	}

	if (self.opts.numericEditMenuVersion.includes('binary')) {
		tabs.push({
			subType: 'binary',
			label: 'Binary',
			callback
		})
	}

	return {
		getPillName(d) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			let text = self.q.mode
			if (self.q.mode == 'spline') {
				text = 'cubic spline'
			} else if (self.q.mode == 'discrete') {
				if (self.q.type == 'custom-bin') {
					text = self.q.lst.length + ' bins'
				} else {
					text = 'bin size=' + self.q.bin_size
				}
			}
			return { text }
		},

		async showEditMenu(div) {
			div.style('padding', '10px')

			for (const t of tabs) {
				// reset the tracked state of each tab data on each call of showEditMenu();
				// NOTE: when clicking on a tab on the parent menu, showEditMenu() will not be called again,
				// so this loop will not be called and the tracked rendered state in the tab.callback will apply
				delete t.isRendered
				t.active = self.q.mode == t.subType || (t.subType == 'continuous' && !self.q.mode)
			}

			const topBar = div.append('div')
			topBar.append('span').html('Use as&nbsp;')

			init_tabs({
				holder: topBar.append('div').style('display', 'inline-block'),
				contentHolder: div.append('div'),
				tabs
			})
		}
	}
}

export function fillTW(tw, vocabApi) {
	if (tw.q?.mode !== 'continuous' && !valid_binscheme(tw.q)) {
		/*
		if q is already initiated, do not overwrite
		to be tested if can work with partially declared state
		always copies from .bins.default
		*/

		// rounding and label_offset may have to defined separately within bins.default or bins.less,
		// for now assume that the same values will apply to both bins.default and .less
		if (tw.term.bins.rounding) tw.term.bins.default.rounding = tw.term.bins.rounding
		if (tw.term.bins.label_offset) tw.term.bins.default.label_offset = tw.term.bins.label_offset
		copyMerge(tw.q, tw.term.bins.default)
	}
	set_hiddenvalues(tw.q, tw.term)
	// binconfig.termtype may be used to improve bin labels
	//if (!tw.q.termtype) tw.q.termtype = term.type
}

function valid_binscheme(q) {
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
		if (!q.mode) q.mode = 'discrete'
		return true
	}
	if (Number.isFinite(q.bin_size) && q.first_bin) {
		if (!q.mode) q.mode = 'discrete'
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

function getQlst() {
	/*
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
	*/
}
