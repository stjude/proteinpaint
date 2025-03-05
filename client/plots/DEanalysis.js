import { axisstyle } from '#dom/axisstyle'
import { table2col } from '#dom/table2col'
import { Menu } from '../dom/menu'
import { renderTable } from '../dom/table'
import * as d3axis from 'd3-axis'
import { controlsInit } from './controls'
import { select as d3select } from 'd3-selection'
import { getCompInit, copyMerge } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { scaleLinear } from 'd3-scale'
import { downloadTable } from '../dom/table'
import { roundValueAuto } from '#shared/roundValue.js'

/*

opts{}
	samplelst{}
		groups[]

this{}
	app{}
		vocabApi
	config
		samplelst
			groups[] // length of 2
		settings
			DEanalysis{}
	state
		// this is the mass state
*/

const hlcolor = '#ffa200'
const tip = new Menu()
class DEanalysis {
	constructor() {
		this.type = 'DEanalysis'
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

	async setControls(output) {
		this.dom.controlsDiv.selectAll('*').remove()
		const inputs = [
			{
				label: 'Minimum Read Count',
				type: 'number',
				chartType: 'DEanalysis',
				settingsKey: 'min_count',
				title: 'The smallest number of reads required for a gene to be considered in the analysis',
				min: 0,
				max: 10000
			},
			{
				label: 'Minimum Total Read Count',
				type: 'number',
				chartType: 'DEanalysis',
				settingsKey: 'min_total_count',
				title: 'The smallest total number of reads required for a gene to be considered in the analysis',
				min: 0,
				max: 10000
			},
			{
				label: 'P-value Significance (Linear Scale)',
				type: 'number',
				chartType: 'DEanalysis',
				settingsKey: 'pvalue',
				title: 'The p-value threshold to determine statistical significance',
				min: 0,
				max: 1
			},
			{
				label: 'Fold Change (Log Scale)',
				type: 'number',
				chartType: 'DEanalysis',
				settingsKey: 'foldchange',
				title: 'The fold change threshold to determine biological significance',
				min: -10,
				max: 10
			},
			{
				label: 'P-value Table',
				type: 'checkbox',
				chartType: 'DEanalysis',
				settingsKey: 'pvaluetable',
				title: 'A table showing both original and adjusted pvalues for all significant genes',
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
			JSON.parse(sessionStorage.getItem('optionalFeatures')).run_parametricDE == true || // edgeR (and other parametric methods to be added in the future) option is always shown when serverconfig.features.run_parametricDE is set to true. This has been added so as to make this functionality available only in select few production servers for now.
			(output.mid_sample_size_cutoff >= output.sample_size1 && // Invoked only when one sample size is low than the mid_sample_size_cutoff and the other one is higher but the higher sample size is lower than the high cutoff so that the DE computation does not take a lot of time on the server
				output.mid_sample_size_cutoff < output.sample_size2 &&
				output.sample_size2 < output.high_sample_size_cutoff) ||
			(output.mid_sample_size_cutoff >= output.sample_size2 &&
				output.mid_sample_size_cutoff < output.sample_size1 &&
				output.sample_size1 < output.high_sample_size_cutoff)
		) {
			inputs.push({
				label: 'Method',
				type: 'radio',
				chartType: 'DEanalysis',
				settingsKey: 'method',
				title: 'Toggle between edgeR and Wilcoxon rank-sum test',
				options: [
					{ label: 'edgeR', value: 'edgeR' },
					{ label: 'wilcoxon', value: 'wilcoxon' }
				]
			})
			if (this.settings.method == 'edgeR') {
				inputs.push(
					{
						type: 'term',
						configKey: 'term',
						chartType: 'DEanalysis',
						usecase: { target: 'DEanalysis', detail: 'term' },
						label: 'Confounding Factor 1',
						title: 'Select confounding factors to adjust for in the analysis',
						vocabApi: this.app.vocabApi
					},
					{
						label: 'Variable Genes Cutoff',
						type: 'number',
						chartType: 'DEanalysis',
						settingsKey: 'VarGenes',
						title: 'Top number of genes with the highest variability to include in analysis',
						min: 1000,
						max: 4000
					}
				)
				if (this.config.term) {
					// Only when first confounding variable 1 has been selected, the option for a second confounding variable will be shown
					inputs.push({
						type: 'term',
						configKey: 'term2',
						chartType: 'DEanalysis',
						usecase: { target: 'DEanalysis', detail: 'term' },
						label: 'Confounding Factor 2',
						title: 'Select confounding factors to adjust for in the analysis',
						vocabApi: this.app.vocabApi
					})
				}
			}
		}

		if (this.app.opts.genome.termdbs) {
			// Check if genome build contains termdbs, only then enable gene ora
			inputs.push({
				label: 'Gene Set Overrepresentation Analysis',
				type: 'radio',
				chartType: 'DEanalysis',
				settingsKey: 'gene_ora',
				title:
					'Toggle to check if certain gene sets are overrepresented among upregulated, downregulated, or both sets of genes',
				options: [
					{ label: 'upregulated', value: 'upregulated' },
					{ label: 'downregulated', value: 'downregulated' },
					{ label: 'both', value: 'both' }
				]
			})
		}

		if (this.app.opts.genome.termdbs && !this.settings.gsea) {
			// Check if genome build contains termdbs, only then enable gene ora
			inputs.push({
				label: 'Gene Set Enrichment Analysis',
				type: 'radio',
				chartType: 'DEanalysis',
				settingsKey: 'gsea',
				title: 'Select to check if certain gene sets are enriched among the two biological conditions',
				options: [{ label: 'Submit', value: 'Submit' }]
			})
		}

		if (this.settings.pvaluetable == true) {
			// This currently does not work as hierarchial clustering code needs to be changed
			inputs.push({
				label: 'Hierarchial Clustering',
				type: 'radio',
				chartType: 'DEanalysis',
				settingsKey: 'hierCluster',
				title: 'Toggle between various methods of clustering analyses',
				options: [
					{ label: 'Top 100 genes', value: 'top100' },
					{ label: 'Top 100 upregulated', value: 'top100up' },
					{ label: 'Top 100 downregulated', value: 'top100down' }
				]
			})
			this.settings.hierCluster = 'top100'
		}

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
		if (this.dom.detailsDiv) {
			this.dom.detailsDiv.selectAll('*').remove()
		}
		if (this.dom.holder) {
			this.dom.holder.selectAll('*').remove()
		}
		const wait = this.dom.detailsDiv.append('div').text('Loading...')
		let output
		try {
			output = await runDEanalysis(this) // "this.config" was changed from "this.state.config". Hope this does not create any problems.
			wait.remove()
			if (output.error) {
				throw output.error
			}
		} catch (e) {
			alert('Error: ' + e)
			return
		}
		output.mid_sample_size_cutoff = 8 // mid sample size cutoff for method toggle to appear
		output.high_sample_size_cutoff = 30 // high sample size cutoff for method toggle to not appear, so that very high sample-size groups are not analyzed by edgeR. The exact cutoff value will need to be determined with more examples.
		await this.setControls(output)
		this.dom.header.html(
			this.config.samplelst.groups[0].name +
				' vs ' +
				this.config.samplelst.groups[1].name +
				' <span style="font-size:.8em;opacity:.7">DIFFERENTIAL GENE EXPRESSION</span>'
		)
		render_volcano(this, output)
	}
}

async function render_volcano(self, output) {
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
	const sample_size1 = output.sample_size1
	const sample_size2 = output.sample_size2
	const mavb = output.data
	const holder = self.dom.holder
	holder.selectAll('*').remove()
	self.dom.detailsDiv.selectAll('*').remove()
	self.dom.tableDiv.selectAll('*').remove()
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
	//console.log("self.settings:",self.settings)
	//self.config.settings.DEanalysis.min_count = self.settings.min_count
	//self.config.settings.DEanalysis.min_total_count = self.settings.min_total_count
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
			const value3 = roundValueAuto(d.fold_change)
			const value4 = roundValueAuto(Math.pow(10, -d.original_p_value))
			const value5 = roundValueAuto(Math.pow(10, -d.adjusted_p_value))
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
					{ value: value3 },
					{ value: value4 },
					{ value: value5 }
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
					{ value: value3 },
					{ value: value4 },
					{ value: value5 }
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
		axisstyle({
			axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
			color: 'black',
			showline: true
		})
		axisstyle({
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
		axisstyle({
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
		const table_stats = table2col({ holder: self.dom.detailsDiv })
		const addStats = [
			{
				label: 'Percentage of significant genes',
				value: roundValueAuto((num_significant_genes * 100) / (num_significant_genes + num_non_significant_genes))
			},
			{
				label: 'Number of significant genes',
				value: num_significant_genes
			},
			{
				label: 'Number of total genes',
				value: num_significant_genes + num_non_significant_genes
			},
			{
				label: self.config.samplelst.groups[0].name + ' sample size (control group)',
				value: sample_size1
			},
			{
				label: self.config.samplelst.groups[1].name + ' sample size (case group)',
				value: sample_size2
			}
		]

		if (self.settings.method == 'edgeR') {
			addStats.push({
				label: 'Number of variable genes used in parametric DE analysis',
				value: self.settings.VarGenes
			})
		}

		for (const dataRow of addStats) {
			const [td1, td2] = table_stats.addRow()
			td1.text(dataRow.label)
			td2.style('text-align', 'end').text(dataRow.value)
		}

		self.table_cols = [
			{ label: 'Gene Name' },
			{ label: 'Gene Symbol' },
			{ label: 'log2 Fold change' },
			{ label: 'Original p-value (linear scale)' },
			{ label: 'Adjusted p-value (linear scale)' }
		]
		if (self.settings.pvaluetable == true) {
			const d = self.dom.tableDiv.append('div').html(`<br>DE analysis results`)
			renderTable({
				columns: self.table_cols,
				rows: self.table_rows,
				div: d,
				showLines: true,
				maxHeight: '150vh',
				resize: true
			})
		} else {
			self.dom.tableDiv.selectAll('*').remove()
		}

		if (self.settings.gene_ora && self.app.opts.genome.termdbs) {
			// Currently backend only uses msigdb, but in future may use other databases in genome.termdbs{}. In ui will need to generate a <select> to choose one key of termdbs{}.
			//console.log('Run gene ora:', self.settings.gene_ora)
			//console.log('output.data:', output.data)
			const sample_genes = []
			const background_genes = []
			//console.log('self:', self)
			//console.log('fold_change_cutoff:', fold_change_cutoff)

			// Need to handle those genes which do not have a name
			if (self.settings.gene_ora == 'upregulated') {
				for (const gene of output.data) {
					if (gene.gene_symbol.length > 0) {
						// Do not include blank rows
						if (fold_change_cutoff < Math.abs(gene.fold_change) && gene.fold_change > 0) {
							sample_genes.push(gene.gene_symbol)
						}
						background_genes.push(gene.gene_symbol)
					}
				}
			} else if (self.settings.gene_ora == 'downregulated') {
				for (const gene of output.data) {
					if (gene.gene_symbol.length > 0) {
						// Do not include blank rows
						if (fold_change_cutoff < Math.abs(gene.fold_change) && gene.fold_change < 0) {
							sample_genes.push(gene.gene_symbol)
						}
						background_genes.push(gene.gene_symbol)
					}
				}
			} else if (self.settings.gene_ora == 'both') {
				for (const gene of output.data) {
					if (gene.gene_symbol.length > 0) {
						// Do not include blank rows
						if (fold_change_cutoff < Math.abs(gene.fold_change)) {
							sample_genes.push(gene.gene_symbol)
						}
						background_genes.push(gene.gene_symbol)
					}
				}
			} else {
				console.log('Unrecognized option')
			}

			const geneORAparams = {
				sample_genes: sample_genes.toString(),
				background_genes: background_genes.toString(),
				genome: self.app.vocabApi.opts.state.vocab.genome,
				ora_request_type: self.settings.gene_ora,
				num_samples_genes: sample_genes.length,
				num_background_genes: background_genes.length
			}

			// Check if a previous requests has already been made with the same parameters
			const previous_geneORA = self.app.getState().plots.find(x => x.chartType == 'geneORA')

			if (previous_geneORA) {
				if (
					previous_geneORA.geneORAparams.ora_request_type == self.settings.gene_ora &&
					previous_geneORA.geneORAparams.num_samples_genes == sample_genes.length &&
					previous_geneORA.geneORAparams.num_background_genes == background_genes.length
				) {
					// The check for number of background genes and sample genes have been added so that the same gene ORA request type (upregulated/downregulated/both) is not triggerred, but if any other DE parameter is changed (min_count etc.) then a new gene ORA request of the same type can be made.
					//alert(self.settings.gene_ora + "geneORA already open")
				} else {
					const config = {
						chartType: 'geneORA',
						geneORAparams: geneORAparams
					}
					self.app.dispatch({
						type: 'plot_create',
						config
					})
				}
			} else {
				const config = {
					chartType: 'geneORA',
					geneORAparams: geneORAparams
				}
				self.app.dispatch({
					type: 'plot_create',
					config
				})
			}
		}

		if (self.settings.gsea && self.app.opts.genome.termdbs) {
			// Currently backend only uses msigdb, but in future may use other databases in genome.termdbs{}. In ui will need to generate a <select> to choose one key of termdbs{}.
			//self.settings.gsea = false
			const input_genes = output.data.map(i => i.gene_symbol)
			const gsea_params = {
				genes: input_genes,
				fold_change: output.data.map(i => i.fold_change),
				genome: self.app.vocabApi.opts.state.vocab.genome,
				genes_length: input_genes.length
			}
			//console.log("gsea_params:",gsea_params)
			// Check if a previous requests has already been made with the same parameters
			const previous_gsea = self.app.getState().plots.find(x => x.chartType == 'gsea')
			if (previous_gsea) {
				if (previous_gsea.gsea_params.genes_length == input_genes.length) {
					// GSEA window already open for these parameters
				} else {
					const config = {
						chartType: 'gsea',
						gsea_params: gsea_params
					}
					self.app.dispatch({
						type: 'plot_create',
						config
					})
				}
			} else {
				const config = {
					chartType: 'gsea',
					gsea_params: gsea_params
				}
				self.app.dispatch({
					type: 'plot_create',
					config
				})
			}
		}
		//console.log('this.app.getState:', self.app.getState())
	}
	return svg
}

export async function getPlotConfig(opts, app) {
	try {
		if (opts.samplelst.groups.length != 2) throw 'opts.samplelst.groups[].length!=2'
		if (opts.samplelst.groups[0].values?.length < 1) throw 'group 1 not having >1 samples'
		if (opts.samplelst.groups[1].values?.length < 1) throw 'group 2 not having >1 samples'
		const config = {
			//idea for fixing nav button
			//samplelst: { groups: app.opts.state.groups}
			settings: {
				DEanalysis: {
					pvalue: 0.05,
					foldchange: 0,
					min_count: 10,
					min_total_count: 15,
					pvaluetable: false,
					adjusted_original_pvalue: 'adjusted',
					method: 'edgeR',
					VarGenes: 3000,
					gene_ora: undefined,
					gsea: undefined
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
		{ k: 'log fold change', v: roundValueAuto(d.fold_change) },
		{ k: 'log original p-value', v: roundValueAuto(d.original_p_value) },
		{ k: 'log adjusted p-value', v: roundValueAuto(d.adjusted_p_value) }
	]
	const table = table2col({ holder: tip.d })
	for (const item of lst) {
		const [td1, td2] = table.addRow()
		td1.text(item.k)
		td2.text(item.v)
	}

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

// This function is not currently used.
export async function openHiercluster(term, samplelstTW, app, id, newId) {
	// barchart config.term{} name is confusing, as it is actually a termsetting object, not t    erm
	// thus convert the given term into a termwrapper
	// tw.q can be missing and will be filled in with default setting
	const tw = term.term ? term : { term }

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

async function runDEanalysis(self) {
	const input = {
		genome: self.app.vocabApi.vocab.genome,
		dslabel: self.app.vocabApi.vocab.dslabel,
		samplelst: self.config.samplelst,
		min_count: self.settings.min_count,
		min_total_count: self.settings.min_total_count,
		method: self.settings.method
	}

	// retrieve the sampleId/sampleName for samples in the "others" group instead of using {in: false}
	const othersSamplesGroup = self.config.samplelst.groups.find(g => !g.in)
	if (othersSamplesGroup) {
		const samplesGroup = self.config.samplelst.groups.find(g => g.in)
		othersSamplesGroup.values = []
		// retrieve full list of samples based on current filter. put samples not in samplesGroup in "others" group
		for (const s of await self.app.vocabApi.getFilteredSampleList(self.config.state.termfilter.filter)) {
			// s={id,name}, samplelst.groups[].values[]={sampleId,sample}
			if (samplesGroup.values.indexOf(i => i.sampleId == s.id) == -1) {
				othersSamplesGroup.values.push({ sampleId: s.id, sample: s.name })
			}
		}
		othersSamplesGroup.in = true
	}

	if (self.config.term) {
		input.tw = self.config.term
		self.settings.method = 'edgeR' // When adjustment of confounding variables is selected, the method should always be a parmetric method such as edgeR
		input.method = 'edgeR'
	}

	if (self.config.term2) {
		input.tw2 = self.config.term2
	}

	if (input.method == 'edgeR') {
		input.VarGenes = self.settings.VarGenes
	}

	const output = await dofetch3('DEanalysis', {
		body: input
	})
	if (output.error) console.log('server side error:', output.error)
	return output
}
