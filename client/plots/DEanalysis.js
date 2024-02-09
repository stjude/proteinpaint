import * as client from '../src/client'
import { renderTable } from '../dom/table'
import * as d3axis from 'd3-axis'
import { controlsInit } from './controls'
import { select as d3select } from 'd3-selection'
import { getCompInit, copyMerge } from '#rx'
import { scaleLog, scaleLinear } from 'd3-scale'
import { d3lasso } from '../common/lasso'
import { downloadTable } from '../dom/table'
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
		const config = opts.plots.find(p => p.id === this.id)
		const controlsDiv = this.opts.holder.append('div').style('display', 'inline-block')
		const holder = this.opts.holder.append('div').style('display', 'inline-block')
		this.dom = {
			holder,
			header: this.opts.header,
			controlsDiv
		}
	}

	async setControls(output) {
		this.dom.controlsDiv.selectAll('*').remove()
		const inputs = [
			{
				label: 'P-value significance (linear scale)',
				type: 'number',
				chartType: 'DEanalysis',
				settingsKey: 'pvalue',
				title: 'P-value significance',
				min: 0,
				max: 1
			},
			{
				label: 'Fold change (log scale)',
				type: 'number',
				chartType: 'DEanalysis',
				settingsKey: 'foldchange',
				title: 'Fold change',
				min: -10,
				max: 10
			},
			{
				label: 'P-value table',
				type: 'checkbox',
				chartType: 'DEanalysis',
				settingsKey: 'pvaluetable',
				title: 'Display table showing original and adjusted pvalues for all significant genes',
				boxLabel: ''
			},
			{
				label: 'P-value',
				type: 'radio',
				chartType: 'DEanalysis',
				settingsKey: 'adjusted_original_pvalue',
				title: 'Toggle between original and adjusted pvalues for volcano plot',
				options: [
					{ label: 'adjusted', value: 'adjusted' },
					{ label: 'original', value: 'original' }
				]
			}
		]

		if (
			(output.mid_sample_size_cutoff >= output.sample_size1 && output.mid_sample_size_cutoff < output.sample_size2) ||
			(output.mid_sample_size_cutoff >= output.sample_size2 && output.mid_sample_size_cutoff < output.sample_size1)
		) {
			// Invoked only when one sample size is low than the mid_sample_size_cutoff and the other one is higher
			inputs.push({
				label: 'Method',
				type: 'radio',
				chartType: 'DEanalysis',
				settingsKey: 'method',
				title: 'Toggle between edgeR and wilcoxon test',
				options: [
					{ label: 'edgeR', value: 'edgeR' },
					{ label: 'wilcoxon', value: 'wilcoxon' }
				]
			})
			this.settings.method = output.method
			this.state.config = output.method
		}

		console.log('this.settings:', this.settings)
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs: inputs
			})
		}
		this.components.controls.on('downloadClick.DEanalysis', () => {
			downloadTable(this.table_rows, this.table_cols)
		})
	}
	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config
		}
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.settings = this.config.settings.DEanalysis
		console.log('this.state.config:', this.state.config)
		const output = await this.app.vocabApi.runDEanalysis(this.state.config)
		output.mid_sample_size_cutoff = 30 // mid sample size cutoff for method toggle to appear
		await this.setControls(output)
		//const state = this.app.getState()
		//console.log('state:', state)
		//if (state.customTerms[0].name) {
		//	const headerText = state.customTerms[0].name
		//	this.dom.header
		//		.append('span')
		//		.style('color', '#999999')
		//		.text(headerText)
		//		.append('span')
		//		.style('font-size', '0.75em')
		//		.style('opacity', 0.6)
		//		.style('padding-left', '10px')
		//		.text('DIFFERENTIAL EXPRESSION')
		//} else {
		this.dom.header
			.style('opacity', 0.6)
			.style('padding-left', '10px')
			.style('font-size', '0.75em')
			.text('DIFFERENTIAL EXPRESSION')
		render_volcano(this.dom.holder, output.data, this)
	}
}

function render_volcano(holder, mavb, self) {
	/*
m {}
- gene
- logfoldchange
- averagevalue
- pvalue

add:
- vo_circle
	*/

	// Delete previous holder, if present
	holder.selectAll('*').remove()
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
	const xlab = svg.append('text').text('log2(fold change)').attr('fill', 'black').attr('text-anchor', 'middle')
	const ylab = svg.append('text').text('-log10(adjusted P value)').attr('fill', 'black').attr('text-anchor', 'middle')

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
		.each(function (d) {
			d.vo_g = this
		})
	const fold_change_cutoff = self.settings.foldchange
	if (self.settings.pvalue == 0) throw 'p-value significance cannot be zero'
	const p_value_cutoff = -Math.log10(self.settings.pvalue)
	const p_value_adjusted_original = self.settings.adjusted_original_pvalue
	let num_significant_genes = 0
	let num_non_significant_genes = 0
	self.table_rows = []
	const circle = dotg
		.append('circle')
		.attr('stroke', d => {
			let color
			//console.log("Gene name:", d.gene_name, " Gene Symbol:", d.gene_symbol, " original p-value:", d.original_p_value, " adjusted p-value:", d.adjusted_p_value)
			if (
				p_value_adjusted_original == 'adjusted' &&
				d.adjusted_p_value > p_value_cutoff &&
				Math.abs(d.fold_change) > fold_change_cutoff
			) {
				color = 'red'
				num_significant_genes += 1
				self.table_rows.push([
					{ value: d.gene_name },
					{ value: d.gene_symbol },
					{ value: d.fold_change },
					{ value: Math.pow(10, -d.original_p_value) },
					{ value: Math.pow(10, -d.adjusted_p_value) }
				])
			} else if (
				p_value_adjusted_original == 'original' &&
				d.original_p_value > p_value_cutoff &&
				Math.abs(d.fold_change) > fold_change_cutoff
			) {
				color = 'red'
				num_significant_genes += 1
				self.table_rows.push([
					{ value: d.gene_name },
					{ value: d.gene_symbol },
					{ value: d.fold_change },
					{ value: Math.pow(10, -d.original_p_value) },
					{ value: Math.pow(10, -d.adjusted_p_value) }
				])
			} else {
				color = 'black'
				num_non_significant_genes += 1
			}
			return color
		})
		.attr('stroke-opacity', 0.2)
		.attr('stroke-width', 1)
		.attr('fill', hlcolor)
		.attr('fill-opacity', 0)
		.each(function (d) {
			d.vo_circle = this
		})
		.on('mouseover', circlemouseover)
		.on('mouseout', circlemouseout)
	//.on('click', (event, d) => {
	//	circleclick(d, mavb, event.clientX, event.clientY)
	//})
	self.table_rows.sort((a, b) => a[2].value - b[2].value).reverse() // Sorting genes in descending order of fold change
	//console.log(
	//	'Percentage of significant genes:',
	//	(num_significant_genes * 100) / (num_significant_genes + num_non_significant_genes)
	//)

	const logfc0line = mavb.vo_dotarea.append('line').attr('stroke', '#ccc').attr('shape-rendering', 'crispEdges')

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
			return 'translate(' + xscale(d.fold_change) + ',' + yscale(d.adjusted_p_value) + ')'
		})
		circle.attr('r', d => {
			return d.vo_radius
		})
		logfc0line.attr('x1', xscale(0)).attr('x2', xscale(0)).attr('y2', height)

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
		minlogpv = 0
		maxlogpv = 0
		let text_string
		for (const d of mavb) {
			let pv
			if (p_value_adjusted_original == 'adjusted') {
				pv = d.adjusted_p_value
			} else {
				pv = d.original_p_value
			}
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
			let pv
			if (p_value_adjusted_original == 'adjusted') {
				pv = d.adjusted_p_value
			} else {
				pv = d.original_p_value
			}
			return 'translate(' + xscale(d.fold_change) + ',' + yscale(pv) + ')'
		})
		if (p_value_adjusted_original == 'adjusted') {
			text_string = '-log10(adjusted P value)'
		} else {
			text_string = '-log10(original P value)'
		}
		ylab.text(text_string)
		holder
			.append('div')
			.html(
				'Percentage of significant genes:' +
					((num_significant_genes * 100) / (num_significant_genes + num_non_significant_genes)).toFixed(2) +
					'<br>Number of significant genes:' +
					num_significant_genes +
					'<br>Sample size of group1:' +
					holder.sample_size1 +
					'<br>Sample size of group2:' +
					holder.sample_size2
			)
		self.table_cols = [
			{ label: 'Gene Name' },
			{ label: 'Gene Symbol' },
			{ label: 'log2 Fold change' },
			{ label: 'Original p-value (linear scale)' },
			{ label: 'Adjusted p-value (linear scale)' }
		]
		if (self.settings.pvaluetable == true) {
			const d = holder.append('div').html(`<br>DE analysis results`)
			renderTable({
				columns: self.table_cols,
				rows: self.table_rows,
				div: d,
				showLines: true,
				maxHeight: '150vh',
				resize: true
			})
		}
	}
	return svg
}

export async function getPlotConfig(opts, app) {
	try {
		if (opts.samplelst.groups.length != 2) throw 'opts.samplelst.groups[].length!=2'
		if (opts.samplelst.groups[0].values?.length < 1) throw 'group 1 not having >1 samples'
		if (opts.samplelst.groups[1].values?.length < 1) throw 'group 2 not having >1 samples'
		console.log('opts:', opts)
		const config = {
			//idea for fixing nav button
			//samplelst: { groups: app.opts.state.groups}
			settings: {
				DEanalysis: {
					pvalue: 0.05,
					foldchange: 2,
					pvaluetable: false,
					adjusted_original_pvalue: 'adjusted',
					method: undefined
				},
				controls: {
					isOpen: false // control panel is hidden by default
				}
			}
		}
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

export async function openHiercluster(term, samplelstTW, app, id, newId) {
	// barchart config.term{} name is confusing, as it is actually a termsetting object, not t    erm
	// thus convert the given term into a termwrapper
	// tw.q can be missing and will be filled in with default setting
	const tw = term.term ? term : { id: term.id, term }

	let config = {
		chartType: 'hierCluster',
		genes: ['barchart', xxx]
	}
	if (id) config.insertBefore = id
	if (newId) config.id = newId()
	await app.dispatch({
		type: 'plot_create',
		config
	})
}
