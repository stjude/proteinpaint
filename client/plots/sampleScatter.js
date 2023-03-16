import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '#termsetting'
import { filterJoin, getFilterItemByTag } from '#filter'
import { renderTable } from '#dom/table'
import { icons as icon_functions } from '#dom/control.icons'
import { Menu } from '#dom/menu'
import { d3lasso } from '#common/lasso'
import { mclass, dt2label, morigin } from '#shared/common'
import { scaleLinear as d3Linear } from 'd3-scale'
import { rgb } from 'd3-color'
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { controlsInit } from './controls'
import { axisLeft, axisBottom } from 'd3-axis'
import {
	symbol,
	symbolCircle,
	symbolTriangle,
	symbolCross,
	symbolSquare,
	symbolWye,
	symbolAsterisk,
	symbolDiamond,
	symbolDiamond2,
	symbolStar,
	symbolSquare2
} from 'd3-shape'
import { dofetch3 } from '../common/dofetch'

/*
sample object returned by server:
{
	sample=str
	x=number
	y=number
	category=str
}

NOTE
"sample" and "category" attributes here are hardcoded

*/

class Scatter {
	constructor() {
		this.type = 'sampleScatter'
		this.lassoOn = false
		const mySymbols = [
			symbolCircle,
			symbolSquare,
			symbolCross,
			symbolWye,
			symbolTriangle,
			//symbolAsterisk,
			symbolDiamond,
			symbolDiamond2,
			symbolStar,
			symbolSquare2
		]
		this.symbols = mySymbols.map(s => symbol(s))
		this.k = 1
	}

	async init(opts) {
		const controls = this.opts.controls || this.opts.holder.append('div')
		const controlsDiv = this.opts.controls
			? opts.holder
			: this.opts.holder.append('div').style('display', 'inline-block')
		const mainDiv = controlsDiv.append('div').style('display', 'inline-block')

		const chartDiv = mainDiv.append('div').style('display', 'inline-block')
		const legendDiv = mainDiv
			.append('div')
			.style('display', 'inline-block')
			.style('float', 'right')
			.style('margin-left', '100px')

		const holder = chartDiv.insert('div')

		this.dom = {
			header: this.opts.header,
			holder,
			controls,
			legendDiv,
			tip: new Menu({ padding: '5px' }),
			tooltip: new Menu({ padding: '5px' }),
			termstip: new Menu({ padding: '5px', offsetX: 170, offsetY: -34 })
		}

		this.settings = {}
		if (this.dom.header) this.dom.header.html('Scatter Plot')
		await this.setControls()
		setInteractivity(this)
		setRenderers(this)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			termfilter: appState.termfilter,
			allowedTermTypes: appState.termdbConfig.allowedTermTypes,
			matrixplots: appState.termdbConfig.matrixplots,
			vocab: appState.vocab
		}
	}

	// called in relevant dispatch when reactsTo==true
	// or current.state != replcament.state
	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		if (this.dom.header)
			this.dom.header.html(
				this.config.name + ` <span style="opacity:.6;font-size:.7em;margin-left:10px;">SCATTER PLOT</span>`
			)
		copyMerge(this.settings, this.config.settings.sampleScatter)
		const reqOpts = this.getDataRequestOpts()
		this.data = await this.app.vocabApi.getScatterData(reqOpts)

		if (this.data.error) throw this.data.error
		if (!Array.isArray(this.data.samples)) throw 'data.samples[] not array'

		this.colorLegend = new Map(Object.entries(this.data.colorLegend))
		this.shapeLegend = new Map(Object.entries(this.data.shapeLegend))
		this.axisOffset = { x: 80, y: 20 }

		const s0 = this.data.samples[0]
		const [xMin, xMax, yMin, yMax] = this.data.samples.reduce(
			(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
			[s0.x, s0.x, s0.y, s0.y]
		)
		this.xAxisScale = d3Linear()
			.domain([xMin, xMax])
			.range([this.axisOffset.x, this.settings.svgw + this.axisOffset.x])

		this.axisBottom = axisBottom(this.xAxisScale)
		this.yAxisScale = d3Linear()
			.domain([yMax, yMin])
			.range([this.axisOffset.y, this.settings.svgh + this.axisOffset.y])
		this.axisLeft = axisLeft(this.yAxisScale)
		this.cohortSamples = this.data.samples.filter(sample => 'sampleId' in sample)
		if (!this.config.gradientColor) this.config.gradientColor = '#008000'
		this.startColor = rgb(this.config.gradientColor)
			.brighter()
			.brighter()
		this.stopColor = rgb(this.config.gradientColor)
			.darker()
			.darker()
		if (this.config.colorTW?.q.mode === 'continuous') {
			const [min, max] = this.cohortSamples.reduce(
				(s, d) => [d.value < s[0] ? d.category : s[0], d.category > s[1] ? d.category : s[1]],
				[this.cohortSamples[0].category, this.cohortSamples[0].category]
			)

			this.colorGenerator = d3Linear()
				.domain([min, max])
				.range([this.startColor, this.stopColor])
		}

		this.render()
		this.setTools()
		this.lassoReset()
		this.updateGroupsButton()
		this.dom.tip.hide()
		this.dom.termstip.hide()
	}

	// creates an opts object for the vocabApi.someMethod(),
	// may need to add a new method to client/termdb/vocabulary.js
	// for now, just add methods to TermdbVocab,
	// later on, add methods with same name to FrontendVocab
	getDataRequestOpts() {
		const c = this.config
		const coordTWs = []
		if (c.term) coordTWs.push(c.term)
		if (c.term2) coordTWs.push(c.term2)
		const opts = {
			name: c.name, // the actual identifier of the plot, for retrieving data from server
			colorTW: c.colorTW,
			filter: this.state.termfilter.filter,
			coordTWs
		}
		if (c.shapeTW) opts.shapeTW = c.shapeTW
		return opts
	}

	async setControls() {
		const controlsHolder = this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block')

		const inputs = [
			{
				type: 'term',
				configKey: 'colorTW',
				chartType: 'sampleScatter',
				usecase: { target: 'sampleScatter', detail: 'colorTW' },
				title: 'Categories to color the samples',
				label: 'Color',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['continuous', 'discrete']
			},
			{
				type: 'term',
				configKey: 'shapeTW',
				chartType: 'sampleScatter',
				usecase: { target: 'sampleScatter', detail: 'shapeTW' },
				title: 'Categories to assign a shape',
				label: 'Shape',
				vocabApi: this.app.vocabApi
			},

			{
				label: 'Symbol size',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'size',
				title: 'It represents the area of a symbol in square pixels',
				min: 0
			},

			{
				label: 'Chart width',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'svgw'
			},
			{
				label: 'Chart height',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'svgh'
			},
			{
				boxLabel: 'Visible',
				label: 'Show axes',
				type: 'checkbox',
				chartType: 'sampleScatter',
				settingsKey: 'showAxes',
				title: `Option to show/hide plot axes`
			},
			{
				label: 'Reference size',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'refSize',
				title: 'It represents the area of the reference symbol in square pixels',
				min: 0
			},
			{
				label: 'Opacity',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'opacity',
				title: 'It represents the opacity of the symbols',
				min: 0,
				max: 1
			}
		]
		if (this.opts.parent?.type == 'summary')
			inputs.unshift(
				...[
					{
						type: 'term',
						configKey: 'term',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'term' },
						title: 'X coordinate to plot the samples',
						label: 'X',
						vocabApi: this.app.vocabApi,
						menuOptions: '!remove',
						numericEditMenuVersion: ['continuous', 'discrete']
					},
					{
						type: 'term',
						configKey: 'term2',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'term2' },
						title: 'Y coordinate to plot the samples',
						label: 'Y',
						vocabApi: this.app.vocabApi,
						menuOptions: '!remove',
						numericEditMenuVersion: ['continuous', 'discrete']
					}
				]
			)

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: controlsHolder,
				inputs
			})
		}

		this.components.controls.on('downloadClick.scatter', () => this.downloadSVG(this.svg))
		this.components.controls.on('helpClick.scatter', () =>
			window.open('https://github.com/stjude/proteinpaint/wiki/Scatter-plot', '_blank')
		)
		this.dom.toolsDiv = this.dom.controls.insert('div')
	}

	renderLegend(legendG) {
		legendG.selectAll('*').remove()
		if (!this.config.colorTW) return

		const step = 30
		let offsetX = 0
		let offsetY = 60
		const name =
			this.config.colorTW.term.name.length > 25
				? this.config.colorTW.term.name.slice(0, 25) + '...'
				: this.config.colorTW.term.name
		let title = `${name} (${this.cohortSamples.length})`
		if (this.config.colorTW.term.type == 'geneVariant')
			title += ` x Assays (${this.cohortSamples[0]['cat_info']['category'].length})`
		const colorRefCategory = this.colorLegend.get('Ref')

		const colorG = legendG.append('g')
		colorG
			.append('text')
			.attr('id', 'legendTitle')
			.attr('x', offsetX)
			.attr('y', 30)
			.text(title)
			.style('font-weight', 'bold')
		if (this.config.colorTW.q.mode === 'continuous') {
			const [min, max] = this.colorGenerator.domain()
			const gradientScale = d3Linear()
				.domain([min, max])
				.range([0, 130])
			const axis = axisBottom(gradientScale).ticks(3)
			const axisG = colorG
				.append('g')
				.attr('transform', `translate(0, 70)`)
				.call(axis)

			const rect = colorG
				.append('rect')
				.attr('x', 0)
				.attr('y', 50)
				.attr('width', 130)
				.attr('height', 20)
				.style('fill', `url(#linear-gradient-${this.id})`)
				.on('click', e => {
					const menu = new Menu()
					const input = menu.d
						.append('input')
						.attr('type', 'color')
						.attr('value', this.config.gradientColor)
						.on('change', () => {
							this.config.gradientColor = input.node().value
							this.startColor = rgb(this.config.gradientColor)
								.brighter()
								.brighter()
							this.stopColor = rgb(this.config.gradientColor)
								.darker()
								.darker()
							this.colorGenerator = d3Linear().range([this.startColor, this.stopColor])

							this.startGradient.attr('stop-color', this.startColor)
							this.stopGradient.attr('stop-color', this.stopColor)
							this.app.dispatch({
								type: 'plot_edit',
								id: this.id,
								config: this.config
							})
							menu.hide()
						})
					menu.show(e.clientX, e.clientY, false)
				})

			offsetY += step
		} else {
			for (const [key, category] of this.colorLegend) {
				if (key == 'Ref') continue
				const color = category.color
				const count = category.sampleCount
				const name = key
				const hidden = this.config.colorTW.q.hiddenValues ? key in this.config.colorTW.q.hiddenValues : false
				const [circleG, itemG] = addLegendItem(colorG, color, name, count, offsetX, offsetY, hidden)
				circleG.on('click', e => this.onColorClick(e, key, category))
				offsetY += step
				itemG.on('click', event => onLegendClick(this.config.colorTW, 'colorTW', key, event, this))
			}
		}
		if (colorRefCategory.sampleCount > 0) {
			offsetY = offsetY + step
			const titleG = legendG.append('g')
			titleG
				.append('text')
				.attr('x', offsetX)
				.attr('y', offsetY)
				.text('Reference')
				.style('font-weight', 'bold')
			offsetY = offsetY + step

			let symbol = this.symbols[0].size(64)()
			const refColorG = legendG.append('g')
			refColorG
				.append('path')
				.attr('transform', c => `translate(${offsetX}, ${offsetY})`)
				.style('fill', colorRefCategory.color)
				.attr('d', symbol)
			refColorG.on('click', e => this.onColorClick(e, 'Ref', colorRefCategory))
			const refText = legendG
				.append('g')
				.append('text')
				.attr('x', offsetX + 10)
				.attr('y', offsetY)
				.text(`n=${colorRefCategory.sampleCount}`)
				.style('text-decoration', !this.settings.showRef ? 'line-through' : 'none')
				.style('font-size', '15px')
				.attr('alignment-baseline', 'middle')

			refText.on('click', () => {
				refText.style('text-decoration', !this.settings.showRef ? 'none' : 'line-through')
				this.settings.showRef = !this.settings.showRef

				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: {
						settings: { sampleScatter: this.settings }
					}
				})
			})
		}
		if (this.config.shapeTW) {
			offsetX = 300
			offsetY = 60
			title = `${this.config.shapeTW.term.name} (${this.cohortSamples.length})`
			if (this.config.shapeTW.term.type == 'geneVariant')
				title += ` x Assays (${this.cohortSamples[0]['cat_info']['shape'].length})`
			const shapeG = legendG.append('g')
			shapeG
				.append('text')
				.attr('x', offsetX)
				.attr('y', 30)
				.text(title)
				.style('font-weight', 'bold')

			const color = 'gray'
			for (const [key, shape] of this.shapeLegend) {
				if (key == 'Ref') continue
				const index = shape.shape % this.symbols.length
				const symbol = this.symbols[index].size(64)()
				const name = key
				const count = shape.sampleCount
				const hidden = this.config.shapeTW.q.hiddenValues ? key in this.config.shapeTW.q.hiddenValues : false
				const itemG = shapeG.append('g')

				itemG
					.append('path')
					.attr('transform', c => `translate(${offsetX}, ${offsetY})`)
					.style('fill', color)
					.attr('d', symbol)
				itemG
					.append('text')
					.attr('x', offsetX + 10)
					.attr('y', offsetY)
					.text(`${name}, n=${count}`)
					.style('font-size', '15px')
					.style('text-decoration', hidden ? 'line-through' : 'none')
					.attr('alignment-baseline', 'middle')
				offsetY += step
				itemG.on('click', event => onLegendClick(this.config.shapeTW, 'shapeTW', key, event, this))
			}
		}

		function addLegendItem(g, color, name, count, x, y, hidden = false) {
			const radius = 5

			const circleG = g.append('g')
			circleG
				.append('circle')
				.attr('cx', x)
				.attr('cy', y)
				.attr('r', radius)
				.style('fill', color)

			circleG.on('click', e => this.onColorClick(e, key, category))
			const itemG = g.append('g')
			itemG
				.append('text')
				.attr('name', 'sjpp-scatter-legend-label')
				.attr('x', x + 10)
				.attr('y', y)
				.text(`${name}, n=${count}`)
				.style('font-size', '15px')
				.style('text-decoration', hidden ? 'line-through' : 'none')
				.attr('alignment-baseline', 'middle')
			return [circleG, itemG]
		}

		function onLegendClick(tw, name, key, e, parent) {
			const menu = new Menu({ padding: '5px' })
			const div = menu.d.append('div')

			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Hide')
				.on('click', () => {
					parent.hideCategory(legendG, tw, key, true)
					menu.hide()
					const config = {}
					config[name] = tw
					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config
					})
				})
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show')
				.on('click', () => {
					parent.hideCategory(legendG, tw, key, false)
					menu.hide()
					const config = {}
					config[name] = tw
					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config
					})
				})
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show only')
				.on('click', () => {
					const map = name == 'colorTW' ? parent.colorLegend : parent.shapeLegend
					for (const mapKey of map.keys()) parent.hideCategory(legendG, tw, mapKey, mapKey !== key)

					menu.hide()
					const config = {}
					config[name] = tw
					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config
					})
				})
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show all')
				.on('click', () => {
					const map = name == 'colorTW' ? parent.colorLegend : parent.shapeLegend
					for (const mapKey of map.keys()) parent.hideCategory(legendG, tw, mapKey, false)
					const config = {}
					config[name] = tw
					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config
					})
				})
			menu.show(e.clientX, e.clientY, false)
		}
	}

	hideCategory(legendG, tw, key, hide) {
		if (!tw.q.hiddenValues) tw.q.hiddenValues = {}
		const value = tw.term.type != 'geneVariant' && tw.term.values[key] ? tw.term.values[key] : { key: key, label: key }
		const items = legendG.selectAll(`text[name="sjpp-scatter-legend-label"]`).nodes()
		const itemG = items.find(item => item.innerHTML.startsWith(key))?.parentElement
		if (itemG) itemG.style['text-decoration'] = hide ? 'line-through' : 'none'
		if (!hide) delete tw.q.hiddenValues[key]
		else tw.q.hiddenValues[key] = value
	}

	onColorClick(e, key, category) {
		const menu = new Menu()
		const input = menu.d
			.append('input')
			.attr('type', 'color')
			.attr('value', category.color)
			.on('change', () => {
				// ok to not await here, since no returned value is required
				// and menu.hide() does not need to wait for the dispatch to finish
				this.changeColor(key, input.node().value)
				menu.hide()
			})
		menu.show(e.clientX, e.clientY, false)
	}

	async changeColor(key, color) {
		const tw = this.config.colorTW
		if (tw.term.type != 'geneVariant' && tw.term.values[key]) tw.term.values[key].color = color
		else {
			if (!tw.term.values) tw.term.values = {}
			tw.term.values[key] = { key: key, label: key, color }
		}
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { colorTW: tw }
		})
	}

	async openSurvivalPlot(term, tgroups) {
		const values = {}
		for (const group of tgroups) values[group.name] = { key: group.name, label: group.name }
		const plot_name = this.config.name ? this.config.name : 'Summary scatter'
		const disabled = !('sample' in tgroups[0].values[0])
		let config = {
			chartType: 'survival',
			term,
			term2: {
				term: { name: plot_name + ' groups', type: 'samplelst', values },
				q: {
					mode: 'custom-groupsetting',
					groups: tgroups,
					groupsetting: { disabled }
				}
			},
			insertBefore: this.id
		}
		await this.app.dispatch({
			type: 'plot_create',
			config: config
		})
	}

	downloadSVG(svg) {
		const link = document.createElement('a')
		// If you don't know the name or want to use
		// the webserver default set name = ''
		link.setAttribute('download', 'scatter.svg')
		document.body.appendChild(link)
		link.click()
		link.remove()
		const serializer = new XMLSerializer()
		const svg_blob = new Blob([serializer.serializeToString(svg.node())], {
			type: 'image/svg+xml'
		})
		link.href = URL.createObjectURL(svg_blob)
		link.click()
		link.remove()
	}

	async openSummaryPlot(term, groups) {
		// barchart config.term{} name is confusing, as it is actually a termsetting object, not term
		// thus convert the given term into a termwrapper
		// tw.q can be missing and will be filled in with default setting
		const tw = { id: term.id, term }
		const plot_name = this.config.name ? this.config.name : 'Summary scatter'
		const disabled = !('sample' in groups[0].values[0])
		const config = {
			chartType: 'summary',
			childType: 'barchart',
			term: tw, // this is a termsetting, not a term
			term2: {
				term: { name: plot_name + ' groups', type: 'samplelst' },
				q: {
					mode: 'custom-groupsetting',
					groups: groups,
					groupsetting: { disabled }
				}
			},
			insertBefore: this.id
		}
		await this.app.dispatch({
			type: 'plot_create',
			config
		})
	}

	getGroupsOverlay(groups) {
		const overlayGroups = []
		let values, tgroup
		for (const group of groups) {
			values = this.getGroupValues(group)
			tgroup = {
				name: group.name,
				key: 'sample',
				values: values
			}
			overlayGroups.push(tgroup)
		}
		return overlayGroups
	}

	getGroupvsOthersOverlay(group) {
		const values = this.getGroupValues(group)
		return [
			{
				name: group.name,
				key: 'sample',
				values
			},
			{
				name: 'Others',
				key: 'sample',
				in: false,
				values
			}
		]
	}

	getGroupValues(group) {
		const values = []
		for (const item of group.items) {
			const value = { sampleId: item.sampleId }
			if ('sample' in item) value.sample = item.sample
			values.push(value)
		}
		return values
	}

	async showTermsTree(div, callback, state = { tree: { usecase: { detail: 'term' } } }) {
		this.dom.termstip.clear()
		this.dom.termstip.showunderoffset(div.node())
		const termdb = await import('../termdb/app')
		termdb.appInit({
			holder: this.dom.termstip.d,
			vocabApi: this.app.vocabApi,
			state,
			tree: {
				click_term: term => {
					callback(term)
					this.dom.tip.hide()
					this.dom.termstip.hide()
				}
			}
		})
	}

	getCategoryInfo(d, category) {
		if (!(category in d)) return ''
		return d[category]
	}

	getColor(c) {
		if (this.config.colorTW?.q.mode == 'continuous' && 'sampleId' in c) return this.colorGenerator(c.category)
		const color = this.colorLegend.get(c.category).color

		return color
	}

	getOpacity(c) {
		if ('sampleId' in c) {
			const opacity = c.hidden['category'] || c.hidden['shape'] ? 0 : this.settings.opacity
			return opacity
		}
		const refOpacity = this.settings.showRef ? this.settings.opacity : 0
		return refOpacity
	}

	getShape(c, factor = 1) {
		const index = this.shapeLegend.get(c.shape).shape % this.symbols.length
		const size = 'sampleId' in c ? this.settings.size : this.settings.refSize
		return this.symbols[index].size((size * factor) / this.k)()
	}

	addToFilter(group) {
		const lst = []
		for (const item of group.items) lst.push(item.sample)
		const filterUiRoot = getFilterItemByTag(this.state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([
			filterUiRoot,
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { type: 'samplelst', name: group.name },
							values: lst
						}
					}
				]
			}
		])
		filter.tag = 'filterUiRoot'
		this.app.dispatch({
			type: 'filter_replace',
			filter
		})
	}

	showTable(group, x, y, addGroup) {
		let rows = []
		const columns = []
		const first = group.items[0]
		if ('sample' in first) columns.push(formatCell('Sample', 'label'))
		if (this.config.colorTW) columns.push(formatCell(this.config.colorTW.term.name, 'label'))

		if (this.config.shapeTW) columns.push(formatCell(this.config.shapeTW.term.name, 'label'))
		let info = false
		for (const item of group.items) {
			const row = []
			if ('sample' in item) row.push(formatCell(item.sample))
			if (this.config.colorTW) row.push(formatCell(this.getCategoryInfo(item, 'category')))
			if (this.config.shapeTW) row.push(formatCell(this.getCategoryInfo(item, 'shape')))
			if ('info' in item) {
				info = true
				const values = []
				for (const [k, v] of Object.entries(item.info)) values.push(`${k}: ${v}`)
				row.push(formatCell(values.join(', ')))
			}
			rows.push(row)
		}
		if (info) columns.push(formatCell('Info', 'label'))

		this.dom.tip.clear()
		const headerDiv = this.dom.tip.d.append('div').style('margin-top', '5px')

		const groupDiv = headerDiv
			.append('div')
			.html('&nbsp;' + group.name)
			.style('font-size', '0.9rem')
			.on('click', () => {
				const isEdit = groupDiv.select('input').empty()
				if (!isEdit) return
				groupDiv.html('')
				const input = groupDiv
					.append('input')
					.attr('value', group.name)
					.on('change', () => {
						const value = input.node().value
						if (value) group.name = value
						else input.node().value = group.name
						groupDiv.html('&nbsp;' + group.name)
					})
				input.node().focus()
				input.node().select()
			})
		const tableDiv = this.dom.tip.d.append('div')
		const buttons = []
		if (addGroup) {
			const addGroup = {
				text: 'Add to a group',
				callback: indexes => {
					const items = []
					for (const i of indexes) items.push(this.selectedItems[i].__data__)
					this.config.groups.push({
						name: group.name,
						items,
						index: this.config.groups.length
					})
					this.app.dispatch({ type: 'plot_edit', id: this.id, config: { groups: this.config.groups } })
				}
			}
			buttons.push(addGroup)
		} else {
			const deleteSamples = {
				text: 'Delete samples',
				callback: indexes => {
					group.items = group.items.filter((elem, index, array) => !(index in indexes))
					this.showTable(group, x, y, addGroup)
				}
			}
			buttons.push(deleteSamples)
		}
		renderTable({
			rows,
			columns,
			div: tableDiv,
			showLines: true,
			maxWidth: columns.length * '15' + 'vw',
			maxHeight: '35vh',
			buttons,
			selectAll: true
		})

		this.dom.tip.show(x, y, false, false)
		function formatCell(column, name = 'value') {
			let dict = {}
			dict[name] = column
			return dict
		}
	}

	showGroupMenu(event, group) {
		this.dom.tip.clear()
		this.dom.tip.show(event.clientX, event.clientY, false, false)
		const menuDiv = this.dom.tip.d.append('div')
		const groupDiv = menuDiv
			.append('div')
			.attr('name', 'sjpp-group-input-div')
			.html('&nbsp;' + group.name)
			.style('font-size', '0.9rem')
			.on('click', () => {
				const isEdit = groupDiv.select('input').empty()
				if (!isEdit) return
				groupDiv.html('')
				const input = groupDiv
					.append('input')
					.attr('value', group.name)
					.on('change', () => {
						const value = input.node().value
						if (value) group.name = value
						else input.node().value = group.name
						groupDiv.html('&nbsp;' + group.name)
					})
				input.node().focus()
				input.node().select()
			})
		const listDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Edit ${group.items.length} samples`)
			.on('click', e => {
				this.dom.tip.hide()
				this.showTable(group, event.clientX, event.clientY, false)
			})
		if (this.state.matrixplots) {
			for (const plot of this.state.matrixplots) {
				menuDiv
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(plot.name)
					.on('click', async () => {
						const values = {}
						values[group.name] = { key: group.name, label: group.name }
						const config = await dofetch3('termdb', {
							body: {
								for: 'matrix',
								getPlotDataByName: plot.name,
								genome: this.state.vocab.genome,
								dslabel: this.state.vocab.dslabel
							}
						})
						config.divideBy = {
							term: { name: group.name, type: 'samplelst', values },
							q: {
								mode: 'custom-groupsetting',
								groups: [
									{
										name: group.name,
										key: 'sample',
										values: this.getGroupValues(group)
									}
								]
							}
						}

						this.app.dispatch({
							type: 'plot_create',
							config
						})
						this.dom.tip.hide()
					})
			}
		}
		if (this.state.allowedTermTypes.includes('survival')) {
			const survivalDiv = menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.style('position', 'relative')
				.html('Survival analysis&nbsp;&nbsp;&nbsp;›')

			survivalDiv.on('click', async e => {
				const state = {
					nav: { header_mode: 'hide_search' },
					tree: { usecase: { target: 'survival', detail: 'term' } }
				}
				this.showTermsTree(
					survivalDiv,
					term => {
						this.openSurvivalPlot(term, this.getGroupvsOthersOverlay(group))
					},
					state
				)
			})
		}
		const summarizeDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.html('Summarize')
		summarizeDiv
			.insert('div')
			.html('›')
			.style('float', 'right')

		summarizeDiv.on('click', async e => {
			this.showTermsTree(summarizeDiv, term => this.openSummaryPlot(term, this.getGroupvsOthersOverlay(group)))
		})
		const deleteDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Delete group`)
			.on('click', e => {
				this.config.groups = this.config.groups.splice(group.index, 1)
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { groups: this.config.groups } })
			})
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Add to filter')
			.on('click', () => {
				this.addToFilter(group)
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { groups: this.config.groups } })
			})
	}

	showGroupsMenu(event) {
		this.dom.tip.clear()
		this.dom.tip.show(event.clientX, event.clientY)
		const menuDiv = this.dom.tip.d.append('div')

		let row = menuDiv.append('div')

		for (const [i, group] of this.config.groups.entries()) {
			row = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border')
			row
				.insert('div')
				.style('display', 'inline-block')
				.text(` ${group.name}: ${group.items.length} `)

			row
				.append('div')
				.style('display', 'inline-block')
				.style('float', 'right')
				.html('&nbsp;&nbsp;›')
			row.on('click', e => {
				this.dom.tip.clear().hide()
				this.showGroupMenu(event, group)
			})
		}
		if (this.state.allowedTermTypes.includes('survival')) {
			const survivalDiv = menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.html('Compare survival&nbsp;&nbsp;›')

			survivalDiv.on('click', async e => {
				const state = {
					nav: { header_mode: 'hide_search' },
					tree: { usecase: { target: 'survival', detail: 'term' } }
				}
				this.showTermsTree(
					survivalDiv,
					term => {
						this.openSurvivalPlot(term, this.getGroupsOverlay(this.config.groups))
					},
					state
				)
			})
		}
		const summarizeDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.html('Summarize')
		summarizeDiv
			.insert('div')
			.html('›')
			.style('float', 'right')

		summarizeDiv.on('click', async e => {
			this.showTermsTree(summarizeDiv, term => {
				this.openSummaryPlot(term, this.getGroupsOverlay(this.config.groups))
			})
		})
		row = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Delete groups')
			.on('click', event => {
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { groups: [] } })
			})
	}
}

function setRenderers(self) {
	self.render = function() {
		const data = self.data
		const chartDiv = self.dom.holder
		if (chartDiv.selectAll('*').size() > 0) updateCharts()
		else addCharts()
		self.dom.holder.on('mouseover', self.mouseover).on('click', self.mouseclick)

		function addCharts() {
			const s = self.settings
			chartDiv.style('opacity', 0)

			self.svg = chartDiv.append('svg')
			renderSVG(self.svg, chartDiv, s, 0, data)

			chartDiv
				.transition()
				.duration(s.duration)
				.style('opacity', 1)
		}

		function updateCharts() {
			const s = self.settings
			chartDiv.transition().duration(s.duration)
			renderSVG(chartDiv.select('svg'), chartDiv, s, s.duration, data)
		}
	}

	function renderSVG(svg, chart, s, duration, data) {
		let colorLegends = self.colorLegend.size * 30
		if (self.colorLegend.get('Ref').sampleCount > 0) colorLegends += 60
		const legendHeight = Math.max(colorLegends, self.shapeLegend.size * 30) + 60 //legend step and header

		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw + 800)
			.attr('height', Math.max(s.svgh + 100, legendHeight)) //leaving some space for top/bottom padding and y axis

		/* eslint-disable */
		const [mainG, legendG] = getSvgSubElems(svg, chart)
		/* eslint-enable */

		if (mainG.select('.sjpcb-scatter-series').size() == 0) mainG.append('g').attr('class', 'sjpcb-scatter-series')
		const serie = mainG.select('.sjpcb-scatter-series')
		renderSerie(serie, data, s, duration)
		self.renderLegend(legendG)
	}

	function getSvgSubElems(svg, chart) {
		let mainG, axisG, xAxis, yAxis, legendG, labelsG, clipRect
		if (svg.select('.sjpcb-scatter-mainG').size() == 0) {
			axisG = svg.append('g').attr('class', 'sjpcb-scatter-axis')
			mainG = svg.append('g').attr('class', 'sjpcb-scatter-mainG')
			labelsG = svg.append('g').attr('class', 'sjpcb-scatter-labelsG')
			xAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-scatter-x-axis')
				.attr('transform', `translate(0, ${self.settings.svgh + self.axisOffset.y})`)
			yAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-scatter-y-axis')
				.attr('transform', `translate(${self.axisOffset.x}, 0)`)
			mainG
				.append('rect')
				.attr('class', 'zoom')
				.attr('x', self.axisOffset.x)
				.attr('y', self.axisOffset.y - self.settings.size)
				.attr('width', self.settings.svgw)
				.attr('height', self.settings.svgh)
				.attr('fill', 'white')
			//Adding clip path
			const id = `${Date.now()}`
			const idclip = `sjpp_clip_${id}`
			self.defs = svg.append('defs')
			clipRect = self.defs
				.append('clipPath')
				.attr('id', idclip)
				.append('rect')

			const gradient = self.defs
				.append('linearGradient')
				.attr('id', `linear-gradient-${self.id}`)
				.attr('x1', '0%')
				.attr('y1', '0%')
				.attr('x2', '100%')
				.attr('y2', '0%')
			self.startGradient = gradient
				.append('stop')
				.attr('offset', '0%')
				.attr('stop-color', self.startColor)
			self.stopGradient = gradient
				.append('stop')
				.attr('offset', '100%')
				.attr('stop-color', self.stopColor)

			mainG.attr('clip-path', `url(#${idclip})`)

			legendG = svg
				.append('g')
				.attr('class', 'sjpcb-scatter-legend')
				.attr('transform', `translate(${self.settings.svgw + self.axisOffset.x + 50}, 0)`)
		} else {
			mainG = svg.select('.sjpcb-scatter-mainG')
			axisG = svg.select('.sjpcb-scatter-axis')
			labelsG = svg.select('.sjpcb-scatter-labelsG')
			xAxis = axisG.select('.sjpcb-scatter-x-axis')
			yAxis = axisG.select('.sjpcb-scatter-y-axis')
			legendG = svg.select('.sjpcb-scatter-legend')
			clipRect = svg.select(`defs > clipPath > rect`)
		}
		xAxis.call(self.axisBottom)
		yAxis.call(self.axisLeft)
		const particleWidth = Math.sqrt(self.settings.size)
		if (self.settings.showAxes) {
			clipRect
				.attr('x', self.axisOffset.x)
				.attr('y', 0)
				.attr('width', self.settings.svgw + 2 * particleWidth)
				.attr('height', self.settings.svgh + self.axisOffset.y)

			axisG.style('opacity', 1)
			if (self.config.term) {
				labelsG.selectAll('*').remove()
				labelsG
					.append('text')
					.attr(
						'transform',
						`translate(${self.axisOffset.x + self.settings.svgw / 2}, ${self.settings.svgh + self.axisOffset.y + 40})`
					)
					.attr('text-anchor', 'middle')
					.text(self.config.term.term.name)
				labelsG
					.append('text')
					.attr(
						'transform',
						`translate(${self.axisOffset.x - 50}, ${self.settings.svgh / 2 + self.axisOffset.y}) rotate(-90)`
					)
					.attr('text-anchor', 'middle')
					.text(self.config.term2.term.name)
			}
		} else {
			axisG.style('opacity', 0)
			clipRect
				.attr('x', self.axisOffset.x - particleWidth)
				.attr('y', 0)
				.attr('width', self.settings.svgw + 2 * particleWidth)
				.attr('height', self.settings.svgh + self.axisOffset.y + particleWidth)
		}

		return [mainG, legendG]
	}

	function renderSerie(g, data, s, duration) {
		// remove all symbols as there is no data id for privacy
		//g.selectAll('path').remove()

		const symbols = g.selectAll('path').data(data.samples)
		symbols.exit().remove()
		symbols
			.transition()
			.duration(duration)
			.attr('transform', translate)
			.attr('d', c => self.getShape(c))
			.attr('fill', c => self.getColor(c))

			.style('fill-opacity', c => self.getOpacity(c))
		symbols
			.enter()
			.append('path')
			/*** you'd need to set the symbol position using translate, instead of previously with cx, cy for a circle ***/
			.attr('transform', translate)
			.attr('d', c => self.getShape(c))
			.attr('fill', c => self.getColor(c))

			.style('fill-opacity', c => self.getOpacity(c))
			.transition()
			.duration(duration)
	}

	function translate(c) {
		const transform = `translate(${self.xAxisScale(c.x)},${self.yAxisScale(c.y)})`
		return transform
	}

	self.lassoReset = () => {
		const mainG = self.dom.holder.select('.sjpcb-scatter-mainG')

		if (self.lasso)
			self.lasso
				.items(mainG.select('.sjpcb-scatter-series').selectAll('path'))
				.targetArea(mainG)
				.on('start', lasso_start)
				.on('draw', lasso_draw)
				.on('end', lasso_end)
		function lasso_start(event) {
			if (self.lassoOn) {
				self.lasso
					.items()
					.attr('d', c => self.getShape(c, 1 / 2))
					.style('fill-opacity', c => (self.getOpacity(c) != 0 ? 0.5 : 0))
					.classed('not_possible', true)
					.classed('selected', false)
			}
		}

		function lasso_draw(event) {
			if (self.lassoOn) {
				// Style the possible dots

				self.lasso
					.possibleItems()
					.attr('d', c => self.getShape(c, 2))
					.style('fill-opacity', c => self.getOpacity(c))
					.classed('not_possible', false)
					.classed('possible', true)

				//Style the not possible dot
				self.lasso
					.notPossibleItems()
					.attr('d', c => self.getShape(c, 1 / 2))
					.style('fill-opacity', c => (self.getOpacity(c) != 0 ? 0.5 : 0))
					.classed('not_possible', true)
					.classed('possible', false)
			}
		}

		function lasso_end(dragEnd) {
			if (self.lassoOn) {
				// Reset classes of all items (.possible and .not_possible are useful
				// only while drawing lasso. At end of drawing, only selectedItems()
				// should be used)
				self.lasso
					.items()
					.classed('not_possible', false)
					.classed('possible', false)

				// Style the selected dots
				self.lasso.selectedItems().attr('d', c => self.getShape(c, 2))
				self.lasso.items().style('fill-opacity', c => self.getOpacity(c))
				self.selectedItems = []
				for (const item of self.lasso.selectedItems()) {
					const data = item.__data__
					if ('sampleId' in data && !(data.hidden['category'] || data.hidden['shape'])) self.selectedItems.push(item)
				}
				self.lasso.notSelectedItems().attr('d', c => self.getShape(c))

				showLassoMenu(dragEnd.sourceEvent)
			}
		}

		function showLassoMenu(event) {
			self.dom.tip.clear().hide()
			if (self.selectedItems.length == 0) return
			self.dom.tip.show(event.clientX, event.clientY)

			const menuDiv = self.dom.tip.d.append('div')
			const listDiv = menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(`List ${self.selectedItems.length} samples`)
				.on('click', event => {
					self.dom.tip.hide()
					self.showTable(
						{ name: 'Group ' + (self.config.groups.length + 1), items: self.selectedItems.map(item => item.__data__) },
						event.clientX,
						event.clientY,
						true
					)
				})

			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group')
				.on('click', () => {
					self.config.groups.push({
						name: `Group ${self.config.groups.length + 1}`,
						items: self.selectedItems.map(item => item.__data__),
						index: self.config.groups.length
					})
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
				})
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group and filter')
				.on('click', () => {
					const group = {
						name: `Group ${self.config.groups.length + 1}`,
						items: self.selectedItems.map(item => item.__data__),
						index: self.config.groups.length
					}
					self.config.groups.push(group)
					self.addToFilter(group)
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
				})
		}
	}

	self.setTools = function() {
		const inline = self.config.settings.controls.isOpen
		const svg = self.svg
		const toolsDiv = self.dom.toolsDiv.style('background-color', 'white')
		toolsDiv.selectAll('*').remove()
		let display = 'block'
		if (inline) display = 'inline-block'

		const homeDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
			.attr('name', 'sjpp-reset-btn') //For unit tests
		icon_functions['restart'](homeDiv, { handler: resetToIdentity })
		const zoomInDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
			.attr('name', 'sjpp-zoom-in-btn') //For unit tests
		icon_functions['zoomIn'](zoomInDiv, { handler: zoomIn })
		const zoomOutDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
			.attr('name', 'sjpp-zoom-out-btn') //For unit tests
		icon_functions['zoomOut'](zoomOutDiv, { handler: zoomOut })
		const lassoDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
		icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: self.lassoOn })
		self.dom.groupDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')

		const mainG = svg.select('.sjpcb-scatter-mainG')
		const seriesG = mainG.select('.sjpcb-scatter-series')
		const symbols = seriesG.selectAll('path')
		const axisG = svg.select('.sjpcb-scatter-axis')
		const xAxisG = axisG.select('.sjpcb-scatter-x-axis')
		const yAxisG = axisG.select('.sjpcb-scatter-y-axis')
		const zoom = d3zoom()
			.scaleExtent([0.5, 10])
			.on('zoom', handleZoom)

		mainG.call(zoom)
		const s = self.settings
		function handleZoom(event) {
			// create new scale ojects based on event
			const new_xScale = event.transform.rescaleX(self.xAxisScale)
			const new_yScale = event.transform.rescaleY(self.yAxisScale)

			xAxisG.call(self.axisBottom.scale(new_xScale))
			yAxisG.call(self.axisLeft.scale(new_yScale))
			seriesG.attr('transform', event.transform)
			self.k = event.transform.scale(1).k
			//on zoom in the particle size is kept
			symbols.attr('d', c => self.getShape(c))
			if (self.lassoOn) self.lasso.selectedItems().attr('d', c => self.getShape(c, 2))
		}

		function zoomIn() {
			zoom.scaleBy(mainG.transition().duration(750), 1.5)
		}

		function zoomOut() {
			zoom.scaleBy(mainG.transition().duration(750), 0.5)
		}

		function resetToIdentity() {
			mainG
				.transition()
				.duration(750)
				.call(zoom.transform, zoomIdentity)
		}

		self.lasso = d3lasso()

		self.lassoReset()

		function toggle_lasso() {
			self.lassoOn = !self.lassoOn
			if (self.lassoOn) {
				mainG.on('.zoom', null)
				mainG.call(self.lasso)
			} else {
				mainG.on('mousedown.drag', self.lassoReset())
				self.lasso.items().classed('not_possible', false)
				self.lasso.items().classed('possible', false)
				self.lasso
					.items()
					.attr('r', self.settings.size)
					.style('fill-opacity', c => self.getOpacity(c))
				mainG.call(zoom)
				self.selectedItems = null
			}
			lassoDiv.select('*').remove()
			icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: self.lassoOn })
		}
	}

	self.updateGroupsButton = function() {
		self.dom.groupDiv.selectAll('*').remove()
		self.dom.tip.hide()
		if (self.config.groups.length == 0) return
		self.dom.groupDiv
			.append('button')
			.style('border', 'none')
			.style('background', 'transparent')
			.style('padding', 0)
			.append('div')
			.style('font-size', '1.1em')
			.html(`&#931${self.config.groups.length + 1};`)
			.on('click', event => {
				if (self.config.groups.length == 1) self.showGroupMenu(event, self.config.groups[0])
				else self.showGroupsMenu(event)
			})
	}
}

function distance(x1, y1, x2, y2) {
	const x = x2 - x1
	const y = y2 - y1
	const distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
	return distance
}

function setInteractivity(self) {
	self.mouseover = function(event) {
		if (event.target.tagName == 'path' && event.target.__data__) {
			const s2 = event.target.__data__
			const displaySample = 'sample' in s2
			const shrink = self.opts.parent?.type == 'summary' && !displaySample
			const include = shrink ? dist => dist > 0 && dist < 0.2 : dist => dist < 0.2
			const overlapSamples = []
			const samples = self.data.samples.filter(s => {
				const dist = distance(s.x, s.y, s2.x, s2.y)
				if (dist == 0) overlapSamples.push(s)
				return self.getOpacity(s) > 0 && include(dist)
			})
			if (shrink)
				//filtered out s2, dist = 0
				samples.push(s2)
			if (samples.length == 0) return
			samples.sort((a, b) => {
				if (a.category < b.category) return -1
				if (a.category > b.category) return 1
				return 0
			})

			self.dom.tooltip.clear()
			if (shrink)
				self.dom.tooltip.d
					.append('div')
					.html(`<b> ${overlapSamples.length} ${overlapSamples.length == 1 ? 'sample' : 'samples'}</b>`)

			for (const [i, d] of samples.entries()) {
				if (i > 5) break
				if (!('sampleId' in d) && (!self.settings.showRef || self.settings.refSize == 0)) continue
				const div = self.dom.tooltip.d.append('div').style('padding-top', '2px')
				const table = div.append('table').style('width', '100%')
				const row = table.append('tr')
				if (displaySample) {
					if (d.sample == s2.sample) {
						let title = ''
						for (const os of overlapSamples) title += os.sample + ' '
						row
							.append('td')
							.attr('colspan', 2)
							.html(`<b>${title}</b>`)
					} else
						row
							.append('td')
							.attr('colspan', 2)
							.html(`<b>${d.sample}</b>`)
				}

				if (self.config.colorTW) addCategoryInfo(self.config.colorTW?.term, 'category', d, table)
				if (self.config.shapeTW) addCategoryInfo(self.config.shapeTW.term, 'shape', d, table)
				if (self.config.term) addCategoryInfo(self.config.term.term, 'x', d, table)
				if (self.config.term2) addCategoryInfo(self.config.term2?.term, 'y', d, table)

				if ('info' in d)
					for (const [k, v] of Object.entries(d.info)) {
						const row = table.append('tr')
						row.append('td').text(k)
						row.append('td').text(v)
					}
			}
			if (samples.length > 5) self.dom.tooltip.d.append('div').html(`<b>...(${samples.length - 5} more)</b>`)

			self.dom.tooltip.show(event.clientX, event.clientY, true, false)
		} else self.dom.tooltip.hide()

		function addCategoryInfo(term, category, d, table) {
			if (!term) return
			if (d[category] == 'Ref') return
			let row = table.append('tr')
			const ctd = row.append('td').text(term.name)

			if ('cat_info' in d && d.cat_info[category]) {
				const mutations = d.cat_info[category]
				ctd.attr('rowspan', mutations.length + 1)
				// row.append('td').text('Mutation')
				for (const mutation of mutations) {
					const dt = mutation.dt
					row = table.append('tr')
					const class_info = mclass[mutation.class]
					const clabel = 'mname' in mutation ? `${mutation.mname} ${class_info.label}` : class_info.label
					const tdclass = row.append('td').text(clabel)
					if (mutation.class != 'Blank') tdclass.style('color', class_info.color)
					else tdclass.style('color', mclass['WT'].color)
					const origin = morigin[mutation.origin]?.label
					const dtlabel = origin ? `${origin} ${dt2label[dt]}` : dt2label[dt]
					row.append('td').text(dtlabel)
				}
			} else {
				let value = d[category]
				if (typeof value == 'number') value = value.toFixed(2)
				row.append('td').text(value)
			}
		}
	}

	self.mouseclick = function() {
		if (!self.lassoOn) self.dom.tip.hide()
		self.dom.termstip.hide()
	}
}

export async function getPlotConfig(opts, app) {
	//if (!opts.colorTW) throw 'sampleScatter getPlotConfig: opts.colorTW{} missing'
	//if (!opts.name && !(opts.term && opts.term2)) throw 'sampleScatter getPlotConfig: missing coordinates input'
	try {
		if (opts.colorTW) await fillTermWrapper(opts.colorTW, app.vocabApi)
		if (opts.shapeTW) await fillTermWrapper(opts.shapeTW, app.vocabApi)
		if (opts.term) await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)

		const settings = getDefaultScatterSettings()
		if (!opts.term && !opts.term2) settings.showAxes = false
		const config = {
			groups: [],
			gradientColor: '#008000',
			settings: {
				controls: {
					isOpen: false // control panel is hidden by default
				},
				sampleScatter: settings
			}
		}
		// may apply term-specific changes to the default object
		const result = copyMerge(config, opts)
		return result
	} catch (e) {
		console.log(e)
		throw `${e} [sampleScatter getPlotConfig()]`
	}
}

export const scatterInit = getCompInit(Scatter)
// this alias will allow abstracted dynamic imports
export const componentInit = scatterInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	const menuDiv = holder.append('div')

	for (const plot of chartsInstance.state.termdbConfig.scatterplots) {
		/* plot: 
		{
			name=str,
			dimensions=int,
			term={ id, ... }
		}
		*/
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(plot.name)
			.on('click', () => {
				let config = {
					chartType: 'sampleScatter',
					colorTW: JSON.parse(JSON.stringify(plot.colorTW)),
					name: plot.name
				}
				if ('shapeTW' in plot) config.shapeTW = JSON.parse(JSON.stringify(plot.shapeTW))
				chartsInstance.app.dispatch({
					type: 'plot_create',
					config: config
				})
				chartsInstance.dom.tip.hide()
			})
	}
}

export function getDefaultScatterSettings() {
	return {
		size: 25,
		refSize: 9,
		svgw: 550,
		svgh: 550,
		axisTitleFontSize: 16,
		showAxes: true,
		showRef: true,
		opacity: 0.8
	}
}
