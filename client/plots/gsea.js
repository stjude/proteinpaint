import * as d3axis from 'd3-axis'
import { axisstyle } from '#dom/axisstyle'
import { renderTable } from '../dom/table'
import { table2col } from '#dom/table2col'
import { dofetch3 } from '#common/dofetch'
import { controlsInit } from './controls'
import { getCompInit, copyMerge } from '#rx'
import { Menu } from '../dom/menu'
import { scaleLog, scaleLinear } from 'd3-scale'

const tip = new Menu()

// table columns showing analysis results for each gene set
const gsea_table_cols = [
	{ label: 'Pathway name' },
	{ label: 'enrichment score' },
	{ label: 'normalized enrichment score' },
	{ label: 'Geneset size' },
	{ label: 'pvalue' },
	{ label: 'sidak' },
	{ label: 'FDR' },
	{ label: 'Leading edge' }
]

class gsea {
	constructor() {
		this.type = 'gsea'
	}
	async init(opts) {
		const config = opts.plots.find(p => p.id === this.id)
		const controlsDiv = this.opts.holder.append('div').style('display', 'inline-block')
		const mainDiv = this.opts.holder.append('div').style('display', 'inline-block').style('margin-left', '50px')
		const holder = mainDiv.append('div').style('display', 'inline-block')
		const detailsDiv = mainDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '50px')

		const tableDiv = this.opts.holder.append('div').style('margin-left', '50px')

		this.dom = {
			holder,
			header: this.opts.header,
			controlsDiv,
			detailsDiv,
			tableDiv
		}
	}

	async setControls() {
		this.dom.controlsDiv.selectAll('*').remove()
		const inputs = [
			{
				label: 'P-value filter cutoff (linear scale)',
				type: 'number',
				chartType: 'gsea',
				settingsKey: 'pvalue',
				title: 'P-value significance',
				min: 0,
				max: 1
			},
			{
				label: 'P-value filter type',
				type: 'radio',
				chartType: 'gsea',
				settingsKey: 'adjusted_original_pvalue',
				title: 'Toggle between original and adjusted pvalues for volcano plot',
				options: [
					{ label: 'adjusted', value: 'adjusted' },
					{ label: 'original', value: 'original' }
				]
			}
		]

		const geneSet = {
			label: 'Gene set group',
			type: 'dropdown',
			chartType: 'gsea',
			settingsKey: 'pathway',
			title: 'Display table showing original and adjusted pvalues corresponding to each significant pathway',
			boxLabel: '',
			options: [
				{ label: 'BP: subset of GO', value: 'BP: subset of GO' },
				{ label: 'MF: subset of GO', value: 'MF: subset of GO' },
				{ label: 'CC: subset of GO', value: 'CC: subset of GO' },
				{ label: 'WikiPathways subset of CP', value: 'WikiPathways subset of CP' },
				{ label: 'REACTOME subset of CP', value: 'REACTOME subset of CP' },
				{ label: 'H: hallmark gene sets', value: 'H: hallmark gene sets' }
			]
		}
		if (!this.settings.pathway) {
			geneSet.options.unshift({ label: '-', value: '-' })
			this.settings.pathway = '-'
		}
		inputs.push(geneSet)

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs: inputs
			})
		}
		this.components.controls.on('downloadClick.gsea', () => {
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
		this.config = structuredClone(this.state.config)
		this.settings = this.config.settings.gsea
		await this.setControls()
		this.dom.header
			.style('opacity', 0.6)
			.style('padding-left', '10px')
			.style('font-size', '0.75em')
			.text('GENE SET ENRICHMENT ANALYSIS')
		render_gsea(this)
	}
}

async function render_gsea(self) {
	/*
m {}
- gene
- logfoldchange
- averagevalue
- pvalue

add:
- vo_circle
	*/
	if (self.settings.pathway != '-') {
		self.dom.detailsDiv.selectAll('*').remove()
		self.config.gsea_params.geneSetGroup = self.settings.pathway
		const wait = self.dom.detailsDiv.append('div').text('Loading...')
		//console.log('self.config.gsea_params:', self.config.gsea_params)
		const output = await rungsea(self.config.gsea_params)
		wait.remove()
		const table_stats = table2col({ holder: self.dom.detailsDiv })
		const [t1, t2] = table_stats.addRow()
		t2.style('text-align', 'center').style('font-size', '0.8em').style('opacity', '0.8').text('COUNT')
		const addStats = [
			{
				label: 'Gene sets analyzed',
				values: Object.keys(output).length
			}
		]

		for (const dataRow of addStats) {
			const [td1, td2] = table_stats.addRow()
			td1.text(dataRow.label)
			td2.style('text-align', 'end').text(dataRow.values)
		}

		// Generating the table
		self.gsea_table_rows = []
		for (const pathway_name of Object.keys(output)) {
			const pathway = output[pathway_name]
			if (self.settings.adjusted_original_pvalue == 'adjusted' && self.settings.pvalue >= pathway.fdr) {
				let es
				if (pathway.es) {
					es = pathway.es.toPrecision(4)
				} else {
					es = pathway.es
				}
				let nes
				if (pathway.nes) {
					nes = pathway.nes.toPrecision(4)
				} else {
					nes = pathway.nes
				}
				let pval
				if (pathway.pval) {
					pval = pathway.pval.toPrecision(4)
				} else {
					pval = pathway.pval
				}
				let sidak
				if (pathway.sidak) {
					sidak = pathway.sidak.toPrecision(4)
				} else {
					sidak = pathway.sidak
				}
				let fdr
				if (pathway.fdr) {
					fdr = pathway.fdr.toPrecision(4)
				} else {
					fdr = pathway.fdr
				}
				self.gsea_table_rows.push([
					{ value: pathway_name },
					{ value: es },
					{ value: nes },
					{ value: pathway.geneset_size },
					{ value: pval },
					{ value: sidak },
					{ value: fdr },
					{ value: pathway.leading_edge }
				])
			} else if (self.settings.adjusted_original_pvalue == 'original' && self.settings.pvalue >= pathway.pval) {
				let pval
				if (pathway.pval) {
					pval = pathway.pval.toPrecision(4)
				} else {
					pval = pathway.pval
				}
				let sidak
				if (pathway.sidak) {
					sidak = pathway.sidak.toPrecision(4)
				} else {
					sidak = pathway.sidak
				}
				let fdr
				if (pathway.fdr) {
					fdr = pathway.fdr.toPrecision(4)
				} else {
					fdr = pathway.fdr
				}
				self.gsea_table_rows.push([
					{ value: pathway_name },
					{ value: pathway.es.toPrecision(4) },
					{ value: pathway.nes.toPrecision(4) },
					{ value: pathway.geneset_size },
					{ value: pval },
					{ value: sidak },
					{ value: fdr },
					{ value: pathway.leading_edge }
				])
			}
		}

		self.dom.tableDiv.selectAll('*').remove()
		const d_gsea = self.dom.tableDiv.append('div')
		renderTable({
			columns: gsea_table_cols,
			rows: self.gsea_table_rows,
			div: d_gsea,
			showLines: true,
			maxHeight: '30vh',
			singleMode: true,
			resize: true,
			noButtonCallback: async index => {
				//console.log("index:",self.gsea_table_rows[index][0].value)
				const body = {
					genome: self.config.gsea_params.genome,
					geneset_name: self.gsea_table_rows[index][0].value,
					genes: self.config.gsea_params.genes,
					fold_change: self.config.gsea_params.fold_change,
					geneSetGroup: self.config.gsea_params.geneSetGroup
				}
				const holder = self.dom.holder
				holder.selectAll('*').remove()
				const wait = holder.append('div').text('Loading...')
				const image = await rungsea(body)
				wait.remove()
				//render_gsea_plot(self, plot_data)
				if (image.error) throw image.error
				const imageUrl = URL.createObjectURL(image)
				const png_width = 600
				const png_height = 400
				const img = holder.append('img').attr('width', png_width).attr('height', png_height).attr('src', imageUrl)
			}
		})
	}
}

function render_gsea_plot(self, plot_data) {
	// This function is for client side rendering of the gsea plot. This is not currently used. May be used later if client side rendering is later desired.
	console.log('self.dom.holder:', self.dom.holder)
	const holder = self.dom.holder
	console.log('plot_data:', plot_data)
	holder.selectAll('*').remove()
	const running_sum = plot_data.running_sum.split(',').map(x => parseFloat(x))
	const es = parseFloat(plot_data.es)
	console.log('running_sum:', running_sum)
	const svg_width = 400
	const svg_height = 400
	const svg = holder.append('svg').attr('width', svg_width).attr('height', svg_height)
	const toppad = 50
	const rightpad = 50
	const yaxisw = Math.max(50, svg_width / 8)
	const xaxish = Math.max(50, svg_height / 8)
	const yaxisg = svg.append('g')
	const xaxisg = svg.append('g')
	const xpad = svg_width / 50
	const ypad = svg_height / 50
	yaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (toppad - ypad) + ')')
	xaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (svg_height - ypad) + ')')
	const xlab = xaxisg.append('text').text('Rank').attr('fill', 'black').attr('text-anchor', 'middle') //.attr('transform', 'translate(' + 200 + ',' + 200 + ')')
	const ylab = yaxisg
		.append('text')
		.text('ES')
		.attr('fill', 'black')
		.attr('text-anchor', 'middle')
		.attr('transform', 'rotate(-90)')
	const xscale = scaleLinear().domain(running_sum).range([0, svg_width])
	const yscale = scaleLinear().domain([0, 100]).range([0, svg_height])
	//const xscale = scaleLinear().domain([Math.min(running_sum), Math.max(running_sum)]).range([0, 100])
	axisstyle({
		axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
		color: 'black',
		showline: true,
		fontsize: '10'
	})
	axisstyle({
		axis: xaxisg.call(d3axis.axisBottom().scale(xscale)),
		color: 'black',
		showline: true,
		fontsize: '10'
	})
	//xscale.range([0, svg_width])
	//yscale.range([svg_height, 0])
	const lines = svg.append('g')
	//svg.selectAll(".axis text").style("font-size", "100px")
	let gene_number = 0
	let y1 = 0
	for (const rs of running_sum) {
		lines
			.append('line') // attach a line
			.style('stroke', 'green') // colour the line
			.attr('x1', xscale(gene_number)) // x position of the first end of the line
			.attr('y1', yscale(y1)) // y position of the first end of the line
			.attr('x2', xscale(gene_number)) // x position of the second end of the line
			.attr('y2', yscale(Math.abs(rs))) // y position of the second end of the line
		gene_number += 1
		y1 = Math.abs(rs)
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const config = {
			//idea for fixing nav button
			//samplelst: { groups: app.opts.state.groups}
			settings: {
				gsea: {
					pvalue: 1.0,
					adjusted_original_pvalue: 'adjusted',
					pathway: undefined
				},
				controls: { isOpen: true }
			}
		}
		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [gsea getPlotConfig()]`
	}
}

export const gseaInit = getCompInit(gsea)
// this alias will allow abstracted dynamic imports
export const componentInit = gseaInit

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
			chartType: 'gsea'
		}
	})
}

async function rungsea(body) {
	return await dofetch3('genesetEnrichment', { body })
}
