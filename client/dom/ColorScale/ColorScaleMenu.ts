import type { Svg, SvgG, Td } from '../../types/d3'
import { Menu } from '#dom'
import { make_radios } from '#dom'
import { rgb } from 'd3-color'

export type ColorScaleMenuOpts = {
	scaleSvg: Svg
	barG: SvgG
	colors: string[]
	cutoffMode: 'auto' | 'fixed'
	data: number[]
	setColorsCallback?: (val: string, idx: number) => void
	setMinMaxCallback?: (f?: { cutoffMode: 'auto' | 'fixed'; min: number; max: number }) => void
}

export class ColorScaleMenu {
	data: number[]
	colors: string[] = ['white', 'red']
	default?: { min: number; max: number }
	cutoffMode?: 'auto' | 'fixed'
	setColorsCallback?: (val: string, idx: number) => void
	setMinMaxCallback?: (f?: { cutoffMode: 'auto' | 'fixed'; min: number; max: number }) => void
	private tip = new Menu({ padding: '2px' })
	constructor(opts: ColorScaleMenuOpts) {
		this.data = opts.data
		this.colors = opts.colors

		if (opts.setMinMaxCallback) {
			this.setMinMaxCallback = opts.setMinMaxCallback
			this.cutoffMode = opts.cutoffMode || 'auto'
			this.default = {
				min: opts.data[0],
				max: opts.data[opts.data.length - 1]
			}
		}
		if (opts.setColorsCallback) this.setColorsCallback = opts.setColorsCallback

		this.renderMenu(opts.scaleSvg, opts.barG)
	}

	renderMenu(scaleSvg: Svg, barG: SvgG) {
		let showTooltip = true
		scaleSvg
			.on('click', () => {
				this.tip.clear().showunder(barG.node())
				const radiosDiv = this.tip.d.append('div').style('padding', '2px')
				const table = this.tip.d.append('table').style('margin', 'auto')
				const promptRow = table
					.append('tr')
					.style('text-align', 'center')
					.style('display', this.setColorsCallback ? 'table-row' : 'none')
				promptRow.append('td').text('Min').style('padding-right', '10px')
				promptRow.append('td').text('Max')
				if (this.setMinMaxCallback) {
					const options = [
						{ label: 'Automatic', value: 'auto', checked: this.cutoffMode == 'auto' },
						{ label: 'Fixed', value: 'fixed', checked: this.cutoffMode == 'fixed' }
					]
					make_radios({
						holder: radiosDiv.style('display', 'block'),
						options,
						callback: async (value: string) => {
							this.cutoffMode = value as 'auto' | 'fixed'
							if (!this.default) throw new Error('Auto values not set for #dom/ColorScale.')
							if (value == 'auto') {
								promptRow.style('display', this.setColorsCallback ? 'table-row' : 'none')
								minMaxRow.style('display', 'none')
								this.data[0] = this.default.min
								this.data[this.data.length - 1] = this.default.max
								await this.setMinMaxCallback!({
									cutoffMode: this.cutoffMode,
									min: this.default.min,
									max: this.default.max
								})
								// this.updateAxis()
								this.tip.hide()
							}
							if (value == 'fixed') {
								minMaxRow.style('display', 'table-row')
								promptRow.style('display', 'table-row')
							}
						}
					})
					const minMaxRow = table.append('tr').style('display', this.cutoffMode == 'auto' ? 'none' : 'table-row')
					this.appendValueInput(minMaxRow.append('td'), 0)
					this.appendValueInput(minMaxRow.append('td'), this.data.length - 1)
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
					this.setMinMaxCallback && this.setColorsCallback ? ' and ' : ''
				}${this.setMinMaxCallback ? 'values' : ''}`
				this.tip.d.append('div').style('padding', '2px').text(text)
			})
			.on('mouseleave', () => {
				if (showTooltip) this.tip.hide()
			})
	}

	appendColorInput = (td: Td, idx: number) => {
		const colorInput = td
			.append('input')
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

	appendValueInput = (td: Td, idx: number) => {
		const valueInput = td
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.attr('value', this.data[idx])
			.style('padding', '3px')
			.on('keyup', async (event: KeyboardEvent) => {
				if (event.code != 'Enter') return
				const valueNode = valueInput.node()
				if (!valueNode) return
				const value: number = parseFloat(valueNode.value)
				this.data[idx] = value
				await this.setMinMaxCallback!({
					cutoffMode: this.cutoffMode!,
					min: this.data[0],
					max: this.data[this.data.length - 1]
				})
				this.tip.hide()
			})
	}
}
