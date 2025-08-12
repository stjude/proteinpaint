import { getCompInit, copyMerge } from '#rx'
import { RxComponentInner } from '../../types/rx.d'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import { controlsInit } from '../controls'
import type { GRIN2Dom, GRIN2Opts, GRIN2Settings } from './GRIN2Types'
import { Menu } from '#dom'
import { dofetch3 } from '#common/dofetch'

class GRIN2 extends RxComponentInner {
	readonly type = 'grin2'
	private components: { controls: any }
	dom: GRIN2Dom

	constructor(opts: any) {
		super()
		this.opts = opts
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-grin2-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px').style('display', 'inline-block')
		const errorDiv = div.append('div').attr('id', 'sjpp-grin2-error').style('opacity', 0.75)
		const plotDiv = div.append('div').attr('id', 'sjpp-grin2-plot')

		this.dom = {
			controls: controls.style('display', 'block'),
			div,
			error: errorDiv,
			plot: plotDiv,
			tip: new Menu({ padding: '' })
		}

		if (opts.header)
			this.dom.header = opts.header.text('GRIN2 Analysis').style('font-size', '0.7em').style('opacity', 0.6)
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termdbConfig: appState.termdbConfig,
			termfilter: appState.termfilter,
			config: Object.assign({}, config, {
				settings: {
					grin2: config.settings.grin2
				}
			})
		}
	}

	async setControls() {
		const inputs = [
			// SNV/Indel controls
			{
				label: 'SNV/Indel Min Total Depth',
				title: 'Minimum total depth for SNV/indel variants',
				type: 'number',
				chartType: 'grin2',
				settingsKey: 'snvindelOptions.minTotalDepth',
				min: 1,
				debounceInterval: 500
			},
			{
				label: 'SNV/Indel Min Alt Allele Count',
				title: 'Minimum alternate allele count for SNV/indel variants',
				type: 'number',
				chartType: 'grin2',
				settingsKey: 'snvindelOptions.minAltAlleleCount',
				min: 1,
				debounceInterval: 500
			},
			{
				label: 'SNV/Indel Hypermutator Threshold',
				title: 'Maximum mutation count cutoff for hypermutated samples',
				type: 'number',
				chartType: 'grin2',
				settingsKey: 'snvindelOptions.hyperMutator',
				min: 1,
				debounceInterval: 500
			},
			// CNV controls
			{
				label: 'CNV Loss Threshold',
				title: 'Log2 ratio threshold for CNV losses',
				type: 'number',
				chartType: 'grin2',
				settingsKey: 'cnvOptions.lossThreshold',
				max: 0,
				step: 0.1,
				debounceInterval: 500
			},
			{
				label: 'CNV Gain Threshold',
				title: 'Log2 ratio threshold for CNV gains',
				type: 'number',
				chartType: 'grin2',
				settingsKey: 'cnvOptions.gainThreshold',
				min: 0,
				step: 0.1,
				debounceInterval: 500
			},
			{
				label: 'CNV Max Segment Length',
				title: 'Maximum segment length for CNV filtering (0 = no limit)',
				type: 'number',
				chartType: 'grin2',
				settingsKey: 'cnvOptions.maxSegLength',
				min: 0,
				debounceInterval: 500
			},
			{
				label: 'CNV Min Segment Length',
				title: 'Minimum segment length for CNV filtering',
				type: 'number',
				chartType: 'grin2',
				settingsKey: 'cnvOptions.minSegLength',
				min: 0,
				debounceInterval: 500
			},
			{
				label: 'CNV Hypermutator Threshold',
				title: 'Maximum CNV count cutoff for hypermutated samples',
				type: 'number',
				chartType: 'grin2',
				settingsKey: 'cnvOptions.hyperMutator',
				min: 1,
				debounceInterval: 500
			}
		]

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs
		})
	}

	async init(appState: MassState) {
		const state = this.getState(appState)
		console.log(state)
		await this.setControls()
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return

		try {
			// Clear any previous errors
			this.dom.error.style('padding', '0').text('')
			this.dom.plot.selectAll('*').remove()

			// Show loading message
			this.dom.plot
				.append('div')
				.style('padding', '20px')
				.style('text-align', 'center')
				.text('Running GRIN2 analysis...')

			// Make request to GRIN2 endpoint - now matches curl command structure
			const settings = config.settings.grin2
			const requestData = {
				genome: 'hg38',
				dslabel:
					this.state.termdbConfig.dslabel || this.state.termdbConfig.title?.text || this.state.termdbConfig.title,
				filter: this.state.termfilter.filter || this.state.termfilter,
				snvindelOptions: settings.snvindelOptions,
				cnvOptions: settings.cnvOptions
			}

			const response = await dofetch3('/grin2', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestData)
			})

			const result = await response

			// Clear loading message
			this.dom.plot.selectAll('*').remove()

			if (result.status === 'error') {
				this.dom.error.style('padding', '20px').text(`GRIN2 analysis failed: ${result.error}`)
				return
			}

			// Display results
			this.renderResults(result)
		} catch (error) {
			this.dom.plot.selectAll('*').remove()
			this.dom.error
				.style('padding', '20px')
				.text(
					`Error running GRIN2 analysis: ${
						typeof error === 'object' && error !== null && 'message' in error
							? (error as { message: string }).message
							: String(error)
					}`
				)
		}
	}

	private renderResults(result: any) {
		// Display Manhattan plot
		if (result.pngImg) {
			const plotContainer = this.dom.plot.append('div').style('text-align', 'center').style('margin', '20px 0')

			plotContainer.append('h3').style('margin', '10px 0').text('GRIN2 Manhattan Plot')

			plotContainer
				.append('img')
				.attr('src', `data:image/png;base64,${result.pngImg}`)
				.style('max-width', '100%')
				.style('height', 'auto')
				.style('border', '1px solid #ccc')
		}

		// Display top genes table
		if (result.topGeneTable) {
			const tableContainer = this.dom.plot.append('div').style('margin', '20px 0')

			tableContainer
				.append('h3')
				.style('margin', '10px 0')
				.text(`Top Genes (showing ${result.showingTop} of ${result.totalGenes})`)

			const table = tableContainer
				.append('table')
				.style('border-collapse', 'collapse')
				.style('width', '100%')
				.style('font-size', '12px')

			// Create header
			const headerRow = table.append('thead').append('tr')
			result.topGeneTable.columns.forEach(col => {
				headerRow
					.append('th')
					.style('border', '1px solid #ccc')
					.style('padding', '8px')
					.style('background-color', '#f5f5f5')
					.style('text-align', 'left')
					.text(col.label)
			})

			// Create rows
			const tbody = table.append('tbody')
			result.topGeneTable.rows.forEach(row => {
				const tr = tbody.append('tr')
				row.forEach(cell => {
					tr.append('td').style('border', '1px solid #ccc').style('padding', '8px').text(cell.value)
				})
			})
		}

		// Display timing information
		if (result.timing) {
			this.dom.plot
				.append('div')
				.style('margin', '20px 0')
				.style('font-size', '12px')
				.style('color', '#666')
				.text(
					`Analysis completed in ${result.timing.totalTime}s (Processing: ${result.timing.processingTime}s, GRIN2: ${result.timing.grin2Time}s)`
				)
		}
	}
}

export const grin2Init = getCompInit(GRIN2)
export const componentInit = grin2Init

export function getDefaultGRIN2Settings(overrides = {}) {
	// Updated to match curl command structure exactly
	const defaults: GRIN2Settings = {
		snvindelOptions: {
			minTotalDepth: 10,
			minAltAlleleCount: 2,
			consequences: [],
			hyperMutator: 1000
		},
		cnvOptions: {
			lossThreshold: -0.4,
			gainThreshold: 0.3,
			maxSegLength: 0,
			minSegLength: 0,
			hyperMutator: 500
		}
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts: GRIN2Opts, _app: MassAppApi) {
	const config = {
		chartType: 'grin2',
		settings: {
			controls: {},
			grin2: getDefaultGRIN2Settings(opts.overrides || {})
		}
	}
	return copyMerge(config, opts)
}

export function makeChartBtnMenu(holder, chartsInstance) {
	const genomeObj = chartsInstance.app.opts.genome
	if (typeof genomeObj != 'object') throw 'chartsInstance.app.opts.genome not an object and needed for GRIN2'

	// Create a simple button for GRIN2 analysis
	const row = holder.append('div').style('margin', '10px')

	row
		.append('button')
		.style('padding', '8px 16px')
		.style('background', '#4CAF50')
		.style('color', 'white')
		.style('border', 'none')
		.style('border-radius', '4px')
		.style('cursor', 'pointer')
		.text('Run GRIN2 Analysis')
		.on('click', async () => {
			try {
				// GRIN2 doesn't need feature selection, just run with current filter
				const config = await getPlotConfig({}, chartsInstance.app)
				chartsInstance.prepPlot({ config })
			} catch (e: any) {
				// upon err, create div in chart button menu to display err
				holder
					.append('div')
					.style('color', 'red')
					.style('margin-top', '10px')
					.text(`Error: ${e.message || e}`)
				console.log(e)
			}
		})
}
