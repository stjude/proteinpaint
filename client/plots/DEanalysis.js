import * as client from '../src/client'
import * as d3axis from 'd3-axis'
import { select as d3select } from 'd3-selection'
import { getCompInit, copyMerge } from '#rx'
import { scaleLog, scaleLinear } from 'd3-scale'
import { d3lasso } from '../common/lasso'
/*

opts{}
	samplelst{}
		groups[]

this{}
	app{}
		vocabApi
*/

const hlcolor = '#ffa200'
const tip = new client.Menu()
class DEanalysis {
	constructor() {
		this.type = 'DEanalysis'
	}
	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder,
			controlsDiv: holder.append('div')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config
		}
	}

	async main() {
	        const data = await this.app.vocabApi.runDEanalysis(this.state.config)	        
	        //console.log(data)
	        render_volcano(this.dom.holder,data)
	}
}


function render_volcano(holder, mavb) {
	/*
m {}
- gene
- logfoldchange
- averagevalue
- pvalue

add:
- vo_circle
*/
	let minlogfc = 0,
		maxlogfc = 0,
		minlogpv = 0,
		maxlogpv = 0
	for (const d of mavb) {
		minlogfc = Math.min(minlogfc, d.fold_change)
		maxlogfc = Math.max(maxlogfc, d.fold_change)
		if (d.adjusted_p_value == 0) {
			continue
		} else {
			minlogpv = Math.min(minlogpv, d.adjusted_p_value)
			maxlogpv = Math.max(maxlogpv, d.adjusted_p_value)
		}
	}

	let yaxisw,
		xaxish,
		width,
		height,
		xpad,
		ypad,
		toppad = 50,
		rightpad = 50,
		radius
	const svg = holder.append('svg')
	const yaxisg = svg.append('g')
	const xaxisg = svg.append('g')
	const xlab = svg
		.append('text')
		.text('log2(fold change)')
		.attr('fill', 'black')
		.attr('text-anchor', 'middle')
	const ylab = svg
		.append('text')
		.text('-log10(adjusted P value)')
		.attr('fill', 'black')
		.attr('text-anchor', 'middle')

	mavb.vo_dotarea = svg.append('g')

	const box = mavb.vo_dotarea
		.append('rect')
		.attr('stroke', '#ededed')
		.attr('fill', 'none')
	      .attr('shape-rendering', 'crispEdges')
	const xscale = scaleLinear().domain([minlogfc, maxlogfc])
	const yscale = scaleLinear().domain([minlogpv, maxlogpv])
        let radiusscale
	const dotg = mavb.vo_dotarea
		.selectAll()
		.data(mavb)
		.enter()
		.append('g')
		.each(function(d) {
			d.vo_g = this
		})
	const circle = dotg
		.append('circle')
		.attr('stroke', 'black')
		.attr('stroke-opacity', 0.2)
		.attr('stroke-width', 1)
		.attr('fill', hlcolor)
		.attr('fill-opacity', 0)
		.each(function(d) {
			d.vo_circle = this
		})
		.on('mouseover', circlemouseover)
		.on('mouseout', circlemouseout)
		.on('click', (event, d) => {
			circleclick(d, mavb, event.clientX, event.clientY)
		})

	const logfc0line = mavb.vo_dotarea
		.append('line')
		.attr('stroke', '#ccc')
		.attr('shape-rendering', 'crispEdges')

	function resize(w, h) {
		width = w
		height = h
		yaxisw = Math.max(50, width / 8)
		xaxish = Math.max(50, height / 8)

		radius = Math.max(width, height) / 80
		const maxradius = radius * 3
		if (radiusscale) radiusscale.range([radius, maxradius])
		circle.each(d => {
			d.vo_radius = radiusscale ? radiusscale(Math.abs(d.tvalue)) : radius
		})

		xpad = Math.max(maxradius, width / 50)
		ypad = Math.max(maxradius, height / 50)
		yaxisg.attr('transform', 'translate(' + yaxisw + ',' + toppad + ')')
		xaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (toppad + height + ypad) + ')')
		xlab.attr('x', yaxisw + xpad + width / 2).attr('y', toppad + height + ypad + xaxish - 5)
		ylab.attr('transform', 'translate(15,' + (toppad + height / 2) + ') rotate(-90)')
		mavb.vo_dotarea.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + toppad + ')')
		box.attr('width', width).attr('height', height)
		xscale.range([0, width])
		yscale.range([height, 0])
		dotg.attr('transform', d => {
			return (
				'translate(' + xscale(d.fold_change) + ',' + yscale(d.adjusted_p_value == 0 ? maxlogpv : d.adjusted_p_value, 10) + ')'
			)
		})
		circle.attr('r', d => {
			return d.vo_radius
		})
		logfc0line
			.attr('x1', xscale(0))
			.attr('x2', xscale(0))
			.attr('y2', height)

		svg.attr('width', yaxisw + xpad + width + rightpad).attr('height', toppad + height + ypad + xaxish)
		client.axisstyle({
			axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
			color: 'black',
			showline: true
		})
		client.axisstyle({
			axis: xaxisg.call(d3axis.axisBottom().scale(xscale)),
			color: 'black',
			showline: true
		})
	}
	resize(400, 400)

        if (mavb[0].adjusted_p_value != undefined) {
		// enable pvalue switching between adjusted and unadjusted
		const row = holder.append('div').style('margin', '20px')
		row.append('span').text('Select P value for Volcano plot:')
		const select = row
			.append('select')
			.style('margin-left', '5px')
			.on('change', event => {
				minlogpv = 0
				maxlogpv = 0
				const useun = select.node().selectedIndex == 0
				for (const d of mavb) {
				        const pv = useun ? d.adjusted_p_value : d.original_p_value
					if (pv == 0) continue
					minlogpv = Math.min(minlogpv, pv)
					maxlogpv = Math.max(maxlogpv, pv)
				}
				yscale.domain([minlogpv, maxlogpv])
				client.axisstyle({
					axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
					color: 'black',
					showline: true
				})
				dotg.attr('transform', d => {
					const pv = useun ? d.adjusted_p_value : d.original_p_value 
					return 'translate(' + xscale(d.fold_change) + ',' + yscale(pv == 0 ? maxlogpv : pv) + ')'
				})
				ylab.text(useun ? '-log10(adjusted P value)' : '-log10(original P value)')
			})
	                select.append('option').text('Adjusted P value')
	    		select.append('option').text('Original P value')
	}

	// add lasso for volcano plot
	// TODO: remove follow line after testing
	add_lasso(dotg.selectAll('circle'), svg, 'ma_circle')
	return svg
}


export async function getPlotConfig(opts, app) {
	try {
		if (opts.samplelst.groups?.length != 2) throw 'opts.samplelst.groups[].length!=2'
		if (opts.samplelst.groups[0].values?.length < 1) throw 'group 1 not having >1 samples'
		if (opts.samplelst.groups[1].values?.length < 1) throw 'group 2 not having >1 samples'
		const config = {}
		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [DEanalysis getPlotConfig()]`
	}
}

export const DEanalysisInit = getCompInit(DEanalysis)
// this alias will allow abstracted dynamic imports
export const componentInit = DEanalysisInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
        termdbConfig is accessible at chartsInstance.state.termdbConfig{}
        mass option is accessible at chartsInstance.app.opts{}
	*/
	// to fill in menu, create options in "holder"
	// to hide menu, call chartsInstance.dom.tip.hide()
	// upon clicking an option, generate plot:
	chartsInstance.prepPlot({
		config: {
			chartType: 'DEanalysis'
		}
	})
}


function circlemouseover(event, d) {
	tip.clear().show(event.clientX, event.clientY)
    const lst = [
		{ k: 'gene_name', v: d.gene_name },
		{ k: 'gene_symbol', v: d.gene_symbol },
		{ k: 'log fold change', v: d.fold_change },
	        { k: 'log original p-value', v: d.original_p_value },
		{ k: 'log adjusted p-value', v: d.adjusted_p_value }	
	]
	client.make_table_2col(tip.d, lst)

	if (!d.ma_label) {
		d3select(d.ma_circle).attr('fill-opacity', 0.9)
		d3select(d.vo_circle).attr('fill-opacity', 0.9)
	}
}

function circlemouseout(event, d) {
	tip.hide()
	if (!d.ma_label) {
		d3select(d.ma_circle).attr('fill-opacity', 0)
		d3select(d.vo_circle).attr('fill-opacity', 0)
	}
}


// example of lasso function and usage
function add_lasso(selectable_items, svg, other_svg_item_key) {
	const lasso = d3lasso()
		.items(selectable_items)
		.targetArea(svg)

	function mavb_lasso_start() {
		// set all dots to initial state when lasso starts
		svg
			.selectAll('.possible')
			.style('fill-opacity', 0)
			.classed('not_possible', true)
			.classed('selected', false)
			.each(d => {
				d3select(d[other_svg_item_key]).attr('fill-opacity', 0)
			})

		// TODO: remove following commented code after review
		// here, there are many circles, so rather than applying style to add circles,
		// only previously selected circles are reverted back to normal
		// can use like following as well, for detail example see mds.scatterplot.js
		// lasso.items()
		// 	.style('fill-opacity', 0)
		// 	.classed('not_possible', true)
		// 	.classed('selected', false)
		// 	.each((d) =>{
		// 		d3select(d[other_svg_item_key]).attr('fill-opacity', 0)
		// 	})
	}

	function mavb_lasso_draw() {
		// Style the possible dots, when selected using lasso
		lasso
			.possibleItems()
			.style('fill-opacity', 0.9)
			.classed('not_possible', false)
			.classed('possible', true)
			.each(d => {
				d3select(d[other_svg_item_key]).attr('fill-opacity', 0.9)
			})
	}

	function mavb_lasso_end() {
		// do something, like show menu or open info panel for selected samples
	}

	// perform following custom drag events after original lasso drag events finish in lasso.js
	lasso
		.on('start', mavb_lasso_start)
		.on('draw', mavb_lasso_draw)
		.on('end', mavb_lasso_end)

	svg.call(lasso)
}
