//import { keyupEnter } from '#src/client'
import type { NumCustomBins } from '#tw'
import type { NumericHandler } from './NumericHandler.ts'
import type { BoundaryOpts, LineData } from './NumericDensity.ts'
//import type { TermSetting } from '../TermSetting.ts'
import type { BinaryNumericQ, StartUnboundedBin, StopUnboundedBin, Handler } from '#types'
import { HandlerBase } from '../HandlerBase.ts'
import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins.js'
import { make_one_checkbox } from '#dom'

export class NumBinaryEditor extends HandlerBase implements Handler {
	tw: NumCustomBins
	q: BinaryNumericQ
	handler: NumericHandler
	//termsetting: TermSetting
	opts: any
	dom: {
		[elemName: string]: any
	} = {}

	cutoffPercentile: number = 50

	constructor(opts, handler) {
		super(opts)
		this.opts = opts
		this.handler = handler
		this.tw = handler.tw
		this.q = this.getDefaultQ()
	}

	async showEditMenu(div) {
		if (this.dom.density_div) {
			if (this.handler.dom.editDiv?.node().contains(this.dom.density_div.node())) return
			else {
				this.dom.density_div.remove()
				delete this.dom.density_div
			}
		}
		this.q = this.getDefaultQ()
		this.dom.density_div = div.append('div')
		await this.handler.density.showViolin(this.dom.density_div)
		await this.handler.density.setBinLines(this.getBoundaryOpts())

		this.dom.boundaryInclusionDiv = div.append('div').style('padding', '5px')
		this.dom.cutoff_div = div.append('div').style('padding', '10px')
		this.dom.inputsDiv = div.append('div').style('padding', '10px').style('display', 'flex').style('width', '100%')
		this.renderBoundaryInclusionSelect()
		this.renderCutoffInput()
		this.renderBoundaryInputDivs()
	}

	getDefaultQ(): BinaryNumericQ {
		const tw = this.termsetting.tw as NumCustomBins
		if (tw.q.mode == 'binary') {
			const copy = JSON.parse(JSON.stringify(tw.q))
			copy.lst.forEach(bin => {
				if (!bin.label) bin.label = get_bin_label(bin, tw.q, tw.term.valueConversion)
				bin.range = get_bin_range_equation(bin, this.tw.q)
			})
			return copy
		}
		const { min, max } = this.handler.density_data
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

		const firstBin = {
			startunbounded: true,
			startinclusive: false,
			stopinclusive: false,
			stop: +defaultCustomBoundary.toFixed(this.tw.term.type == 'integer' ? 0 : 2)
		} satisfies StartUnboundedBin

		const lastBin = {
			stopunbounded: true,
			startinclusive: true,
			stopinclusive: false,
			start: +defaultCustomBoundary.toFixed(this.tw.term.type == 'integer' ? 0 : 2)
		} satisfies StopUnboundedBin

		return {
			mode: 'binary',
			type: 'custom-bin',
			lst: [
				{
					...firstBin,
					label: get_bin_label(firstBin, this.tw.q, this.tw.term.valueConversion),
					range: get_bin_range_equation(firstBin, this.tw.q)
				},
				{
					...lastBin,
					label: get_bin_label(lastBin, this.tw.q, this.tw.term.valueConversion),
					range: get_bin_range_equation(lastBin, this.tw.q)
				} //satisfies StopUnboundedBin
			],
			cutoffType: 'normal'
		} //as BinaryNumericQ //TODO: remove forced type
	}

	getBoundaryOpts(): BoundaryOpts {
		return {
			values: [
				{
					//this.q.lst[0].map(bin => ({ x: bin.startunbounded ? bin.stop : bin.start, isDraggable: true })),
					x: this.q.lst[0].stop,
					isDraggable: true
				}
			],
			callback: (d: LineData, value) => {
				this.q.lst[0].stop = value
				this.q.lst[1].start = value
				this.dom.cutoffInput.property('value', value)
				this.q.lst = this.processBinaryBinInputs()
				this.dom.customBinRanges.data(this.q.lst).html(d => d.range)
				this.dom.customBinLabelInput.data(this.q.lst).property('value', d => d.label)
			}
		}
	}

	getBoundaryInclusion() {
		return this.q.lst[0].startinclusive ? 'startinclusive' : 'stopinclusive'
	}

	renderBoundaryInclusionSelect() {
		//if (this.dom.boundaryInput) return
		//const handler = this.handler
		this.dom.boundaryInclusionDiv.selectAll('*').remove()
		this.dom.boundaryInclusionDiv
			.append('span')
			.style('padding', '5px')
			.style('color', 'rgb(136, 136, 136)')
			.html('Boundary Inclusion')

		const x = '<span style="font-family:Times;font-style:italic">x</span>'

		this.dom.boundaryInclusionSelect = this.dom.boundaryInclusionDiv
			.append('select')
			.style('margin-left', '10px')
			.on('change', () => {
				this.renderBoundaryInputDivs()
			})

		this.dom.boundaryInclusionSelect
			.selectAll('option')
			.data([
				{ value: 'stopinclusive', html: `start &lt; ${x} &le; end` },
				{ value: 'startinclusive', html: `start &le; ${x} &lt; end` }
			])
			.enter()
			.append('option')
			.property('value', d => d.value)
			.property('selected', d => this.tw.q.lst?.[0]?.[d.value] == true)
			.html(d => d.html)
	}

	async renderCutoffInput() {
		this.dom.cutoff_div.append('span').style('margin-right', '5px').style('opacity', 0.5).text('Boundary value')

		const q = this.q

		this.dom.cutoffInput = this.dom.cutoff_div
			.append('input')
			.style('width', '100px')
			.attr('type', 'number')
			.style('margin-right', '10px')
			.attr('value', q.lst[0].stop)
			.on('change', () => this.renderBoundaryInputDivs())

		this.dom.cutoffPercentileCheckbox = make_one_checkbox({
			holder: this.dom.cutoff_div,
			labeltext: 'Use percentile',
			checked: false,
			divstyle: { display: 'inline-block' },
			callback: async checked => {
				this.dom.cutoffInput.property('disabled', checked == true)
				this.dom.cutoffInputPercentile.style('display', checked ? '' : 'none')
				this.handlePercentileChange()
			}
		})

		this.dom.cutoffInputPercentile = this.dom.cutoff_div
			.append('input')
			.attr('type', 'number')
			.attr('value', this.cutoffPercentile)
			.style('display', 'none')
			.style('width', '100px')
			.style('margin-right', '10px')
			.on('change', () => this.handlePercentileChange())
	}

	async handlePercentileChange() {
		try {
			const cutoffPercentile = Number(this.dom.cutoffInputPercentile.property('value'))
			this.q.cutoffPercentile = cutoffPercentile
			const data = await this.termsetting.vocabApi.getPercentile(
				this.tw.term,
				[cutoffPercentile],
				this.termsetting.vocabApi.state?.termfilter
			)
			this.dom.cutoffInput.property('value', data.values[0])
			this.renderBoundaryInputDivs()
		} catch (e) {
			console.error(e)
		}
	}

	renderBoundaryInputDivs() {
		const cutoff = this.dom.cutoffInput.property('value')
		this.q.lst[0].stop = cutoff
		this.q.lst[1].start = cutoff
		this.q.lst = this.processBinaryBinInputs()
		const data = this.q.lst
		const holder = this.dom.inputsDiv

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
			grid.append('div').datum(d).attr('name', 'range').html(d.range)

			grid
				.append('div')
				.append('input')
				.datum(d)
				.attr('type', 'text')
				.style('margin', '2px 0px')
				.property('value', d.label)
				.on('change', function (this: any) {
					d.label = this.value
				})
		}

		this.dom.customBinRanges = this.dom.inputsDiv.selectAll('div[name="range"]')
		this.dom.customBinLabelInput = this.dom.inputsDiv.selectAll('input')
		this.handler.density.setBinLines(this.getBoundaryOpts())
	}

	processBinaryBinInputs() {
		const inclusive = this.dom.boundaryInclusionSelect.property('value')
		const startinclusive = inclusive == 'startinclusive'
		const stopinclusive = inclusive == 'stopinclusive'
		//const inputDivs = this.dom.bins_table.node().querySelectorAll('input')
		const val = this.q.lst[0].stop // should not get value from dom.cutoffInput as value can be percentile
		if (!val && val !== 0) throw 'val is undefined'

		const firstBin = {
			startunbounded: true,
			stop: Number(val),
			startinclusive: false,
			stopinclusive
		} satisfies StartUnboundedBin

		const lastBin = {
			start: Number(val),
			startinclusive,
			stopinclusive: false,
			stopunbounded: true
		} satisfies StopUnboundedBin

		const bins: [StartUnboundedBin, StopUnboundedBin] = [
			{
				...firstBin,
				label: get_bin_label(firstBin, this.q),
				range: get_bin_range_equation(firstBin, this.tw.q)
			},
			{
				...lastBin,
				label: get_bin_label(lastBin, this.q),
				range: get_bin_range_equation(lastBin, this.tw.q)
			}
		]

		return bins
	}

	getEditedQ(destroyDom: boolean = true): BinaryNumericQ {
		const lst = this.processBinaryBinInputs()
		if (destroyDom) {
			for (const name of Object.keys(this.dom)) {
				this.dom[name].remove()
				delete this.dom[name]
			}
		}
		return {
			mode: 'binary',
			type: 'custom-bin',
			lst
		}
	}

	async undoEdits() {
		this.q = this.getDefaultQ()
		await this.handler.density.setBinLines(this.getBoundaryOpts())
		this.dom.inputsDiv.selectAll('*').remove()
		this.renderBoundaryInclusionSelect()
		this.renderCutoffInput()
		this.renderBoundaryInputDivs()
	}
}
