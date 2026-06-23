import { getCompInit, type RxComponent } from '#rx'
import { PlotBase } from '../PlotBase'
import { sayerror } from '#dom'
import type { IDCParquetLoadResult } from './IDCTypes'
import { IDCModel } from './model/IDCModel'
import { IDCViewModel } from './viewModel/IDCViewModel'
import { IDCTableView } from './view/IDCTableView'

class IDCViewer extends PlotBase implements RxComponent {
	static type = 'IDCViewer'
	type: string

	private model = new IDCModel()
	private viewModel = new IDCViewModel()
	private tableView: IDCTableView | undefined
	private loadResult: IDCParquetLoadResult | undefined

	constructor(opts: any, api: any) {
		super(opts, api)
		this.type = IDCViewer.type
		this.opts = opts
		this.dom = {
			holder: opts.holder,
			div: opts.holder.append('div').attr('class', 'idcviewer-holder')
		}
		if (opts.header) this.dom.header = opts.header.text('IDCViewer')
	}

	async init(): Promise<void> {
		this.tableView = new IDCTableView(this.dom.div)
	}

	async main(): Promise<void> {
		const state = structuredClone(this.state)
		const filter0 = state.termfilter?.filter0

		if (!this.tableView) {
			this.tableView = new IDCTableView(this.dom.div)
		}

		if (!this.loadResult) {
			try {
				this.loadResult = await this.model.loadParquetWithFallback()
				if (!this.loadResult) {
					throw new Error(
						'Failed to load IDC mapping data from all available sources. Please check your network connection and try refreshing the page.'
					)
				}
			} catch (e: any) {
				if (this.dom.div) {
					sayerror(this.dom.div, `Error loading IDCViewer: ${e.message || e}`)
				}
				return
			}
		}

		try {
			const caseData = await this.model.getCaseFromCurrentCohort(filter0)
			const tableData = this.viewModel.buildTableData(this.loadResult.idc_data, caseData.hits)
			this.tableView.render(tableData, caseData.pagination)
		} catch (e: any) {
			if (this.dom.div) {
				sayerror(this.dom.div, `Error running IDCViewer: ${e.message || e}`)
			}
		}
	}
}

export default IDCViewer
export const idcViewer = getCompInit(IDCViewer)
export const componentInit = idcViewer

export async function getPlotConfig(opts: any) {
	return {
		chartType: 'IDCViewer',
		subfolder: 'idcviewer',
		extension: 'ts',
		hidePlotFilter: true,
		settings: opts.overrides || {}
	}
}
