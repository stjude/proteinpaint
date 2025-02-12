import { getCompInit } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { select as d3select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { line as d3line, curveBasis as d3curveBasis } from 'd3-shape'
import { min as d3min, max as d3max } from 'd3-array'
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'

class pathwayAnalysis {
	constructor(opts) {
		this.type = 'pathwayAnalysis'
	}
	async init(appState) {
		/*
        const leftDiv = this.opts.holder.insert('div').style('display', 'inline-block')
        const controlsDiv = leftDiv
            .insert('div')
            .style('display', 'inline-block')
            .attr('class', 'pp-termdb-plot-controls')
        */
		const controlsDiv = this.opts.holder.append('div').style('display', 'inline-block').text('controlsDiv')
		const mainDiv = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('margin-left', '50px')
			.text('mainDiv')
		//this.mainDiv = this.opts.holder.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
		const holder = mainDiv.append('div').style('display', 'inline-block').text('holder')
		this.dom = {
			holder,
			header: this.opts.header,
			controlsDiv
		}
	}

	async main() {
		try {
			//const config = this.state.plots.find(p => p.id === this.id)
			// mapping the query ID to KEGG ID
			const compdConfig = await getKeggID(this)
			const pathwayID = 'ko01100'
			const kdata = await getKeggKgml(pathwayID, compdConfig)
			this.dom.header.html('<span style="font-size:.8em;opacity:.7">Metabolic pathway</span>')
			renderPathway(this, kdata)
			//this.config = JSON.parse(JSON.stringify(this.state.config))
		} catch (e) {
			console.error(e)
		}
	}
}

async function renderPathway(self, kdata) {
	const holder = self.dom.holder
	holder.selectAll('*').remove()
	const cpd = JSON.parse(kdata[0])
	const ko = JSON.parse(kdata[1])
	const path = JSON.parse(kdata[2])
	console.log(path)
	const width = 900,
		height = 600
	const margin = { top: 20, right: 30, bottom: 30, left: 40 }
	// calculate the min and max of x and y
	const cpdMinx = d3min(cpd, d => d.x)
	const cpdMiny = d3min(cpd, d => d.y)
	const cpdMaxx = d3max(cpd, d => d.x)
	const cpdMaxy = d3max(cpd, d => d.y)
	const koMinx = d3min(ko, d => d3min(d.coords, c => c[0]))
	const koMaxx = d3max(ko, d => d3max(d.coords, c => c[0]))
	const koMiny = d3min(ko, d => d3min(d.coords, c => c[1]))
	const koMaxy = d3max(ko, d => d3max(d.coords, c => c[1]))
	const minx = Math.min(cpdMinx, koMinx)
	const maxx = Math.max(cpdMaxx, koMaxx)
	const miny = Math.min(cpdMiny, koMiny)
	const maxy = Math.max(cpdMaxy, koMaxy)
	console.log([minx - 10, maxx + 10])
	console.log([miny - 10, maxy + 10])

	const xScale = scaleLinear()
		.domain([minx - 10, maxx + 10])
		.range([margin.left, width - margin.right])
	const yScale = scaleLinear()
		.domain([miny - 10, maxy + 10])
		.range([height - margin.bottom, margin.top])
	const line = d3line()
		.curve(d3curveBasis)
		.x(d => xScale(d[0]))
		.y(d => yScale(d[1]))

	const zoom = d3zoom().scaleExtent([0.7, 10]).on('zoom', zoomed)
	function zoomed({ transform }) {
		svg.attr('transform', transform)
	}
	const svg = holder
		.append('svg')
		.attr('width', width)
		.attr('height', height)
		.attr('viewBox', [0, 0, width, height])
		.call(zoom)
	svg
		.append('defs')
		.append('filter')
		.attr('id', 'glow')
		.attr('filterUnits', 'userSpaceOnUse')
		.attr('x', '-20%')
		.attr('y', '-20%')
		.attr('width', '200%')
		.attr('height', '200%')
		.append('feGaussianBlur')
		.attr('stdDeviation', 1.5)
		.attr('result', 'glow')
		.append('style').text(`
            .my-shape:hover {
                filter: url(#glow);
            }`)
	svg
		.select('defs')
		.select('filter')
		.append('feMerge')
		.selectAll('feMergeNode')
		.data(['glow', 'SourceGraphic'])
		.enter()
		.append('feMergeNode')
		.attr('in', d => d)

	const tooltip = d3select('body')
		.append('div')
		.style('position', 'absolute')
		.style('visibility', 'hidden')
		.style('background-color', 'white')
		.style('border', '1px solid #ccc')
		.style('padding', '5px')

	const pa_area = svg.append('g')
	pa_area
		.append('g')
		.append('rect')
		.attr('id', 'BG')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', width)
		.attr('height', height)
		.attr('fill', '#ffffff')
		.style('stroke-width', 1)
		.style('stroke', '#000000')

	pa_area
		.append('g')
		.selectAll('path')
		.data(ko)
		.enter()
		.append('path')
		.attr('d', d => line(d.coords))
		.attr('fill', 'none')
		.attr('stroke', d => d.fgcolor)
		.attr('stroke-width', 0.7)
		.style('cursor', 'pointer')
		.attr('class', 'my-shape')
		.on('mousedown', function (event, d) {
			tooltip
				.text(d.name)
				.style('visibility', 'visible')
				.style('left', event.pageX + 10 + 'px')
				.style('top', event.pageY - 20 + 'px')
		})
		.on('mouseout', function () {
			tooltip.style('visibility', 'hidden')
		})
	pa_area
		.append('g')
		.selectAll('circle')
		.data(cpd)
		.enter()
		.append('circle')
		.attr('cx', d => xScale(d.x))
		.attr('cy', d => yScale(d.y))
		.attr('r', 2)
		.attr('fill', d => d.fgcolor)
		.style('cursor', 'pointer')
		.attr('class', 'my-shape')
		.on('mousedown', function (event, d) {
			tooltip
				.text(d.name)
				.style('visibility', 'visible')
				.style('left', event.pageX + 10 + 'px')
				.style('top', event.pageY - 20 + 'px')
		})
		.on('mouseout', function () {
			tooltip.style('visibility', 'hidden')
		})
	pa_area
		.append('g')
		.selectAll('text')
		.data(path)
		.enter()
		.append('text')
		.attr('x', d => xScale(d.x))
		.attr('y', d => yScale(d.y))
		.text(d => d.graphics_name)
		.attr('fill', d => d.fgcolor)
		.attr('font-size', 10)
		.attr('text-anchor', 'middle')
		.attr('alignment-baseline', 'middle')
	/*
    nodes.forEach(node => {
        pa_area.append('circle')
            .attr('cx', xScale(node.x))
            .attr('cy', yScale(node.y))
            .attr('r', 2)
            .attr('fill', node.fgcolor)
            .style({
                'cursor': 'pointer'
            })
    })

    coords.forEach(d => {
        const dPath = [
            { x: d.x, y: d.y },
            { x: d.xend, y: d.yend }
        ]
        pa_area.append('path')
            .data([dPath])
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', d.fgcolor)
            .attr('stroke-width', 0.7)
            .style({
                'cursor': 'pointer'
            })
    })
    */
	return svg
}

async function getKeggID(self) {
	const config = self.state.plots.find(p => p.id === self.id)
	const body = {
		genome: self.state.vocab.genome,
		dslabel: self.state.vocab.dslabel,
		selecti: config.compoundType
	}
	// comlst: config.compoundInput,
	const data = config.compoundInput
	if (data === '') return
	const comlst = [], // array of compound
		elemSelect = {} // key: query; element selection including kegg id, color, width and opacity
	for (const line0 of data.trim().split('\n')) {
		const line = line0.trim()
		if (line === '') continue // skip empty line
		const l = line.split(line.includes('\t') ? '\t' : line.includes(',') ? ',' : ' ')
		// each line may or may not have 4 elements(id, color, width, opacity)
		comlst.push(l[0])
		elemSelect[l[0]] = { query: l[0] }
		if (l.length > 1) {
			elemSelect[l[0]].color = l[1]
		}
		if (l.length > 2) {
			elemSelect[l[0]].width = l[2]
		}
		if (l.length > 3) {
			elemSelect[l[0]].opacity = l[3]
		}
	}
	if (comlst.length === 0) return
	body.comlst = comlst
	const res = await dofetch3('pathwayAnalysisId', { body })
	if (res.error) {
		console.error(res.error)
		return
	}
	for (const k of Object.keys(elemSelect)) {
		elemSelect[k].KEGG = res.keggids[k]
	}
	return elemSelect
}

async function getKeggKgml(koid, compdConfig) {
	const body = {
		compoundJson: JSON.stringify(compdConfig),
		keggid: koid
	}
	const res = await dofetch3('pathwayAnalysisKegg', { body })
	if (res.error) {
		console.error(res.error)
		return
	}
	return JSON.parse(res.keggPathwayData)
}

export const pathwayAnalysisInit = getCompInit(pathwayAnalysis)
// this alias will allow abstracted dynamic imports
export const componentInit = pathwayAnalysisInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
    holder: the holder in the tooltip
    chartsInstance: MassCharts instance
    mass option is accessible at chartsInstance.app.opts{}
    */
	chartsInstance.dom.tip.clear()
	const menuDiv = holder.append('div')
	const paDiv = menuDiv.append('div').style('margin', '20px')
	paDiv.append('p').text('Please enter compound list:')
	const txtDiv = paDiv.append('textarea').attr('cols', '50').attr('rows', '5').property('placeholder', 'Enter data')
	txtDiv.node().focus()
	const s = paDiv.append('div').style('margin-top', '5px'),
		a = s.append('select')
	a.append('option').text('Compound Name')
	// to do support for other options: HMDB ID, KEGG ID
	s.append('button')
		.style('margin-left', '5px')
		.text('Submit')
		.on('click', () => {
			chartsInstance.dom.tip.hide()
			chartsInstance.prepPlot({
				config: {
					chartType: 'pathwayAnalysis',
					compoundInput: txtDiv.node().value,
					compoundType: a.node().selectedIndex
				}
			})
		})
	s.append('button')
		.text('Clear')
		.style('margin-left', '5px')
		.on('click', () => {
			txtDiv.property('value', '')
		})
}
