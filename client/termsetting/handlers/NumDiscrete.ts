//import { keyupEnter } from '#src/client'
//import { format } from 'd3-format'
import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins.js'
import { Tabs } from '#dom'
//import { getPillNameDefault } from '../utils.ts'
import type { NumericBin } from '#types'
import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../types.ts'
import type { TermSetting } from '../TermSetting.ts'
import type { NumRegularBin, NumCustomBins } from '#tw'
import type { NumericHandler } from './numeric2.ts'
import { NumRegularBinEditor } from './NumRegularBin.ts'
import { NumCustomBinEditor } from './NumCustomBin.ts'

// To show edit menu
export class NumDiscrete extends HandlerBase implements Handler {
	tw: NumRegularBin | NumCustomBins
	termsetting: TermSetting
	handler: NumericHandler
	dom: {
		[name: string]: any
	} = {}
	draggedItem: any
	removedGrp: any
	editedName: any

	editorsByType: {
		'regular-bin'?: NumRegularBinEditor
		'custom-bin': NumCustomBinEditor
	}

	constructor(opts, handler) {
		super(opts)
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
		this.handler = handler
		this.editorsByType = {
			'regular-bin': new NumRegularBinEditor(this),
			'custom-bin': new NumCustomBinEditor(this)
		}
		//this.dom.holder = opts.holder || this.termsetting.dom.tip.d
	}

	getPillStatus() {
		if (!this.tw.q) throw `Missing .q{} [numeric.discrete getPillStatus()]`
		const text = this.tw.q?.name || this.tw.q?.reuseId
		if (text) return { text }
		if (this.tw.q.type == 'regular-bin') return { text: 'bin size=' + this.tw.q.bin_size }
		return { text: this.tw.q.lst.length + ' bins' }
	}

	async showEditMenu(div: any) {
		const handler = this.handler
		//const self = this.termsetting
		this.dom.boundaryInclusionDiv = div.append('div')
		this.dom.binsDiv = div.append('div')

		//handler.dom.density_div = div.append('div')
		//handler.dom.bins_div = div.append('div').style('padding', '4px')
		// this.setqDefaults(handler)
		// setDensityPlot(handler)
		this.renderBoundaryInclusionInput()
		this.renderTypeInputs()
	}

	renderBoundaryInclusionInput() {
		const handler = this.handler
		const self = handler.termsetting
		this.dom.boundaryInclusionDiv.selectAll('*').remove()
		this.dom.boundaryInclusionDiv
			.append('span')
			.style('padding', '5px')
			.style('color', 'rgb(136, 136, 136)')
			.html('Boundary Inclusion')

		const x = '<span style="font-family:Times;font-style:italic">x</span>'

		this.dom.boundaryInput = this.dom.boundaryInclusionDiv
			.append('select')
			.style('margin-left', '10px')
			.on('change', () => {
				const { term, q } = this.tw
				const c =
					q.mode == 'binary'
						? self.numqByTermIdModeType[term.id].binary
						: self.numqByTermIdModeType[term.id].discrete[self.q.type!]

				if (c.type == 'regular-bin') {
					c.startinclusive = this.dom.boundaryInput.node().selectedIndex == 1
					c.stopinclusive = this.dom.boundaryInput.node().selectedIndex == 0
				} else if ('lst' in q) {
					c.lst = q.lst
					c.lst.forEach(bin => {
						bin.startinclusive = this.dom.boundaryInput.node().selectedIndex == 1
						bin.stopinclusive = this.dom.boundaryInput.node().selectedIndex == 0
						bin.label = get_bin_label(bin, self.q, self.term.valueConversion)
						bin.range = get_bin_range_equation(bin, self.q)
					})
					//renderBoundaryInputDivs(self, c.lst)
				}
			})

		this.dom.boundaryInput
			.selectAll('option')
			.data([
				{ value: 'stopinclusive', html: `start &lt; ${x} &le; end` },
				{ value: 'startinclusive', html: `start &le; ${x} &lt; end` }
			])
			.enter()
			.append('option')
			.property('value', d => d.value)
			.property('selected', d => {
				if (this.tw.q.type == 'regular-bin') return this.tw.q[d.value] == true
				else return this.tw.q.lst[0][d.value] == true
			})
			.html(d => d.html)
	}

	renderTypeInputs() {
		//const handler = this.handler
		//const self = handler.termsetting
		const div = this.dom.binsDiv.append('div').style('margin', '10px')

		if (this.tw.term.bins?.default.type == 'custom-bin') {
			/*
			this term's default bin is custom bin! it's without a regular binning config
			cannot render regular/custom bin switchtab, as regular ui will break without that part of data
			only render custom bin ui, and do not allow switching from custom to regular bin size
			*/
			// self.q.type = 'custom-bin'
			// setqDefaults(handler)
			// setDensityPlot(handler)
			// renderCustomBinInputs(handler, div)
			this.editorsByType['custom-bin'].render(div)
			return
		}

		if (this.tw.term.bins?.default.type != 'regular-bin')
			throw 'self.bins.default.type is neither regular-bin or custom-bin, cannot render ui'

		// toggle switch between regular and custom
		const tabs: any = [
			{
				active: this.tw.q.type == 'regular-bin',
				label: 'Same bin size',
				callback: async (_, tab) => {
					// do not overwrite previously rendered inputs
					// that may have been already edited by the user
					if (tab.isInitialized) return
					this.editorsByType['regular-bin']?.render(tab.contentHolder)
				}
			},
			{
				active: this.tw.q.type == 'custom-bin',
				label: 'Varying bin sizes',
				callback: async (event, tab) => {
					// do not overwrite previously rendered inputs
					// that may have been already edited by the user
					if (tab.isInitialized) return
					this.editorsByType['custom-bin']?.render(tab.contentHolder)
				}
			}
		]
		new Tabs({ holder: div, tabs }).main()
	}

	applyEdits() {
		const handler = this.handler
		const self = this.termsetting
		if (self.q.type == 'regular-bin') {
			if (!self.q.first_bin) {
				self.q.first_bin = {
					stop: Number(handler.dom.first_stop_input.property('value'))
				}
			}
			self.q.startinclusive = handler.dom.boundaryInput.property('value') == 'startinclusive'
			self.q.stopinclusive = handler.dom.boundaryInput.property('value') == 'stopinclusive'
			const bin_size = handler.dom.bin_size_input.property('value')
			self.q.bin_size = Number(bin_size)
			if (bin_size.includes('.') && !bin_size.endsWith('.')) {
				self.q.rounding = '.' + bin_size.split('.')[1].length + 'f'
			} else {
				self.q.rounding = '.0f'
			}

			// don't forward scaling factor from continuous termsetting
			if (self.q.scale) delete self.q.scale

			if (Number.isFinite(self.q.last_bin?.start)) {
				// has valid last_bin.start, it's using fixed last bin
			} else {
				// no valid value, delete the optional attribute to indicate last bin is automatic
				delete self.q.last_bin
			}
			self.numqByTermIdModeType[self.term.id].discrete['regular-bin'] = JSON.parse(JSON.stringify(self.q))
		} else if (self.term.type !== 'survival') {
			// do not need to processCustomBinInputs for survival terms
			if (handler.dom.bins_table.selectAll('input').node().value) {
				self.q.lst = processCustomBinInputs(handler)
				self.numqByTermIdModeType[self.term.id].discrete['custom-bin'] = JSON.parse(JSON.stringify(self.q))
			}
		}
		self.q.mode = 'discrete'
		handler.dom.tip.hide()
		self.api.runCallback()
	}
}

function processCustomBinInputs(handler) {
	const self = handler.termsetting
	const startinclusive = handler.dom.boundaryInput.property('value') == 'startinclusive'
	const stopinclusive = handler.dom.boundaryInput.property('value') == 'stopinclusive'
	const inputs = handler.dom.bins_table.node().querySelectorAll('input')

	const inputData = handler.dom.customBinBoundaryInput
		.property('value')
		.split('\n')
		.filter((d: any) => d != '' && !isNaN(d))

	// Fix for when user enters in the same number more than once.
	// UI will ignore duplicate entries completely.
	const trackBins = new Set(inputData)
	if (!trackBins.size) return

	const sortedBins = Array.from(trackBins)
		.map((d: any) => +d)
		.sort((a, b) => a - b)

	const data: NumericBin[] = [
		// first bin: StartUnbounded type
		{
			startunbounded: true,
			stop: sortedBins[0],
			startinclusive: false,
			stopinclusive,
			label: inputs[0].value
		}
	]
	// first bin
	if (!data[0].label) data[0].label = get_bin_label(data[0], self.q, self.term.valueConversion)
	if (!data[0].range) data[0].range = get_bin_range_equation(data[0], self.q)

	for (const [i, d] of sortedBins.entries()) {
		let bin
		const label = inputs[i + 1]?.value || ''
		if (i !== trackBins.size - 1) {
			// intermediate bin: FullyBounded type
			bin = {
				start: +d,
				startinclusive,
				stopinclusive,
				stop: sortedBins[i + 1],
				label,
				range: ''
			}
		} else {
			// last bin: StopUnbounded type
			bin = {
				start: +d,
				startinclusive,
				stopinclusive: false,
				stopunbounded: true,
				label,
				range: ''
			}
		}

		if (bin.label === '' || bin.label === undefined) bin.label = get_bin_label(bin, self.q, self.term.valueConversion)
		if (bin.range === '' || bin.range === undefined) bin.range = get_bin_range_equation(bin, self.q)
		data.push(bin)
	}
	return data
}
