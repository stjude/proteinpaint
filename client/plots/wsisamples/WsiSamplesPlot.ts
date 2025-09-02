import { getCompInit } from '#rx'
import wsiSamplesDefaults from '#plots/wsisamples/defaults.ts'
import { dofetch3 } from '#src/client'
import type { WSISamplesResponse, WSISample } from '@sjcrh/proteinpaint-types/routes/wsisamples.ts'
import type Settings from '#plots/wsisamples/Settings.ts'
import type { TableCell, TableColumn, TableRow } from '#dom'
import { renderTable } from '#dom'

export default class WSISamplesPlot {
	// following attributes are required by rx
	private type: string
	private id: any
	private opts: any
	private app: any

	constructor(opts: any) {
		this.type = 'WSISamplesPlot'
		this.opts = opts
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}

		return {
			config,
			dslabel: appState.vocab.dslabel,
			genome: appState.vocab.genome
		}
	}

	async init() {
		const state = this.app.getState()
		const plotConfig = state.plots.find(p => p.id === this.id)
		const settings = plotConfig.settings as Settings

		const selectedRows: Array<number> = []
		const selectedSampleIndex = settings.selectedSampleIndex
		if (selectedSampleIndex != -1) selectedRows.push(selectedSampleIndex)

		const holder = this.opts.holder

		const contentDiv = holder.append('div').attr('class', 'wsi-samples-content')

		const columns: TableColumn[] = [
			{
				label: 'Sample'
			}
		]

		const rows: TableRow[] = []

		const wsiImages: WSISample[] = plotConfig.wsimages

		if (!wsiImages) return

		wsiImages.forEach((wsiImage: WSISample) => {
			const row: TableRow = []
			const tableCell: TableCell = {
				value: wsiImage.sampleId
			}
			row.push(tableCell)
			rows.push(row)
		})

		renderTable({
			rows: rows,
			columns: columns,
			resize: true,
			singleMode: true,
			div: contentDiv,
			maxHeight: '50vh',
			selectedRows: selectedRows,
			noButtonCallback: index => {
				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: {
						settings: {
							selectedSampleIndex: index
						}
					}
				})
			},
			striped: true,
			header: { style: { 'text-transform': 'capitalize' } }
		})
	}

	async main(): Promise<void> {
		const state = this.app.getState()

		const plotConfig = state.plots.find(p => p.id === this.id)
		const settings = plotConfig.settings as Settings

		const selectedSampleIndex = settings.selectedSampleIndex

		const contentDiv = this.opts.holder.select('.wsi-samples-content')

		if (selectedSampleIndex != -1) {
			// Check if viewer with class wsi-viewer already exists and remove it
			const existingViewer = contentDiv.select('.wsi-viewer')
			if (!existingViewer.empty()) {
				existingViewer.remove()
			}

			const viewerDiv = contentDiv.append('div').attr('class', 'wsi-viewer').style('width', '100%')

			const wsiViewer = await import('#plots/wsiviewer/plot.wsi.js')
			wsiViewer.default(this.app.opts.state.vocab.dslabel, viewerDiv, this.app.opts.genome, selectedSampleIndex)
		}
	}
}

export const wsiSamplesPlot = getCompInit(WSISamplesPlot)

export const componentInit = wsiSamplesPlot

export async function getPlotConfig(opts: any, app: any): Promise<any> {
	return {
		chartType: 'WSISamplesPlot',
		subfolder: 'wsisamples',
		extension: 'ts',
		wsimages: await getWSISamples(app),
		settings: wsiSamplesDefaults(opts.overrides)
	}
}

async function getWSISamples(app: any): Promise<WSISample[]> {
	const data: WSISamplesResponse = await dofetch3('wsisamples', {
		body: {
			genome: app.opts.state.vocab.genome,
			dslabel: app.opts.state.vocab.dslabel
		}
	})
	return data.samples
}
