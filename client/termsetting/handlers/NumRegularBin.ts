//import { keyupEnter } from '#src/client'
import { format } from 'd3-format'
import { setDensityPlot } from './density'
import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins.js'
import { make_radios } from '#dom'
import type { NumRegularBin } from '#tw'
import type { NumDiscrete } from './NumDiscrete.ts'
import type { TermSetting } from '../TermSetting.ts'

export class NumRegularBinEditor {
	tw: NumRegularBin
	editHandler: NumDiscrete
	termsetting: TermSetting
	opts: any
	dom: {
		[elemName: string]: any
	} = {}

	constructor(editHandler) {
		this.editHandler = editHandler
		this.opts = editHandler.opts
		this.tw = editHandler.tw
		this.termsetting = editHandler.termsetting
	}

	main() {}

	render(div) {
		this.showBinsMenu(div)
	}

	async showBinsMenu(div: any) {
		// handler.dom.num_holder = div
		// handler.dom.density_div = div.append('div')
		// handler.dom.bins_div = div.append('div').style('padding', '4px')
		this.setqDefaults(this.editHandler)
		// setDensityPlot(handler)
		this.mayShowValueconversionMsg(div)
		const binsTable = div.append('table')
		this.dom.binsTable = binsTable
		this.renderBinSizeInput(binsTable.append('tr'))
		this.renderFirstBinInput(binsTable.append('tr'))
		this.renderLastBinInputs(binsTable.append('tr'))
	}

	setqDefaults(editHandler) {
		const handler = editHandler.handler
		const self = handler.termsetting
		//const { min, max } = handler.density_data

		//const cache = self.numqByTermIdModeType
		const t = self.term
		//if (!cache[t.id]) cache[t.id] = {}
		//if (self.q && self.q.type && Object.keys(self.q).length>1) return
		if (self.q && !self.q.mode) self.q.mode = 'discrete'
		if (!self.q || self.q.mode !== 'discrete') self.q = {}

		if (!self.q.type) {
			// supply default q.type when missing. important not to always hardcode to "regular-bin". e.g. in gdc, agedx default binning is custom but not regular; for such term defaulting to regular will confuse termsetting ui
			self.q.type = self.term.bins?.default?.type || 'regular-bin'
		}
		//const cacheCopy = JSON.parse(JSON.stringify(cache[t.id].discrete[self.q.type]))
		//self.q = Object.assign(cacheCopy, self.q)
		const bin_size = 'bin_size' in self.q && self.q.bin_size!.toString()
		if (!self.q.rounding && typeof bin_size == 'string' && bin_size.includes('.') && !bin_size.endsWith('.')) {
			const binDecimals = bin_size.split('.')[1].length
			self.q.rounding = '.' + binDecimals + 'f'
		}
		if (self.q.lst) {
			self.q.lst.forEach(bin => {
				if (!('label' in bin)) bin.label = get_bin_label(bin, self.q, self.term.valueConversion)
				if (!('range' in bin)) bin.range = get_bin_range_equation(bin, self.q)
			})
		}
		//*** validate self.q ***//
	}

	mayShowValueconversionMsg(div) {
		const term = this.tw.term
		if (!('valueConversion' in term)) return
		div
			.append('div')
			.style('margin-bottom', '5px')
			.style('opacity', 0.6)
			// TODO: remove forced property
			.text(`Note: using values by the unit of ${term.valueConversion!.fromUnit}.`)
	}

	renderBinSizeInput(tr: any) {
		const handler = this.editHandler.handler
		const self = handler.termsetting
		tr.append('td').style('margin', '5px').style('opacity', 0.5).text('Bin Size')

		const { min, max } = handler.density_data
		const q = this.tw.q
		const origBinSize = q.bin_size

		handler.dom.bin_size_input = tr
			.append('td')
			.append('input')
			.attr('type', 'number')
			.attr('value', 'rounding' in q ? format(q.rounding)(q.bin_size!) : q.bin_size)
			.style('margin-left', '15px')
			.style('width', '100px')
			.style('color', () => (q.bin_size > Math.abs(max - min) ? 'red' : ''))
			.on('change', event => {
				const newValue = Number(event.target.value)
				// must validate input value
				if (newValue <= 0) {
					window.alert('Please enter non-negative bin size.')
					// must reset value in <input>, otherwise the wrong value will be recorded in self.q upon clicking Submit
					event.target.value = origBinSize
					return
				}
				if ((max - min) / newValue > 100) {
					// avoid rendering too many svg lines and lock up browser
					window.alert('Bin size too small. Try setting a bigger value.')
					event.target.value = origBinSize
					return
				}
				q.bin_size = newValue
				handler.dom.bin_size_input.style(
					'color',
					q.bin_size > max - min ? 'red' : newValue != origBinSize ? 'green' : ''
				)
				setDensityPlot(handler)
			})
	}

	renderFirstBinInput(handler, tr: any) {
		const self = handler.termsetting
		if (!self.q.first_bin) throw 'missing q.first_bin'

		tr.append('td').style('margin', '5px').style('opacity', 0.5).text('First Bin Stop')

		const { min, max } = handler.density_data
		const origValue = self.q.first_bin.stop

		handler.dom.first_stop_input = tr
			.append('td')
			.append('input')
			.attr('type', 'number')
			.property('value', origValue)
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('change', event => {
				const newValue = Number(event.target.value)
				if (newValue < min || newValue > max) {
					window.alert('First bin stop value out of bound.')
					event.target.value = origValue
					return
				}

				// first_bin should have already been set; adding the check just to skip the tsc error...
				if (self.q.first_bin) self.q.first_bin.stop = newValue
				self.renderBinLines(self, self.q)
			})

		tr.append('td')
			.append('div')
			.style('font-size', '.6em')
			.style('opacity', 0.5)
			.style('display', self.num_obj.no_density_data ? 'none' : 'block')
			.text('Indicated by left-most red line. Drag to change.')
	}

	renderLastBinInputs(handler, tr: any) {
		const self = handler.termsetting
		// tell if last bin is automatic (not fixed)
		const isAuto = !self.q.last_bin || !Number.isFinite(self.q.last_bin.start)

		tr.append('td')
			.style('padding-top', '4px')
			.style('opacity', 0.5)
			.style('vertical-align', 'top')
			.text('Last Bin Start')

		const { max } = handler.density_data

		const td1 = tr.append('td').style('padding-left', '15px').style('vertical-align', 'top')
		const radio_div = td1.append('div')

		make_radios({
			holder: radio_div,
			options: [
				{ label: 'Automatic', value: 'auto', checked: isAuto },
				{ label: 'Fixed', value: 'fixed', checked: !isAuto }
			],
			callback: v => {
				if (v == 'auto') {
					delete self.q.last_bin
					// if just deleting last_bin.start and keeps q.last_bin{}, density plot may set last_bin.bin='last' and will break bin validation
					edit_div.style('display', 'none')
					self.renderBinLines(self, self.q as NumericQ)
					setDensityPlot(self)
					return
				}
				// v is "fixed", to assign a number to self.q.last_bin.start
				edit_div.style('display', 'inline-block')
				if (!self.q.last_bin) self.q.last_bin = {}

				if (handler.dom.last_start_input.property('value') == '') {
					// blank input, fill max
					handler.dom.last_start_input.property('value', max)
				}
				setLastBinStart()
				setDensityPlot(self)
			}
		})

		const edit_div = tr
			.append('td')
			.append('div')
			.style('display', isAuto ? 'none' : 'inline-block')

		handler.dom.last_start_input = edit_div
			.append('input')
			.attr('type', 'number')
			.property('value', self.q.last_bin ? self.q.last_bin.start : '')
			.style('width', '100px')
			.on('change', setLastBinStart)

		edit_div
			.append('div')
			.style('font-size', '.6em')
			.style('opacity', 0.5)
			.style('display', self.num_obj.no_density_data ? 'none' : 'block')
			.text('Indicated by right-most red line. Drag to change.')

		function setLastBinStart() {
			// only get value from <input>
			const inputValue = Number(handler.dom.last_start_input.property('value'))

			// TODO first_bin should be required
			if (self.q.first_bin && inputValue <= self.q.first_bin.stop) {
				window.alert('Last bin start cannot be smaller than first bin stop.')
				handler.dom.last_start_input.property('value', max)
				return
			}
			if (inputValue > max) {
				window.alert('Last bin start value out of bound.')
				handler.dom.last_start_input.property('value', max)
				return
			}
			if (!self.q.last_bin) self.q.last_bin = {} // this should be fine since it's optional
			self.q.last_bin.start = inputValue
			self.renderBinLines(self, self.q as NumericQ)
		}
	}
}

// function applyEdits(handler) {
// 	const self = handler.termsetting
// 	if (self.q.type == 'regular-bin') {
// 		if (!self.q.first_bin) {
// 			self.q.first_bin = {
// 				stop: Number(handler.dom.first_stop_input.property('value'))
// 			}
// 		}
// 		self.q.startinclusive = handler.dom.boundaryInput.property('value') == 'startinclusive'
// 		self.q.stopinclusive = handler.dom.boundaryInput.property('value') == 'stopinclusive'
// 		const bin_size = handler.dom.bin_size_input.property('value')
// 		self.q.bin_size = Number(bin_size)
// 		if (bin_size.includes('.') && !bin_size.endsWith('.')) {
// 			self.q.rounding = '.' + bin_size.split('.')[1].length + 'f'
// 		} else {
// 			self.q.rounding = '.0f'
// 		}

// 		// don't forward scaling factor from continuous termsetting
// 		if (self.q.scale) delete self.q.scale

// 		if (Number.isFinite(self.q.last_bin?.start)) {
// 			// has valid last_bin.start, it's using fixed last bin
// 		} else {
// 			// no valid value, delete the optional attribute to indicate last bin is automatic
// 			delete self.q.last_bin
// 		}
// 		self.numqByTermIdModeType[self.term.id].discrete['regular-bin'] = JSON.parse(JSON.stringify(self.q))
// 	} else if (self.term.type !== 'survival') {
// 		// do not need to processCustomBinInputs for survival terms
// 		if (handler.dom.bins_table.selectAll('input').node().value) {
// 			self.q.lst = processCustomBinInputs(handler)
// 			self.numqByTermIdModeType[self.term.id].discrete['custom-bin'] = JSON.parse(JSON.stringify(self.q))
// 		}
// 	}
// 	self.q.mode = 'discrete'
// 	handler.dom.tip.hide()
// 	self.api.runCallback()
// }
