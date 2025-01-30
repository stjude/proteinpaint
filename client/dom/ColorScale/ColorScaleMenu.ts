import type { SvgG, SvgSvg, Td } from '../../types/d3'
import type { ColorScaleMenuOpts, CutoffMode } from '../types/colorScale'
import { Menu } from '#dom'
import { rgb } from 'd3-color'

export class ColorScaleMenu {
	domain: number[]
	colors: string[] = ['white', 'red']
	default?: { min: number; max: number; percentile?: number }
	cutoffMode?: CutoffMode
	percentile?: number
	setColorsCallback?: (val: string, idx: number) => void
	numInputCallback?: (f?: { cutoffMode: CutoffMode; min?: number; max?: number; percentile?: number }) => void
	private tip = new Menu({ padding: '2px' })
	constructor(opts: ColorScaleMenuOpts) {
		this.domain = opts.domain
		this.colors = opts.colors

		if (opts.setNumbersCallback) {
			this.numInputCallback = opts.setNumbersCallback
			this.cutoffMode = opts.cutoffMode
			this.default = {
				min: opts.domain[0],
				max: opts.domain[opts.domain.length - 1]
			}
			if (opts.percentile) {
				this.default.percentile = opts.percentile
				this.percentile = opts.percentile
			}
		}
		if (opts.setColorsCallback) this.setColorsCallback = opts.setColorsCallback

		this.renderMenu(opts.scaleSvg, opts.barG)
	}

	renderMenu(scaleSvg: SvgSvg, barG: SvgG) {
		let showTooltip = true
		scaleSvg
			.on('click', () => {
				this.tip.clear().showunder(barG.node())
				const selectDiv = this.tip.d.append('div').style('padding', '2px')
				const table = this.tip.d.append('table').style('margin', 'auto')

				const submitPromptCell = table
					.append('tr')
					.append('td')
					.attr('colspan', '2')
					.style('opacity', 0.65)
					.style('font-size', '0.7em')
					.text('Press ENTER to submit')
					.style('display', 'none')

				const percentRow = table
					.append('tr')
					.style('padding', '5px')
					.append('td')
					.attr('colspan', '2')
					.style('display', this.cutoffMode == 'percentile' ? '' : 'none')

				const minMaxPromptRow = table
					.append('tr')
					.style('text-align', 'center')
					.style('display', this.setColorsCallback ? 'table-row' : 'none')
				minMaxPromptRow.append('td').text('Min').style('padding-left', '5px').style('text-align', 'left')
				minMaxPromptRow.append('td').style('padding-left', '5px').style('text-align', 'left').text('Max')

				if (this.numInputCallback) {
					const options = [
						{ label: 'Automatic', value: 'auto', selected: this.cutoffMode == 'auto' },
						{ label: 'Fixed', value: 'fixed', selected: this.cutoffMode == 'fixed' }
					]
					if (this.default?.percentile) {
						options.push({
							label: 'Percentile',
							value: 'percentile',
							selected: this.cutoffMode == 'percentile'
						})
					}
					const select = selectDiv.append('select')

					select
						.selectAll('option')
						.data(options)
						.enter()
						.append('option')
						.text(d => d.label)
						.property('value', d => d.value)
						.property('selected', d => d.selected)

					//Do not allow users to put in negative or > 100 values
					const percentInput = this.appendValueInput(percentRow, this.percentile || null, 0, 100)

					const minMaxInputRow = table.append('tr').style('display', this.cutoffMode == 'fixed' ? 'table-row' : 'none')
					const minInput = this.appendValueInput(minMaxInputRow.append('td'), 0)
					this.appendValueInput(minMaxInputRow.append('td'), this.domain.length - 1)

					select.on('change', async () => {
						this.cutoffMode = select.node()!.value as CutoffMode
						if (!this.default) throw new Error('Auto values not set for #dom/ColorScale.')
						if (this.cutoffMode == 'auto') {
							minMaxPromptRow.style('display', this.setColorsCallback ? 'table-row' : 'none')
							this.domain[0] = this.default.min
							this.domain[this.domain.length - 1] = this.default.max
							this.percentile = this.default.percentile
							await this.numInputCallback!({
								cutoffMode: this.cutoffMode,
								min: this.default.min,
								max: this.default.max
							})
							this.tip.hide()
						}
						//Show min/max prompts for fixed mode and if user may change colors
						minMaxPromptRow.style(
							'display',
							this.setColorsCallback || this.cutoffMode == 'fixed' ? 'table-row' : 'none'
						)
						//Show submit prompt for fixed and percentile mode
						submitPromptCell.style('display', this.cutoffMode != 'auto' ? '' : 'none')
						//Show min/max inputs for fixed mode and focus on the min input
						minMaxInputRow.style('display', this.cutoffMode == 'fixed' ? 'table-row' : 'none')
						if (this.cutoffMode == 'fixed') minInput.node().focus()
						//Show and focus on the percentile input when mode is percentile
						percentRow.style('display', this.cutoffMode == 'percentile' ? '' : 'none')
						if (this.cutoffMode == 'percentile') percentInput.node().focus()
					})
				}
				if (this.setColorsCallback) {
					const colorRow = table.append('tr').style('text-align', 'center')
					this.appendColorInput(colorRow.append('td').style('padding-right', '10px'), 0)
					this.appendColorInput(colorRow.append('td'), this.colors.length - 1)
				}
				showTooltip = false
			})
			.on('mouseenter', () => {
				//Prevent showing the tooltip after user interacts with the color picker
				if (showTooltip == false) return
				this.tip.clear().showunder(barG.node())
				const text = `Click to customize ${this.setColorsCallback ? 'colors' : ''} ${
					this.numInputCallback && this.setColorsCallback ? ' and ' : ''
				}${this.numInputCallback ? 'values' : ''}`
				this.tip.d.append('div').style('padding', '2px').text(text)
			})
			.on('mouseleave', () => {
				if (showTooltip) this.tip.hide()
			})
	}

	appendColorInput = (td: Td, idx: number) => {
		const colorInput = td
			.append('input')
			.style('width', '60px')
			.attr('type', 'color')
			//Rm default color input styles
			.style('padding', '0px')
			.style('border', 'none')
			.style('margin', '0px')
			.attr('value', rgb(this.colors[idx]).formatHex())
			.on('change', async () => {
				const color = colorInput.node()!.value
				this.colors[idx] = color
				await this.setColorsCallback!(color, idx)
				this.tip.hide()
			})
	}

	appendValueInput = (elem: any, elemValue: number | null, min?: number, max?: number) => {
		if (elemValue == null) return
		const valueInput = elem
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.attr('value', this.domain[elemValue] || elemValue)
			.style('padding', '3px')

		//Limit input if necessary
		if (min) valueInput.attr('min', min)
		if (max) valueInput.attr('max', max)

		valueInput.on('keyup', async (event: KeyboardEvent) => {
			if (event.code != 'Enter') return
			const valueNode = valueInput.node()
			if (!valueNode) return
			const value: number = parseFloat(valueNode.value)
			const opts: any = {
				cutoffMode: this.cutoffMode
			}
			if (this.cutoffMode == 'fixed') {
				this.domain[elemValue] = value
				opts.min = this.domain[0]
				opts.max = this.domain[this.domain.length - 1]
			} else if (this.cutoffMode == 'percentile') {
				this.percentile = value
				opts.percentile = value
			}
			await this.numInputCallback!(opts)
			this.tip.hide()
		})
		return valueInput
	}
}
