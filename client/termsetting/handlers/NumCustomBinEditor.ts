import { keyupEnter } from '#src/client'
import type { NumCustomBins } from '#tw'
import type { NumDiscreteEditor } from './NumDiscreteEditor.ts'
import type { BoundaryOpts, LineData } from './NumericDensity.ts'
import type { TermSetting } from '../TermSetting.ts'
import type {
	CustomNumericBinConfig,
	CustomNumericBinConfigLst,
	StartUnboundedBin,
	StopUnboundedBin,
	NumericBin
} from '#types'
import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins.js'

export class NumCustomBinEditor {
	tw: NumCustomBins
	q: CustomNumericBinConfig
	editHandler: NumDiscreteEditor
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
		this.q = this.getDefaultQ()
	}

	async render(div) {
		await this.editHandler.handler.density.setBinLines(this.getBoundaryOpts())
		if (this.dom.inputsDiv) {
			if (this.editHandler.dom.binsDiv?.node().contains(this.dom.inputsDiv.node())) return
			else {
				this.dom.inputsDiv.remove()
				delete this.dom.inputsDiv
			}
		}
		this.dom.inputsDiv = div.append('div').style('display', 'flex').style('width', '100%')
		this.renderCustomBinInputs()
	}

	getBoundaryOpts(): BoundaryOpts {
		return {
			values: this.q.lst.slice(1).map(bin => ({ x: bin.startunbounded ? bin.stop : bin.start, isDraggable: true })),
			callback: (d: LineData, value) => {
				const boundaryValues = this.q.lst.slice(1).map(d => ('start' in d ? d.start : ''))
				boundaryValues[d.index] = value

				// const q = this.q
				// q.lst![d.index + 1].start = value as number
				// q.lst![d.index + 1].label = get_bin_label(q.lst![d.index + 1], self.q)
				// q.lst![d.index + 1].range = get_bin_range_equation(q.lst![d.index + 1], self.q)
				// q.lst![d.index].stop = value as number
				// q.lst![d.index].label = get_bin_label(q.lst![d.index], self.q)
				// q.lst![d.index].range = get_bin_range_equation(q.lst![d.index], self.q)
				// if (handler.dom.customBinBoundaryInput) {
				// 	// this is created by binary.js when mode=binary
				// 	// quick fix: while dragging, revert from percentile to normal, as it's hard to update percentile values
				// 	q.modeBinaryCutoffType = 'normal'
				// 	if (handler.dom.customBinBoundaryPercentileCheckbox) {
				// 		handler.dom.customBinBoundaryPercentileCheckbox.property('checked', false)
				// 	}
				// 	handler.dom.customBinBoundaryInput.property(
				// 		'value',
				// 		self.q
				// 			.lst!.slice(1)
				// 			.map((d: any) => d.start)
				// 			.join('\n')
				// 	)
				// }
				// if (handler.dom.customBinLabelInput) {
				// 	handler.dom.customBinLabelInput.property('value', (c: any) => c.label)
				// }
				// if (handler.dom.customBinRanges) {
				// 	handler.dom.customBinRanges.html((c: any) => c.range)
				// }

				this.dom.customBinBoundaryInput.text(boundaryValues.join(',\n'))
				this.handleInputChange('drag')
				return 0
			}
		}
	}

	getDefaultQ(): CustomNumericBinConfig {
		if (this.tw.q.mode == 'discrete' && this.tw.q.type == 'custom-bin') {
			const copy = JSON.parse(JSON.stringify(this.tw.q))
			copy.lst.forEach(bin => {
				if (!bin.label) bin.label = get_bin_label(bin, this.tw.q, this.tw.term.valueConversion)
				bin.range = get_bin_range_equation(bin, this.tw.q)
			})
			return copy
		}
		const { min, max } = this.editHandler.handler.density_data
		const defaultCustomBoundary =
			/* when no sample is annotated by this term,
			minvalue and maxvalue are both null
			setting defaultCustomBoundary to arbitrary "0" will allow existing UI to work
			but remains to be evaluated if is really okay to use 0
			*/
			!Number.isFinite(min) || !Number.isFinite(max)
				? 0
				: // minvalue and maxvalue is valid number
				max != min
				? min + (max - min) / 2
				: max

		return {
			type: 'custom-bin',
			mode: 'discrete',
			lst: [
				{
					startunbounded: true,
					startinclusive: false,
					stopinclusive: false,
					stop: +defaultCustomBoundary.toFixed(this.tw.term.type == 'integer' ? 0 : 2)
				} satisfies NumericBin,
				{
					stopunbounded: true,
					startinclusive: true,
					stopinclusive: false,
					start: +defaultCustomBoundary.toFixed(this.tw.term.type == 'integer' ? 0 : 2)
				} satisfies StopUnboundedBin
			].map((bin: StartUnboundedBin | StopUnboundedBin) => {
				if (!bin.label) bin.label = get_bin_label(bin, this.tw.q, this.tw.term.valueConversion)
				bin.range = get_bin_range_equation(bin, this.tw.q)
				return bin
			}) as CustomNumericBinConfigLst // TODO: remove forced type
		}
	}

	getBoundaryInclusion() {
		return this.q.lst[0].startinclusive ? 'startinclusive' : 'stopinclusive'
	}

	/******************* Functions for Numerical Custom size bins *******************/
	renderCustomBinInputs() {
		const q = this.q
		// boundaryDiv for entering bin boundaries
		// rangeAndLabelDiv for rendering ranges and labels
		const boundaryDiv = this.dom.inputsDiv.append('div').style('margin-right', '20px')
		this.dom.rangeAndLabelDiv = this.dom.inputsDiv.append('div')

		boundaryDiv.append('div').style('margin-bottom', '5px').style('color', 'rgb(136, 136, 136)').text('Bin boundaries')

		this.dom.customBinBoundaryInput = boundaryDiv
			.append('textarea')
			.style('width', '100px')
			.style('height', '70px')
			.text(
				q.lst
					.slice(1)
					.map(d => ('start' in d ? d.start : ''))
					.join('\n')
			)
			.on('change', () => this.handleInputChange())
			.on('keyup', async (event: any) => {
				// enter or backspace/delete
				// i don't think backspace works
				if (!keyupEnter(event) && event.key != 8 && event.key != 'Enter') return
				if (!this.dom.inputsDiv.selectAll('input').node().value) return
				// Fix for if user hits enter with no values. Reverts to default cutoff.
				this.handleInputChange()
			})

		// help note
		boundaryDiv
			.append('div')
			.style('font-size', '.6em')
			.style('margin-left', '1px')
			.style('color', '#858585')
			.html('Enter numeric values </br>seperated by ENTER')

		this.renderBoundaryInputDivs()

		// add help message for custom bin labels
	}

	renderBoundaryInputDivs() {
		const data = this.q.lst
		const holder = this.dom.rangeAndLabelDiv
		holder.selectAll('*').remove()

		const grid = holder
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', 'auto auto')
			.style('column-gap', '20px')
			.style('align-items', 'center')

		grid.append('div').style('margin-bottom', '3px').style('color', 'rgb(136, 136, 136)').text('Range')

		grid.append('div').style('margin-bottom', '3px').style('color', 'rgb(136, 136, 136)').text('Bin label')

		for (const d of data) {
			grid.append('div').attr('name', 'range').html(d.range)

			grid
				.append('div')
				.append('input')
				.attr('type', 'text')
				.style('margin', '2px 0px')
				.property('value', d.label)
				.on('change', function (this: any) {
					d.label = this.value
				})
		}

		this.dom.customBinRanges = this.dom.inputsDiv.selectAll('div[name="range"]').data(data)
		this.dom.customBinLabelInput = this.dom.inputsDiv.selectAll('input').data(data)
	}

	handleInputChange(eventType = '') {
		const self = this.tw
		const inputs = this.dom.inputsDiv.selectAll('input')
		inputs.property('value', '')
		const data = this.processCustomBinInputs()
		if (data == undefined) {
			// alert('Enter custom bin value(s)')
			return
		}
		// update self.q.lst and render bin lines only if bin boundry changed
		//const q = self.numqByTermIdModeType[self.term.id].discrete[self.q.type!]
		if (self.q.hiddenValues) this.tw.q.hiddenValues = self.q.hiddenValues
		if (this.binsChanged(data, this.q.lst)) {
			this.q.lst = data
		}
		this.renderBoundaryInputDivs()
		if (eventType != 'drag') this.editHandler.handler.density.setBinLines(this.getBoundaryOpts())
		//self.q.lst = q.lst //store the new ranges in self.q, the mode is initialized when selecting the tab
	}

	binsChanged(data, qlst) {
		if (data.length != qlst.length) return true
		if (Object.keys(data[0]).length !== Object.keys(qlst[0]).length) return true
		for (const [i, bin] of qlst.entries()) {
			for (const k of Object.keys(bin)) {
				if (bin[k] && bin[k] !== data[i][k]) {
					return true
				}
			}
		}
		return false
	}

	processCustomBinInputs() {
		const self = this.termsetting
		const startinclusive = this.editHandler.dom.boundaryInput.property('value') == 'startinclusive'
		const stopinclusive = this.editHandler.dom.boundaryInput.property('value') == 'stopinclusive'
		//const inputs = this.dom.inputsDiv.node().querySelectorAll('input')

		const inputData = this.dom.customBinBoundaryInput
			.property('value')
			.split('\n')
			.filter((d: any) => d != '' && !isNaN(d))

		// Fix for when user enters in the same number more than once.
		// UI will ignore duplicate entries completely.
		const trackBins = new Set(inputData)
		if (!trackBins.size) return this.tw.q.lst

		const sortedBins = Array.from(trackBins)
			.map(Number)
			.sort((a, b) => a - b)

		const data: CustomNumericBinConfigLst = [
			// first bin: StartUnbounded type
			{
				startunbounded: true,
				stop: sortedBins[0],
				startinclusive: false,
				stopinclusive
				//label: inputs[0].value
			}
		]
		// first bin
		if (!data[0].label) data[0].label = get_bin_label(data[0], self.q, self.term.valueConversion)
		if (!data[0].range) data[0].range = get_bin_range_equation(data[0], self.q)
		for (const [i, d] of sortedBins.entries()) {
			let bin
			//const label = inputs[i + 1]?.value || ''
			if (i !== trackBins.size - 1) {
				// intermediate bin: FullyBounded type
				bin = {
					start: +d,
					startinclusive,
					stopinclusive,
					stop: sortedBins[i + 1]
					//label,
					//range: ''
				}
			} else {
				// last bin: StopUnbounded type
				bin = {
					start: +d,
					startinclusive,
					stopinclusive: false,
					stopunbounded: true
					//label,
					//range: ''
				}
			}

			if (bin.label === '' || bin.label === undefined) bin.label = get_bin_label(bin, self.q, self.term.valueConversion)
			if (bin.range === '' || bin.range === undefined) bin.range = get_bin_range_equation(bin, self.q)
			data.push(bin)
		}
		return data
	}

	getEditedQ(): CustomNumericBinConfig {
		const lst = this.processCustomBinInputs()
		for (const name of Object.keys(this.dom)) {
			this.dom[name].remove()
			delete this.dom[name]
		}
		return {
			mode: 'discrete',
			type: 'custom-bin',
			lst
		}
	}

	undoEdits() {
		this.q = this.getDefaultQ()
		this.dom.inputsDiv.selectAll('*').remove()
		this.renderCustomBinInputs()
	}
}
