import * as d3axis from 'd3-axis'
import { axisstyle } from '#dom'
import { Menu, renderTable, table2col } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { controlsInit } from './controls'
import { getCompInit, copyMerge } from '#rx'
import { scaleLinear } from 'd3-scale'
import { roundValueAuto } from '#shared/roundValue.js'
import { VolcanoModel } from '#plots/volcano/model/VolcanoModel.ts'
import { getDefaultVolcanoSettings } from '#plots/volcano/Volcano.ts'

const tip = new Menu()

class gsea {
	constructor(opts) {
		this.type = 'gsea'
		this.opts = opts
		this.components = {
			controls: {}
		}
		//Either allow a node to be passed or create a new div
		const controlsDiv =
			typeof opts.controls == 'object' ? opts.controls : opts.holder.append('div').style('display', 'inline-block')
		const main = opts.holder.append('div').style('display', 'inline-block')
		const actionsDiv = main
			.append('div')
			.attr('data-testid', 'sjpp-gsea-actions')
			.style('margin', '10px')
			.style('text-align', 'left')
		const loadingDiv = main
			.append('div')
			.attr('data-testid', 'sjpp-gsea-loading')
			.style('text-align', 'center')
			.style('display', 'none')
			.style('margin', '10px')
			.style('text-align', 'left')
			.text('Loading...')
		const holder = main
			.append('div')
			.style('margin-left', '50px')
			.style('display', 'inline-block')
			.attr('data-testid', 'sjpp-gsea-holder')
		const detailsDiv = main
			.append('div')
			.attr('data-testid', 'sjpp-gsea-details')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '50px')

		const tableDiv = main.append('div').style('margin', '10px').attr('data-testid', 'sjpp-gsea-results-table')

		this.dom = {
			holder,
			header: opts.header,
			actionsDiv,
			loadingDiv,
			controlsDiv,
			detailsDiv,
			tableDiv
		}
	}

	async setControls() {
		this.dom.controlsDiv.selectAll('*').remove()
		const inputs = [
			{
				label: 'Minimum Gene Set Size Filter Cutoff',
				type: 'number',
				chartType: 'gsea',
				settingsKey: 'min_gene_set_size_cutoff',
				title: 'Minimum Gene set size cutoff. Helps in filtering out small gene sets',
				min: 0
			},
			{
				label: 'Maximum Gene Set Size Filter Cutoff',
				type: 'number',
				chartType: 'gsea',
				settingsKey: 'max_gene_set_size_cutoff',
				title: 'Maximum Gene set size cutoff. Helps in filtering out large gene sets',
				max: 25000
			},
			{
				label: 'Filter Non-coding Genes',
				type: 'checkbox',
				chartType: 'gsea',
				settingsKey: 'filter_non_coding_genes',
				title: 'Filter non-coding genes',
				boxLabel: ''
			},
			{
				label: 'FDR or Top Gene Sets',
				type: 'radio',
				chartType: 'gsea',
				settingsKey: 'fdr_or_top',
				title: 'Toggle between FDR cutoff and top gene sets in ascending order of FDR',
				options: [
					{ label: 'FDR', value: 'fdr' },
					{ label: 'Top Gene Sets', value: 'top' }
				]
			}
		]

		if (JSON.parse(sessionStorage.getItem('optionalFeatures')).gsea_test) {
			inputs.push({
				label: 'GSEA method',
				type: 'radio',
				chartType: 'gsea',
				settingsKey: 'gsea_method',
				title: 'Toggle between blitzgsea and CERNO method',
				options: [
					{ label: 'blitzgsea', value: 'blitzgsea' },
					{ label: 'CERNO', value: 'cerno' }
				]
			})
		}
		if (this.settings.gsea_method == 'blitzgsea') {
			inputs.push({
				label: 'Number of Permutations',
				type: 'number',
				chartType: 'gsea',
				settingsKey: 'num_permutations',
				title: 'Number of permutations to be used for GSEA. Higher number increases accuracy but also compute time.',
				min: 0,
				max: 40000 // Setting it to pretty lenient limit for testing
			})
		}
		if (this.settings.fdr_or_top == 'fdr') {
			inputs.push({
				label: 'FDR Filter Cutoff (Linear Scale)',
				type: 'number',
				chartType: 'gsea',
				settingsKey: 'fdr_cutoff',
				title: 'P-value significance',
				min: 0,
				max: 1
			})
		} else if (this.settings.fdr_or_top == 'top') {
			inputs.push({
				label: 'Number of top Gene Sets by FDR',
				type: 'number',
				chartType: 'gsea',
				settingsKey: 'top_genesets',
				title: 'Number of top gene sets to be displayed in ascending order of FDR',
				min: 0,
				max: 5000
			})
		} else {
			throw 'unknown FDR/top option'
		}

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controlsDiv,
			inputs: inputs
		})

		this.components.controls.on('downloadClick.gsea', () => {
			if (!this.imageUrl) return alert('No image to download')
			const dataUrl = this.imageUrl
			const downloadImgName = `${this.state.config.gsea_params.geneset_name || ''}_GSEA_IMG`
			const a = document.createElement('a')
			document.body.appendChild(a)

			a.addEventListener(
				'click',
				() => {
					// Download the image
					a.download = downloadImgName + '.png'
					a.href = dataUrl
					document.body.removeChild(a)
				},
				false
			)
			a.click()
		})
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config
		}
	}

	/** This allows the gsea to run independently. If the DE data
	 * was already requested (e.g. in the DA from the volcano plot),
	 * the cached response returns rather than running the DE
	 * route again.
	 *
	 * Also allows loading the gsea from a mass session file without
	 * error. */
	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config.gsea_params) {
			try {
				const volcanoSettings =
					config.settings?.volcano || getDefaultVolcanoSettings({}, { termType: 'geneExpression' })
				const model = new VolcanoModel(this.app, config, volcanoSettings)
				const response = await model.getData()
				if (!response || !response.data || response.error) {
					throw response.error || 'No data returned from volcano model'
				}
				const inputGenes = response.data.map(g => g.gene_name)
				await this.app.save({
					type: 'plot_edit',
					id: this.id,
					config: {
						gsea_params: {
							genes: inputGenes,
							fold_change: response.data.map(g => g.fold_change),
							genome: this.app.vocabApi.opts.state.vocab.genome,
							genes_length: inputGenes.length
						}
					}
				})
			} catch (e) {
				if (e instanceof Error) console.error(e.message || e)
				else if (e.stack) console.log(e.stack)
				throw e
			}
		}
	}

	async main() {
		//Not not use structuredClone(this.state.config)
		//Does not include the plot config changes in init()
		const config = this.app.getState().plots.find(p => p.id === this.id)
		this.config = structuredClone(config)
		if (this.config.chartType != this.type && this.config.childType != this.type) return
		this.settings = this.config.settings.gsea

		this.imageUrl = null // Reset the image URL
		await this.setControls()
		if (this.dom.header)
			this.dom.header.html(
				this.config.gsea_params.genes.length +
					' genes <span style="font-size:.8em;opacity:.7">GENE SET ENRICHMENT ANALYSIS</span>'
			)
		render_gsea(this)
	}
}

async function renderPathwayDropdown(self) {
	const settings = structuredClone(self.settings)
	const pathwayOpts = structuredClone(self.app.opts.genome.termdbs.msigdb.analysisGenesetGroups) // duplicate to avoid repeated insertion on each app launch

	if (JSON.parse(sessionStorage.getItem('optionalFeatures')).gsea_test && self.settings.gsea_method == 'blitzgsea') {
		// This contains geneset groups that are specific to blitzgsea itself
		// TEMPORARY FIX to test this library that will trigger auto download support files in python
		// NEVER ENABLE ON PROD especially gdc prod, where container has firewall and it crashes..
		// delete this if library is replaced
		pathwayOpts.push(
			{ label: 'REACTOME (blitzgsea)', value: 'REACTOME--blitzgsea' },
			{ label: 'KEGG (blitzgsea)', value: 'KEGG--blitzgsea' },
			{ label: 'WikiPathways (blitzgsea)', value: 'WikiPathways--blitzgsea' }
		)
	}

	if (settings.pathway) {
		pathwayOpts.shift()
		pathwayOpts.find(opt => opt.value == settings.pathway).selected = true
	}

	self.dom.actionsDiv
		.append('span')
		.attr('data-testid', 'sjpp-gsea-pathway')
		.style('margin-right', '10px')
		.text('Select a gene set group:')

	const dropdown = self.dom.actionsDiv.append('select').on('change', event => {
		if (!settings.pathway) {
			//Remove placeholder from dropdown on first change
			const placeholder = dropdown.select('option[value="-"]')
			placeholder.remove()
			pathwayOpts.shift()
		}

		const idx = event.target.selectedIndex
		settings.pathway = pathwayOpts[idx].value
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				//Need to clear the gsea_params completely
				gsea_params: {
					geneset_name: null,
					pickle_file: null,
					pathway: pathwayOpts[idx].value
				},
				highlightGenes: [],
				settings: {
					gsea: settings
				}
			}
		})
	})
	for (const opt of pathwayOpts) {
		dropdown
			.append('option')
			.text(opt.label)
			.attr('value', opt.value)
			.attr('selected', opt.selected ? true : null)
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

	//Render the dropdown if launched from state
	//Otherwise will persist on load
	self.dom.actionsDiv.selectAll('*').remove()
	renderPathwayDropdown(self)
	if (self.settings.pathway == '-' || self.settings.pathway == undefined) return
	self.dom.detailsDiv.selectAll('*').remove()
	self.dom.holder.selectAll('*').remove()
	self.dom.tableDiv.selectAll('*').remove()
	self.config.gsea_params.geneSetGroup = self.settings.pathway
	self.config.gsea_params.filter_non_coding_genes = self.settings.filter_non_coding_genes
	self.config.gsea_params.num_permutations = self.settings.num_permutations

	let output
	try {
		const body = {
			genome: self.config.gsea_params.genome,
			genes: self.config.gsea_params.genes,
			fold_change: self.config.gsea_params.fold_change,
			geneSetGroup: self.settings.pathway,
			filter_non_coding_genes: self.settings.filter_non_coding_genes,
			method: self.settings.gsea_method
		}

		if (self.settings.gsea_method == 'blitzgsea') {
			body.num_permutations = self.settings.num_permutations
		}
		output = await rungsea(body, self.dom)
		if (output.error) {
			throw output.error
		}
	} catch (e) {
		alert('Error: ' + e)
		return
	}

	//Ensure the image renders when toggling between tabs
	if (self.config.gsea_params.geneset_name != null) {
		if (self.settings.gsea_method == 'blitzgsea') {
			self.config.gsea_params.method = self.settings.gsea_method
			const image = await rungsea(self.config.gsea_params, self.dom)
			// //render_gsea_plot(self, plot_data)
			if (image.error) throw image.error
			self.imageUrl = URL.createObjectURL(image)
			const png_width = 600
			const png_height = 400
			self.dom.holder.append('img').attr('width', png_width).attr('height', png_height).attr('src', self.imageUrl)
		} else if (self.settings.gsea_method == 'cerno') {
			render_cerno_plot(self, output)
		} else {
			throw 'Unknown method:' + self.settings.gsea_method
		}
	}

	const table_stats = table2col({ holder: self.dom.detailsDiv.attr('data-testid', 'sjpp-gsea-stats') })
	const [t1, t2] = table_stats.addRow()
	t2.style('text-align', 'center').style('font-size', '0.8em').style('opacity', '0.8').text('COUNT')
	let addStats
	if (self.settings.gsea_method == 'blitzgsea') {
		addStats = [
			{
				label: 'Gene sets analyzed',
				values: Object.keys(output.data).length
			}
		]
	} else if (self.settings.gsea_method == 'cerno') {
		addStats = [
			{
				label: 'Gene sets analyzed',
				values: Object.keys(output).length
			}
		]
	} else {
		throw 'Unknown method:' + self.settings.gsea_method
	}

	for (const dataRow of addStats) {
		const [td1, td2] = table_stats.addRow()
		td1.text(dataRow.label)
		td2.style('text-align', 'end').text(dataRow.values)
	}

	// Generating the table
	self.gsea_table_rows = []
	let output_keys
	if (self.settings.gsea_method == 'blitzgsea') {
		output_keys = Object.entries(output.data).map(([key, value]) => {
			return { key, value } // Convert to an array of objects
		})
	} else if (self.settings.gsea_method == 'cerno') {
		output_keys = Object.entries(output).map(([key, value]) => {
			return { key, value } // Convert to an array of objects
		})
	} else {
		throw 'Unknown method:' + self.settings.gsea_method
	}

	if (self.settings.fdr_or_top == 'top') {
		// Sorting the top (top_genesets) genesets in decreasing order
		output_keys.sort((i, j) => Number(i.value.fdr) - Number(j.value.fdr))
		const top_genesets = Math.min(self.settings.top_genesets, output_keys.length) // If the length of the table is less than the top cutoff, only iterate till the end of the table
		for (let iter = 0; iter < top_genesets; iter++) {
			if (
				self.settings.max_gene_set_size_cutoff >= output_keys[iter].value.geneset_size &&
				self.settings.min_gene_set_size_cutoff <= output_keys[iter].value.geneset_size
			) {
				setResultsRows(output_keys, iter, self)
			}
		}
	} else if (self.settings.fdr_or_top == 'fdr') {
		for (let iter = 0; iter < output_keys.length; iter++) {
			if (
				self.settings.fdr_cutoff >= output_keys[iter].value.fdr &&
				self.settings.max_gene_set_size_cutoff >= output_keys[iter].value.geneset_size &&
				self.settings.min_gene_set_size_cutoff <= output_keys[iter].value.geneset_size
			) {
				setResultsRows(output_keys, iter, self)
			}
		}
	}

	self.dom.tableDiv.selectAll('*').remove()
	const d_gsea = self.dom.tableDiv.append('div')
	// table columns showing analysis results for each gene set
	self.gsea_table_cols = []
	if (self.settings.gsea_method == 'blitzgsea') {
		self.gsea_table_cols = [
			{ label: 'Gene Set', sortable: true },
			//{ label: 'Enrichment Score' },
			{ label: 'Normalized Enrichment Score', barplot: { axisWidth: 200 }, sortable: true },
			{ label: 'Gene Set Size', sortable: true },
			{ label: 'P value', sortable: true },
			//{ label: 'Sidak' },
			{ label: 'FDR', sortable: true },
			{ label: 'Leading Edge' }
		]
	} else if (self.settings.gsea_method == 'cerno') {
		self.gsea_table_cols = [
			{ label: 'Gene Set', sortable: true },
			{ label: 'Area Under Curve', barplot: { axisWidth: 200 }, sortable: true },
			{ label: 'Enrichment Score', barplot: { axisWidth: 200 }, sortable: true },
			{ label: 'Gene Set Size', sortable: true },
			{ label: 'P value', sortable: true },
			{ label: 'FDR', sortable: true },
			{ label: 'Leading Edge' }
		]
	} else {
		throw 'Unknown method:' + self.settings.gsea_method
	}
	let download = {}

	if (self.config.chartType == 'differentialAnalysis') {
		//Highlight genes button
		self.dom.detailsDiv
			.append('button')
			.style('margin-left', '10px')
			.style(
				'display',
				self.config.chartType == 'differentialAnalysis' && self.config.gsea_params.geneset_name == null
					? 'none'
					: 'block'
			)
			.attr('aria-label', 'Highlight genes in the volcano plot')
			.text('Highlight genes')
			.on('click', () => {
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						childType: 'volcano',
						highlightedData: self.config.highlightGenes
					}
				})
			})
	}

	if (self.state.config.downloadFilename) download.fileName = self.state.config.downloadFilename

	//Table rerenders when main is called
	//Fix to show which gene set is selected after rerender
	const geneSetIdx = self.gsea_table_rows.findIndex(row => row[0].value == self.config.gsea_params.geneset_name)
	const selectedRows = geneSetIdx > -1 ? [geneSetIdx] : []

	renderTable({
		download,
		columns: self.gsea_table_cols,
		rows: self.gsea_table_rows,
		div: d_gsea,
		showLines: true,
		maxHeight: '30vh',
		singleMode: true,
		resize: true,
		header: { allowSort: true },
		selectedRows: selectedRows,
		noButtonCallback: async index => {
			const config = {
				gsea_params: {
					pickle_file: output.pickle_file,
					geneset_name: self.gsea_table_rows[index][0].value
				}
			}
			if (self.config.chartType == 'differentialAnalysis') {
				//Saves the data to highlight in the volcano plot
				let genes
				if (self.settings.gsea_method == 'blitzgsea') {
					genes = [...self.gsea_table_rows[index][5].value.split(',')]
				} else if (self.settings.gsea_method == 'cerno') {
					genes = [...self.gsea_table_rows[index][6].value.split(',')]
				} else {
					throw 'Unknown method:' + self.settings.gsea_method
				}
				if (genes) config.highlightGenes = genes
			}
			await self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config
			})
		}
	})
}

function setResultsRows(output_keys, iter, self) {
	const pathway_name = output_keys[iter].key
	const pval = output_keys[iter].value.pval
		? roundValueAuto(output_keys[iter].value.pval)
		: output_keys[iter].value.pval
	const fdr = output_keys[iter].value.fdr ? roundValueAuto(output_keys[iter].value.fdr) : output_keys[iter].value.fdr
	if (self.settings.gsea_method == 'blitzgsea') {
		const nes = output_keys[iter].value.nes ? roundValueAuto(output_keys[iter].value.nes) : output_keys[iter].value.nes
		// const sidak = output_keys[iter].value.sidak
		// 	? roundValueAuto(output_keys[iter].value.sidak)
		// 	: output_keys[iter].value.sidak
		self.gsea_table_rows.push([
			{ value: pathway_name },
			{ value: nes },
			{ value: output_keys[iter].value.geneset_size },
			{ value: pval },
			//{ value: sidak },
			{ value: fdr },
			{ value: output_keys[iter].value.leading_edge }
		])
	} else if (self.settings.gsea_method == 'cerno') {
		const auc = output_keys[iter].value.auc ? roundValueAuto(output_keys[iter].value.auc) : output_keys[iter].value.auc
		const es = output_keys[iter].value.es ? roundValueAuto(output_keys[iter].value.es) : output_keys[iter].value.es
		self.gsea_table_rows.push([
			{ value: pathway_name },
			{ value: auc },
			{ value: es },
			{ value: output_keys[iter].value.geneset_size },
			{ value: pval },
			{ value: fdr },
			{ value: output_keys[iter].value.leading_edge }
		])
	} else {
		throw 'Unknown method:' + self.settings.gsea_method
	}
}

function render_cerno_plot(self, cerno_output) {
	const holder = self.dom.holder
	holder.selectAll('*').remove()
	const svg_width = 400
	const svg_height = 400
	const svg = holder.append('svg').attr('width', svg_width).attr('height', svg_height)
	const toppad = 20
	const rightpad = 5
	const yaxisw = 50 //Math.max(50, svg_width / 8)
	const xaxish = 50 //Math.max(50, svg_height / 8)
	const yaxisg = svg.append('g')
	const xaxisg = svg.append('g')
	const xpad = 50
	const ypad = 100

	const DE_output = []
	for (let i = 0; i < self.config.gsea_params.genes.length; i++) {
		const item = { gene: self.config.gsea_params.genes[i], fold_change: self.config.gsea_params.fold_change[i] }
		DE_output.push(item)
	}
	DE_output.sort((i, j) => j.fold_change - i.fold_change) // Sorting genes in descending order of fold change

	const xscale = scaleLinear()
		.domain([0, DE_output.length])
		.range([xpad, svg_width - rightpad])
	const yscale = scaleLinear()
		.domain([100, 0])
		.range([toppad, svg_height - ypad])

	yaxisg.attr('transform', 'translate(' + xpad + ',' + 0 + ')')
	xaxisg.attr('transform', 'translate(' + 0 + ',' + (svg_height - ypad) + ')')
	const xlab = svg
		.append('text')
		.text('Gene list')
		.attr('fill', 'black')
		.attr('text-anchor', 'start')
		.attr('transform', 'translate(' + xscale(DE_output.length / 3) + ',' + (svg_height - ypad + 2 * toppad) + ')')
	const ylab = svg
		.append('text')
		.text('Fraction of gene set')
		.attr('fill', 'black')
		.attr('text-anchor', 'middle')
		.attr('y', xpad / 2)
		.attr('x', -svg_width / 2.5)
		.attr('transform', 'rotate(-90)')
	const title = svg
		.append('text')
		.text(self.config.gsea_params.geneset_name)
		.attr('fill', 'black')
		.attr('text-anchor', 'start')
		.attr('font-size', '12px')
		.attr('transform', 'translate(' + xpad + ',' + toppad / 2 + ')')

	const auc = cerno_output[self.config.gsea_params.geneset_name].auc
	if (typeof auc === 'number') {
		let auc_pos
		if (auc >= 0.5) {
			// The position of the text changes depending upon the value of auc so as to avoid the auc curve overlapping with the text
			auc_pos = xscale((DE_output.length * 3) / 3.5) + ',' + (svg_height - ypad * 1.5)
		} else {
			auc_pos = xscale((DE_output.length * 0.8) / 4.5) + ',' + (svg_height - ypad * 3)
		}
		const auc_text = svg
			.append('text')
			.text('AUC=' + roundValueAuto(auc))
			.attr('fill', 'black')
			.attr('text-anchor', 'middle')
			.attr('transform', 'translate(' + auc_pos + ')')
	} else {
		// Should not happen
		throw 'AUC not a number:' + auc
	}

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

	// Find genes that were found from cerno output
	if (Object.keys(cerno_output).includes(self.config.gsea_params.geneset_name)) {
		const hit_genes = cerno_output[self.config.gsea_params.geneset_name].leading_edge.split(',')
		const y_increment = 100 / hit_genes.length
		const lines = svg.append('g')

		//let x_iter = 0
		let y_iter = 100
		for (let i = 0; i < DE_output.length; i++) {
			const y_old = y_iter
			// Increment y only when gene is found in geneset
			if (hit_genes.includes(DE_output[i].gene)) {
				y_iter = y_iter - y_increment
				lines
					.append('line') // attach a line
					.style('stroke', 'red') // colour the line
					.attr('x1', xscale(i)) // x position of the first end of the line
					.attr('y1', svg_height) // y position of the first end of the line
					.attr('x2', xscale(i)) // x position of the second end of the line
					.attr('y2', svg_height - ypad + 2.5 * toppad) // y position of the second end of the line
			}
			lines
				.append('line') // attach a line
				.style('stroke', 'red') // colour the line
				.attr('x1', xscale(i)) // x position of the first end of the line
				.attr('y1', yscale(100 - y_old)) // y position of the first end of the line
				.attr('x2', xscale(i + 1)) // x position of the second end of the line
				.attr('y2', yscale(100 - y_iter)) // y position of the second end of the line
		}
	} else {
		// Should not happen
		throw '${self.config.gsea_params.geneset_name} not found'
	}

	//console.log('cerno_output:', cerno_output)

	// Find the genes that were found in the clicked geneset
	//const genes_found
}

// function render_gsea_plot(self, plot_data) {
// 	// This function is for client side rendering of the gsea plot. This is not currently used. May be used later if client side rendering is later desired.
// 	console.log('self.dom.holder:', self.dom.holder)
// 	const holder = self.dom.holder
// 	console.log('plot_data:', plot_data)
// 	holder.selectAll('*').remove()
// 	const running_sum = plot_data.running_sum.split(',').map(x => parseFloat(x))
// 	const es = parseFloat(plot_data.es)
// 	console.log('running_sum:', running_sum)
// 	const svg_width = 400
// 	const svg_height = 400
// 	const svg = holder.append('svg').attr('width', svg_width).attr('height', svg_height)
// 	const toppad = 50
// 	const rightpad = 50
// 	const yaxisw = Math.max(50, svg_width / 8)
// 	const xaxish = Math.max(50, svg_height / 8)
// 	const yaxisg = svg.append('g')
// 	const xaxisg = svg.append('g')
// 	const xpad = svg_width / 50
// 	const ypad = svg_height / 50
// 	yaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (toppad - ypad) + ')')
// 	xaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (svg_height - ypad) + ')')
// 	const xlab = xaxisg.append('text').text('Rank').attr('fill', 'black').attr('text-anchor', 'middle') //.attr('transform', 'translate(' + 200 + ',' + 200 + ')')
// 	const ylab = yaxisg
// 		.append('text')
// 		.text('ES')
// 		.attr('fill', 'black')
// 		.attr('text-anchor', 'middle')
// 		.attr('transform', 'rotate(-90)')
// 	const xscale = scaleLinear().domain(running_sum).range([0, svg_width])
// 	const yscale = scaleLinear().domain([0, 100]).range([0, svg_height])
// 	//const xscale = scaleLinear().domain([Math.min(running_sum), Math.max(running_sum)]).range([0, 100])
// 	axisstyle({
// 		axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
// 		color: 'black',
// 		showline: true,
// 		fontsize: '10'
// 	})
// 	axisstyle({
// 		axis: xaxisg.call(d3axis.axisBottom().scale(xscale)),
// 		color: 'black',
// 		showline: true,
// 		fontsize: '10'
// 	})
// 	//xscale.range([0, svg_width])
// 	//yscale.range([svg_height, 0])
// 	const lines = svg.append('g')
// 	//svg.selectAll(".axis text").style("font-size", "100px")
// 	let gene_number = 0
// 	let y1 = 0
// 	for (const rs of running_sum) {
// 		lines
// 			.append('line') // attach a line
// 			.style('stroke', 'green') // colour the line
// 			.attr('x1', xscale(gene_number)) // x position of the first end of the line
// 			.attr('y1', yscale(y1)) // y position of the first end of the line
// 			.attr('x2', xscale(gene_number)) // x position of the second end of the line
// 			.attr('y2', yscale(Math.abs(rs))) // y position of the second end of the line
// 		gene_number += 1
// 		y1 = Math.abs(rs)
// 	}
// }

export function getDefaultGseaSettings(overrides = {}) {
	const defaults = {
		fdr_cutoff: 0.05,
		num_permutations: 1000,
		top_genesets: 40,
		pathway: undefined,
		geneset_name: null,
		min_gene_set_size_cutoff: 0,
		max_gene_set_size_cutoff: 20000,
		filter_non_coding_genes: true,
		fdr_or_top: 'top',
		gsea_method: 'blitzgsea'
	}
	if (JSON.parse(sessionStorage.getItem('optionalFeatures')).gsea_test) {
		// set default method to CERNO when serverconfig flag gsea_test is defined
		defaults.gsea_method = 'cerno'
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts, app) {
	// if (!opts.gsea_params) throw 'No gsea_params provided [gsea getPlotConfig()]'
	try {
		const config = {
			//idea for fixing nav button
			//samplelst: { groups: app.opts.state.groups}
			settings: {
				gsea: getDefaultGseaSettings(opts.overrides)
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

async function rungsea(body, dom) {
	//Only show the loading div as the gsea is running
	dom.actionsDiv.style('display', 'none')
	dom.loadingDiv.style('display', 'block')
	const data = await dofetch3('genesetEnrichment', { body })
	dom.loadingDiv.style('display', 'none')
	dom.actionsDiv.style('display', 'block')
	return data
}
