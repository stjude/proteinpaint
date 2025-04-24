import { Menu } from '#dom/menu'
import { rgb } from 'd3-color'
import { shapesArray, shapeSelector } from '../../../dom/shapes.js'
import { Scatter } from '../Scatter.js'
import { scaleLinear as d3Linear } from 'd3-scale'
export class ScatterLegendInteractivity {
	scatter: Scatter
	shapeTW: any
	colorTW: any

	constructor(scatter: Scatter) {
		this.scatter = scatter
	}

	onLegendClick(chart, name, key, e, category) {
		const tw = this.scatter.config[name]
		const isColorTW = name == 'colorTW'
		const hidden = tw.q.hiddenValues ? key in tw.q.hiddenValues : false
		const hiddenCount = tw.q.hiddenValues ? Object.keys(tw.q.hiddenValues).length : 0

		if (hidden && hiddenCount == 1) {
			//show hidden category and skip menu
			this.hideCategory(tw, key, false)
			this.dispatchConfig(name, tw)
			return
		}
		const menu = new Menu({ padding: '0px' })
		const div = menu.d.append('div')
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(hidden ? 'Show' : 'Hide')
			.on('click', () => {
				this.hideCategory(tw, key, !hidden)
				menu.hide()
				this.dispatchConfig(name, tw)
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show only')
			.on('click', () => {
				const map = name == 'colorTW' ? chart.colorLegend : chart.shapeLegend
				for (const mapKey of map.keys())
					this.hideCategory(
						tw,
						mapKey,
						tw.term.type == 'geneVariant' && tw.q.type == 'values' ? !mapKey.startsWith(key) : mapKey != key
					)

				menu.hide()
				this.dispatchConfig(name, tw)
			})
		if (hiddenCount > 1)
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show all')
				.on('click', () => {
					menu.hide()
					const map = isColorTW ? chart.colorLegend : chart.shapeLegend
					for (const mapKey of map.keys()) this.hideCategory(tw, mapKey, false)
					this.dispatchConfig(name, tw)
				})
		if (isColorTW) {
			const color = rgb(category.color).formatHex()
			const input: any = div
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '0px 10px')
				.text('Color:')
				.append('input')
				.attr('type', 'color')
				.attr('value', color)
				.on('change', () => {
					this.changeColor(category.key, input.node().value)
					menu.hide()
				})
		}
		if (!isColorTW) {
			//is shape
			const shapeDiv = div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Change shape')
				.on('click', () => {
					div.selectAll('*').remove()
					const callback = index => {
						this.changeShape(category.key, index)
						menu.hide()
					}
					shapeSelector(div, callback)
				})
		}

		menu.showunder(e.target)
	}

	async changeShape(key, shape) {
		const tw = this.scatter.config.shapeTW
		if (!tw.term.values) tw.term.values = {}
		if (!tw.term.values[key]) tw.term.values[key] = {}
		tw.term.values[key].shape = shape
		await this.scatter.app.dispatch({
			type: 'plot_edit',
			id: this.scatter.id,
			config: { shapeTW: tw }
		})
	}

	dispatchConfig(name, tw) {
		this.scatter.app.dispatch({
			type: 'plot_edit',
			id: this.scatter.id,
			config: { [name]: tw }
		})
	}

	hideCategory(tw, key, hide) {
		if (!tw.q) tw.q = {}
		if (!tw.q.hiddenValues) tw.q.hiddenValues = {}
		const value =
			!(tw.term.type == 'geneVariant' && tw.q.type == 'values') && tw.term.values[key]
				? tw.term.values[key]
				: { key: key, label: key }

		if (!hide) delete tw.q.hiddenValues[key]
		else tw.q.hiddenValues[key] = value
		if (key == 'Ref') {
			this.scatter.settings.showRef = !hide
			this.scatter.app.dispatch({
				type: 'plot_edit',
				id: this.scatter.id,
				config: {
					settings: { sampleScatter: this.scatter.settings }
				}
			})
		}
	}

	changeGradientColor(chart, color, idx) {
		const hexColor = rgb(color).formatHex()
		const colorKey = idx == 0 ? 'startColor' : 'stopColor'
		this.scatter.config[colorKey][chart.id] = hexColor

		// Recreate color generator with current settings
		const range = chart.currentColorRange || chart.colorGenerator.domain()
		chart.colorGenerator = d3Linear()
			.domain(range)
			.range([this.scatter.config.startColor[chart.id], this.scatter.config.stopColor[chart.id]])

		// Update the configuration
		this.scatter.app.dispatch({
			type: 'plot_edit',
			id: this.scatter.id,
			config: this.scatter.config
		})
	}

	async changeColor(key, color) {
		const tw = this.scatter.config.colorTW
		if (!tw.term.values) tw.term.values = {}
		if (!tw.term.values[key]) tw.term.values[key] = {}
		tw.term.values[key].color = color
		await this.scatter.app.dispatch({
			type: 'plot_edit',
			id: this.scatter.id,
			config: { colorTW: tw }
		})
	}
}
