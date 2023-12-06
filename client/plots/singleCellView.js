import { getCompInit, copyMerge } from '../rx/index.js'
import { Menu } from '#dom/menu'
import { axisLeft, axisBottom, axisTop } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { sayerror } from '#dom/error'
import { dofetch3 } from '#common/dofetch'
import { getColors } from '#shared/common'

export const minDotSize = 9
export const maxDotSize = 300
class SingleCellView {
	constructor() {
		this.type = 'singleCellView'
		this.width = 800
		this.height = 600
		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		//read files data
		const controlsDiv = this.opts.holder.insert('div').style('display', 'inline-block')
		this.mainDiv = this.opts.holder
			.insert('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('padding', '10px')
		this.sampleDiv = this.mainDiv.insert('div').style('display', 'inline-block')

		const offsetX = 80
		this.axisOffset = { x: offsetX, y: 30 }
		const controlsHolder = controlsDiv.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block')

		this.dom = {
			header: this.opts.header,
			//holder,
			loadingDiv: this.opts.holder.append('div').style('position', 'absolute').style('left', '45%').style('top', '60%'),
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder
		}

		const body = { genome: appState.vocab.genome, dslabel: appState.vocab.dslabel }
		try {
			const result = await dofetch3('termdb/singlecellSamples', { body })
			if (result.error) throw result.error
			this.samples = result.samples
			this.samples.sort((elem1, elem2) => {
				const result = elem1.primarySite?.localeCompare(elem2.primarySite)
				if (result == 1 || result == -1) return result
				else return elem1.sample.localeCompare(elem2.sample)
			})
		} catch (e) {
			sayerror(this.mainDiv, e)
			return
		}

		this.sampleDiv.insert('label').style('vertical-align', 'top').html('Samples:')
		const sample = this.samples[0]
		const input = this.sampleDiv
			.append('input')
			.attr('list', 'sampleDatalist')
			.attr('placeholder', sample.sample)
			.style('width', '500px')
			.on('change', e => {
				const sample = input.node().value
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { sample: sample } })
			})
		const datalist = this.sampleDiv.append('datalist').attr('id', 'sampleDatalist')
		datalist
			.selectAll('option')
			.data(this.samples)
			.enter()
			.append('option')
			.attr('value', d => d.sample)
			.attr('label', d => ('primarySite' in d ? `${d.primarySite} | ${d.diseaseType}` : ''))

		this.settings = {}
		if (this.dom.header) this.dom.header.html('Single Cell Data')
		this.table = this.mainDiv
			.append('div')
			.style('padding-top', '10px')
			.append('table')
			.style('width', '95vw')
			.style('border-collapse', 'collapse')
	}
	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			sample: config.sample || this.samples[0].sample,
			dslabel: appState.vocab.dslabel,
			genome: appState.vocab.genome
		}
	}

	// called in relevant dispatch when reactsTo==true
	// or current.state != replcament.state
	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.table.selectAll('*').remove()
		copyMerge(this.settings, this.config.settings.singleCellView)
		const sampleData = this.samples.find(s => s.sample == this.state.sample)
		this.plotsData = {}
		this.colorMap = {}
		this.headerTr = this.table.append('tr')
		this.tr = this.table.append('tr')

		if (sampleData.files) {
			for (const file of sampleData.files) {
				const body = { genome: this.state.genome, dslabel: this.state.dslabel, sample: file.fileId }
				try {
					const result = await dofetch3('termdb/singlecellData', { body })
					if (result.error) throw result.error
					for (const plot of result.plots) {
						plot.clusterMap = result.tid2cellvalue.cellType
						this.renderPlot(plot)
					}
				} catch (e) {
					if (e.stack) console.log(e.stack)
					sayerror(this.mainDiv, e)
					return
				}
			}
		} else {
			const body = { genome: this.state.genome, dslabel: this.state.dslabel, sample: sampleData.sample }
			try {
				const result = await dofetch3('termdb/singlecellData', { body })
				if (result.error) throw result.error
				for (const plot of result.plots) {
					plot.clusterMap = result.tid2cellvalue.cellType
					this.renderPlot(plot)
				}
			} catch (e) {
				if (e.stack) console.log(e.stack)
				sayerror(this.mainDiv, e)
				return
			}
		}
	}

	renderPlot(plot) {
		const cells2Clusters = plot.cells.map(c => {
			c.clusterMap = plot.clusterMap
			return plot.clusterMap[c.cellId]
		})
		let clusters = new Set(cells2Clusters)
		clusters = Array.from(clusters).sort()
		const cat2Color = getColors(clusters.length)
		for (const cluster of clusters) this.colorMap[cluster] = cat2Color(cluster)
		this.initAxes(plot)

		this.headerTr
			.append('td')
			.style('font-weight', 'bold')
			.style('border', '1px solid #d3d3d3')
			.style('padding', '5px')
			.text(plot.name)
			.style('background-color', '#d3d3d3')
			.style('fo')
		this.svg = this.tr
			.append('td')
			.style('text-align', 'center')
			.style('border', '1px solid #d3d3d3')
			.append('svg')
			.attr('width', this.width + 200)
			.attr('height', this.height)
			.on('mousemove', event => this.onMouseOver(event))

		this.legendG = this.svg
			.append('g')
			.attr('transform', `translate(${this.width + 20}, 50)`)
			.style('font-size', '0.9em')

		const symbols = this.svg.selectAll('path').data(plot.cells)

		symbols
			.enter()
			.append('g')
			.attr('transform', c => `translate(${plot.xAxisScale(c.x)}, ${plot.yAxisScale(c.y)})`)
			.append('circle')
			.attr('r', 2)
			.attr('fill', d => cat2Color(d.clusterMap[d.cellId]))

		this.renderLegend(plot, cells2Clusters)
	}

	renderLegend(plot, cells2Clusters) {
		const legendG = this.legendG
		legendG.append('text').style('font-weight', 'bold').text(`${plot.cells.length} cells`)
		const step = 25
		let y = 40
		let x = 0
		for (const cluster in this.colorMap) {
			const n = cells2Clusters.filter(item => item == cluster).length
			const color = this.colorMap[cluster]
			const itemG = legendG.append('g').attr('transform', c => `translate(${x}, ${y})`)
			itemG.append('circle').attr('r', 3).attr('fill', color)
			itemG
				.append('g')
				.attr('transform', `translate(${x + 10}, ${5})`)
				.append('text')
				.text(`${cluster} n=${n}`)
			y += step
		}
	}

	initAxes(plot) {
		const s0 = plot.cells[0]
		const [xMin, xMax, yMin, yMax] = plot.cells.reduce(
			(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
			[s0.x, s0.x, s0.y, s0.y]
		)
		const r = 5
		plot.xAxisScale = d3Linear()
			.domain([xMin, xMax])
			.range([0 + r, this.height - 5])
		plot.axisBottom = axisBottom(plot.xAxisScale)
		plot.yAxisScale = d3Linear()
			.domain([yMax, yMin])
			.range([0 + r, this.height - r])
		plot.axisLeft = axisLeft(plot.yAxisScale)
	}

	onMouseOver(event) {
		if (event.target.tagName == 'circle') {
			const d = event.target.__data__
			const menu = this.tip.clear()
			const table = menu.d.append('table')
			let tr = table.append('tr')
			const cluster = d.clusterMap[d.cellId]
			tr.append('td').style('color', '#aaa').text('Id')
			tr.append('td').text(`${d.cellId}`)
			tr = table.append('tr')
			tr.append('td').style('color', '#aaa').text('Cluster')
			const td = tr.append('td')
			const svg = td.append('svg').attr('width', 150).attr('height', 25)
			const x = 15
			const y = 18
			const g = svg.append('g').attr('transform', `translate(${x}, ${y})`)
			g.append('circle').attr('fill', this.colorMap[cluster]).attr('r', 4)
			svg
				.append('g')
				.attr('transform', `translate(${x + 15}, ${y + 4})`)
				.append('text')
				.text(`Cluster ${cluster}`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	onMouseOut(event) {
		this.tip.hide()
	}
}

export const scatterInit = getCompInit(SingleCellView)
// this alias will allow abstracted dynamic imports
export const componentInit = scatterInit

export async function getPlotConfig(opts, app) {
	try {
		const settings = getDefaultSingleCellSettings()
		const config = {
			settings: {
				singleCellView: settings
			}
		}
		// may apply term-specific changes to the default object
		const result = copyMerge(config, opts)
		return result
	} catch (e) {
		console.log(e)
		throw `${e} [singleCellView getPlotConfig()]`
	}
}

export function getDefaultSingleCellSettings() {
	return {
		svgw: 800,
		svgh: 800,
		svgd: 800
	}
}
