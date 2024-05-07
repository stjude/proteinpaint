import * as client from '../src/client'
import { renderTable } from '../dom/table'
import * as d3axis from 'd3-axis'
import { controlsInit } from './controls'
import { select as d3select } from 'd3-selection'
import { getCompInit, copyMerge } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { scaleLog, scaleLinear } from 'd3-scale'
import { d3lasso } from '../common/lasso'
import { downloadTable } from '../dom/table'
import { Genome } from '#shared/types/genome.ts'

const hlcolor = '#ffa200'
const tip = new client.Menu()
class geneORA {
	constructor() {
		this.type = 'geneORA'
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
				label: 'P-value significance (linear scale)',
				type: 'number',
				chartType: 'geneORA',
				settingsKey: 'pvalue',
				title: 'P-value significance',
				min: 0,
				max: 1
			},
			{
				label: 'Fold change (log scale)',
				type: 'number',
				chartType: 'geneORA',
				settingsKey: 'foldchange',
				title: 'Fold change',
				min: -10,
				max: 10
			},
			{
				label: 'P-value table',
				type: 'checkbox',
				chartType: 'geneORA',
				settingsKey: 'pvaluetable',
				title: 'Display table showing original and adjusted pvalues for all significant genes',
				boxLabel: ''
			}
		]

		if (this.app.opts.genome.termdbs) {
			// Check if genome build contains termdbs, only then enable gene ora
			inputs.push({
				label: 'Gene overrepresentation analysis',
				type: 'radio',
				chartType: 'geneORA',
				settingsKey: 'gene_ora',
				title: 'Toggle between analyzing upregulated, downregulated or both genes',
				options: [
					{ label: 'upregulated', value: 'upregulated' },
					{ label: 'downregulated', value: 'downregulated' },
					{ label: 'both', value: 'both' }
				]
			})
		}

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs: inputs
			})
		}
		this.components.controls.on('downloadClick.geneORA', () => {
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
		this.settings = this.config.settings.geneORA
		//console.log("this.config:",this.config)
		//console.log("this.settings:",this.settings)
		const output = await this.app.vocabApi.rungeneORA(this.config.geneORAparams)
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
			.text('GENE OVERREPRESENTATION ANALYSIS')
		render_geneORA(this, output, this.config.geneORAparams)
	}
}

async function render_geneORA(self, output, input) {
	/*
m {}
- gene
- logfoldchange
- averagevalue
- pvalue

add:
- vo_circle
	*/

	console.log('input:', input)
	self.dom.detailsDiv
		.append('div')
		.html(
			'Number of sample genes used for gene over representation analysis:' +
				input.sample_genes.split(',').length +
				'<br>Number of background genes used for gene over representation analysis:' +
				input.background_genes.split(',').length
		)

	// Generating the table
	self.gene_ora_table_cols = [
		{ label: 'Pathway name' },
		{ label: 'Original p-value (linear scale)' },
		{ label: 'Adjusted p-value (linear scale)' }
	]
	self.gene_ora_table_rows = []
	for (const pathway of output) {
		self.gene_ora_table_rows.push([
			{ value: pathway.pathway_name },
			{ value: pathway.p_value_original },
			{ value: pathway.p_value_adjusted }
		])
	}

	self.dom.tableDiv.selectAll('*').remove()
	const d_ora = self.dom.tableDiv.append('div').html(`<br>Gene over-representation results`)
	renderTable({
		columns: self.gene_ora_table_cols,
		rows: self.gene_ora_table_rows,
		div: d_ora,
		showLines: true,
		maxHeight: '30vh',
		resize: true
	})
}

export async function getPlotConfig(opts, app) {
	try {
		const config = {
			//idea for fixing nav button
			//samplelst: { groups: app.opts.state.groups}
			settings: {
				geneORA: {
					pvalue: 0.05,
					foldchange: 2,
					pvaluetable: false,
					adjusted_original_pvalue: 'adjusted',
					method: undefined,
					gene_ora: undefined
				}
			}
		}
		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [geneORA getPlotConfig()]`
	}
}

export const geneORAInit = getCompInit(geneORA)
// this alias will allow abstracted dynamic imports
export const componentInit = geneORAInit

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
			chartType: 'geneORA'
		}
	})
}
