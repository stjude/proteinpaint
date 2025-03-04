import type { MassState, BasePlotConfig } from '#mass/types/mass'
import type { VolcanoSettings } from './DiffAnalysisTypes'
import { getCompInit, copyMerge } from '#rx'
import { Menu } from '#dom'
import { RxComponentInner } from '../../types/rx.d'
import { controlsInit } from '../controls'
import type { DiffAnalysisInteractions } from './interactions/DiffAnalysisInteractions'
import { VolcanoModel } from './model/VolcanoModel'
import { VolcanoViewModel } from './viewModel/VolcanoViewModel'
import { VolcanoInteractions } from './interactions/VolcanoInteractions'
import { VolcanoPlotView } from './view/VolcanoPlotView'

/** TODO:
 * - Fix all the types */
class Volcano extends RxComponentInner {
	readonly type = 'volcano'
	components: { controls: any }
	dom: { holder: any; controls: any; error: any; wait: any; tip: any }
	interactions?: VolcanoInteractions
	diffAnalysisInteractions?: DiffAnalysisInteractions

	constructor(opts: any) {
		super()
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-diff-analysis-main', true)
		const controls = opts.controls || holder.append('div')
		const error = opts.holder.append('div').attr('id', 'sjpp-diff-analysis-error').style('opacity', 0.75)
		this.dom = {
			holder,
			controls,
			error,
			wait: holder
				.append('div')
				.attr('id', 'sjpp-diff-analysis-wait')
				.style('opacity', 0.75)
				.style('padding', '20px')
				.text('Loading...'),
			tip: new Menu({ padding: '' })
		}
		if (opts.diffAnalysisInteractions) this.diffAnalysisInteractions = opts.diffAnalysisInteractions
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config: Object.assign({}, config, {
				settings: {
					volcano: config.settings.volcano
				}
			})
		}
	}

	async setControls() {
		const inputs = [
			{
				label: 'Minimum read count',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'minCount',
				title: 'The smallest number of reads required for a gene to be considered in the analysis',
				min: 0,
				max: 10000
			},
			{
				label: 'Minimum total read count',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'minTotalCount',
				title: 'The smallest total number of reads required for a gene to be considered in the analysis',
				min: 0,
				max: 10000
			},
			{
				label: 'P value significance (linear)',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'pValue',
				title: 'The p-value threshold to determine statistical significance',
				min: 0,
				max: 1
			},
			{
				label: 'Fold change (log)',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'foldChangeCutoff',
				title: 'The fold change threshold to determine biological significance',
				min: -10,
				max: 10
			},
			{
				label: 'P value',
				type: 'radio',
				chartType: 'volcano',
				settingsKey: 'pValueType',
				title: 'Toggle between original and adjusted pvalues for volcano plot',
				options: [
					{ label: 'Adjusted', value: 'adjusted' },
					{ label: 'Original', value: 'original' }
				]
			},
			{
				label: 'Variable genes cutoff',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'varGenesCutoff',
				title: 'Top number of genes with the highest variability to include in analysis',
				min: 1000,
				max: 4000
			},
			//Not enabling this feature
			//needs more discussion
			// {
			// 	label: 'Gene Set Overrepresentation Analysis',
			// 	type: 'radio',
			// 	chartType: 'volcano',
			// 	settingsKey: 'geneORA',
			//     styles: { display: 'block' },
			// 	title: 'Toggle to check if certain gene sets are overrepresented among upregulated, downregulated, or both sets of genes',
			// 	options: [
			// 		{ label: 'Upregulated', value: 'upregulated' },
			// 		{ label: 'Downregulated', value: 'downregulated' },
			// 		{ label: 'Both', value: 'both' }
			// 	],
			//     getDisplayStyle: () => (this.app.opts.genome.termdbs ? '' : 'none')
			// },
			{
				label: 'Show P value table',
				type: 'checkbox',
				chartType: 'volcano',
				settingsKey: 'showPValueTable',
				title: 'Show table with both original and adjusted p values for all significant genes',
				boxLabel: ''
			},
			{
				label: 'Plot height',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'height',
				title: 'Height of the plot in pixels',
				min: 300,
				max: 1000
			},
			{
				label: 'Plot width',
				type: 'number',
				chartType: 'volcano',
				settingsKey: 'width',
				title: 'Width of the plot in pixels',
				min: 300,
				max: 1000
			},
			{
				label: 'Significant value color',
				type: 'color',
				chartType: 'volcano',
				title: 'Default color for highlighted data points.',
				settingsKey: 'defaultSignColor'
			},
			{
				label: 'Non-significant value color',
				type: 'color',
				chartType: 'volcano',
				title: 'Default color for highlighted data points.',
				settingsKey: 'defaultNonSignColor'
			},
			{
				label: 'Highlight color',
				type: 'color',
				chartType: 'volcano',
				title: 'Default color for highlighted data points.',
				settingsKey: 'defaultHighlightColor'
			}
		]

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs
		})

		this.components.controls.on('downloadClick.differentialAnalysis', () => this.interactions!.download())
		this.components.controls.on('helpClick.differentialAnalysis', () =>
			window.open('https://github.com/stjude/proteinpaint/wiki/Differential-analysis')
		)
	}

	async init() {
		this.interactions = new VolcanoInteractions(this.app, this.id, this.dom)
		await this.setControls()
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type && config.childType != this.type) return

		try {
			if (!this.interactions) throw 'Interactions not initialized [main() Volcano.ts]'
			this.interactions.clearDom()
			this.dom.wait.style('display', 'block')
			const settings = config.settings.volcano
			/** Fetch data */
			const model = new VolcanoModel(this.app, config, settings)
			const response = await model.getData()
			if (!response || response.error) {
				this.dom.error.text(response.error || 'No data returned from server')
			}
			if (this.diffAnalysisInteractions) this.diffAnalysisInteractions.setVar(this.app, response)

			/** Format response into an object for rendering */
			const viewModel = new VolcanoViewModel(config, response, settings)
			//Pass table data for downloading
			this.interactions.pValueTableData = viewModel.viewData.pValueTableData
			this.dom.wait.style('display', 'none')
			/** Render formatted data */
			new VolcanoPlotView(this.dom, settings, viewModel.viewData, this.interactions)
		} catch (e: any) {
			if (e instanceof Error) console.error(e.message || e)
			else if (e.stack) console.log(e.stack)
			throw e
		}
	}
}

export const boxplotInit = getCompInit(Volcano)
export const componentInit = boxplotInit

export function getDefaultVolcanoSettings(overrides = {}): VolcanoSettings {
	const defaults: VolcanoSettings = {
		defaultSignColor: 'red',
		defaultNonSignColor: 'black',
		defaultHighlightColor: '#ffa200', // orange-yellow
		foldChangeCutoff: 0,
		/** Not enabling this feature for now */
		// geneORA: undefined,
		height: 400,
		minCount: 10,
		minTotalCount: 15,
		pValue: 0.05,
		pValueType: 'adjusted',
		showPValueTable: false,
		varGenesCutoff: 3000,
		width: 400
	}
	return Object.assign(defaults, overrides)
}

export function getPlotConfig(opts: any) {
	const config = {
		samplelst: opts.samplelst,
		highlightedData: opts.highlightedData,
		settings: {
			volcano: getDefaultVolcanoSettings(opts.overrides || {})
		}
	}

	return copyMerge(config, opts)
}
