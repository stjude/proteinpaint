import { renderTable } from '../dom/table'
import { table2col } from '#dom/table2col'
import { dofetch3 } from '#common/dofetch'
import { controlsInit } from './controls'
import { getCompInit, copyMerge } from '#rx'
import { Menu } from '../dom/menu'
import { newSandboxDiv } from '../dom/sandbox.ts'
import { select, pointer } from 'd3-selection'
import { roundValueAuto } from '#shared/roundValue.js'

const hlcolor = '#ffa200'
const tip = new Menu()
class geneORA {
	constructor() {
		this.type = 'geneORA'
	}
	async init(opts) {
		if (!this.opts.holder || !this.opts.header) {
			const sandBox = newSandboxDiv(select(this.opts.holder.node().parentNode))
			this.opts.header = sandBox.header
			this.opts.holder = sandBox.body
		}

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
				chartType: 'geneORA',
				settingsKey: 'pvalue',
				title: 'P-value significance',
				min: 0,
				max: 1
			},
			{
				label: 'P-value filter type',
				type: 'radio',
				chartType: 'geneORA',
				settingsKey: 'adjusted_original_pvalue',
				title: 'Toggle between original and adjusted pvalues for volcano plot',
				options: [
					{ label: 'adjusted', value: 'adjusted' },
					{ label: 'original', value: 'original' }
				]
			},
			{
				label: 'Gene set size filter cutoff',
				type: 'number',
				chartType: 'geneORA',
				settingsKey: 'gene_set_size_cutoff',
				title: 'Gene set size cutoff',
				min: 0,
				max: 20000
			}
		]

		const geneSet = {
			label: 'Gene set group',
			type: 'dropdown',
			chartType: 'geneORA',
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
		await this.setControls()
		this.dom.header
			.style('opacity', 0.6)
			.style('padding-left', '10px')
			.style('font-size', '0.75em')
			.text('GENE SET OVERREPRESENTATION ANALYSIS')
		render_geneORA(this)
	}
}

async function render_geneORA(self) {
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
		self.dom.tableDiv.selectAll('*').remove()
		self.config.geneORAparams.geneSetGroup = self.settings.pathway
		const wait = self.dom.detailsDiv.append('div').text('Loading...')
		let output
		try {
			output = await rungeneORA(self.config.geneORAparams)
			wait.remove()
			if (output.error) {
				throw output.error
			}
		} catch (e) {
			alert('Error: ' + e)
			return
		}
		const table_stats = table2col({ holder: self.dom.detailsDiv })
		const [t1, t2] = table_stats.addRow()
		t2.style('text-align', 'center').style('font-size', '0.8em').style('opacity', '0.8').text('COUNT')
		const addStats = [
			{
				label: 'Sample genes',
				values: self.config.geneORAparams.sample_genes.split(',').length
			},
			{
				label: 'Gene sets analyzed',
				values: output.num_pathways
			}
		]

		if (self.config.geneORAparams.background_genes) {
			addStats.push({
				label: 'Background genes',
				values: self.config.geneORAparams.background_genes.split(',').length
			})
		}

		for (const dataRow of addStats) {
			const [td1, td2] = table_stats.addRow()
			td1.text(dataRow.label)
			td2.style('text-align', 'end').text(dataRow.values)
		}

		// Generating the table
		self.gene_ora_table_cols = [
			{ label: 'Gene set group' },
			{ label: 'Original p-value (linear scale)' },
			{ label: 'Adjusted p-value (linear scale)' },
			{ label: 'Gene set hits' },
			{ label: 'Gene set size' }
		]
		self.gene_ora_table_rows = []
		for (const pathway of output.pathways) {
			if (
				self.settings.adjusted_original_pvalue == 'adjusted' &&
				self.settings.pvalue >= pathway.p_value_adjusted &&
				self.settings.gene_set_size_cutoff > pathway.gene_set_size
			) {
				self.gene_ora_table_rows.push([
					{ value: pathway.pathway_name },
					{ value: roundValueAuto(pathway.p_value_original) },
					{ value: roundValueAuto(pathway.p_value_adjusted) },
					{ value: pathway.gene_set_hits },
					{ value: pathway.gene_set_size }
				])
			} else if (
				self.settings.adjusted_original_pvalue == 'original' &&
				self.settings.pvalue >= pathway.p_value_original &&
				self.settings.gene_set_size_cutoff > pathway.gene_set_size
			) {
				self.gene_ora_table_rows.push([
					{ value: pathway.pathway_name },
					{ value: roundValueAuto(pathway.p_value_original) },
					{ value: roundValueAuto(pathway.p_value_adjusted) },
					{ value: pathway.gene_set_hits },
					{ value: pathway.gene_set_size }
				])
			}
		}

		const d_ora = self.dom.tableDiv.append('div')
		renderTable({
			columns: self.gene_ora_table_cols,
			rows: self.gene_ora_table_rows,
			div: d_ora,
			showLines: true,
			maxHeight: '30vh',
			resize: true
		})
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const config = {
			//idea for fixing nav button
			//samplelst: { groups: app.opts.state.groups}
			settings: {
				geneORA: {
					pvalue: 1.0,
					adjusted_original_pvalue: 'adjusted',
					pathway: undefined,
					gene_set_size_cutoff: 2000
				},
				controls: { isOpen: true }
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

async function rungeneORA(body) {
	return await dofetch3('genesetOverrepresentation', { body })
}
