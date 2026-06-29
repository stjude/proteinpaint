import type { Selection } from 'd3-selection'
import { sayerror } from '#dom'
import type { IDCParquetLoadResult, IDCViewerOpts } from './IDCTypes'
import { IDCModel } from './model/IDCModel'
import { IDCViewModel } from './viewModel/IDCViewModel'
import { IDCTableView } from './view/IDCTableView'
import { IDCViewerDefaults } from './settings/defaults'
import { IDCSearchView } from './view/IDCSearchView'

export async function init(
	{ filter0 },
	holder: Selection<HTMLDivElement, unknown, any, any>
): Promise<{ update: (arg: { filter0: any }) => Promise<void> }> {
	const viewer = new IDCViewer(holder)
	viewer.main({ ...IDCViewerDefaults, filter0: filter0 }, true).catch(e => {
		sayerror(viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
	})
	async function update({ filter0 }) {
		await viewer.main({ ...IDCViewerDefaults, filter0: filter0 }, true)
	}

	const publicApi = { update }
	return publicApi
}

export class IDCViewer {
	private model = new IDCModel()
	private viewModel = new IDCViewModel()
	private tableView: IDCTableView | undefined
	private searchView: IDCSearchView | undefined
	private loadResult: IDCParquetLoadResult | undefined
	public dom: { [name: string]: any } = {}

	constructor(holder: Selection<HTMLDivElement, unknown, any, any>) {
		this.dom = {
			holder: holder,
			loadingDiv: holder
				.append('div')
				.attr('class', 'idcviewer-loading-holder')
				.style('display', 'none')
				.style('background-color', 'rgba(255, 255, 255, 0.8)')
				.style('position', 'absolute')
				.style('top', '0')
				.style('left', '0')
				.style('width', '100%')
				.style('height', '100%'),
			searchDiv: holder
				.append('div')
				.attr('class', 'idcviewer-search-holder')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('justify-content', 'space-between')
				.style('flex-wrap', 'wrap')
				.style('flex-direction', 'row'),
			tableDiv: holder.append('div').attr('class', 'idcviewer-table-holder'),
			errorDiv: holder.append('div').attr('class', 'idcviewer-error-holder')
		}
	}

	async main(args: IDCViewerOpts, newCohort: boolean = false): Promise<void> {
		this.dom.errorDiv.selectAll('*').remove()
		if (!this.searchView) {
			this.searchView = new IDCSearchView(this.dom.searchDiv, this, args)
		} else {
			this.searchView.setArgs(args)
		}

		if (!this.tableView) {
			this.tableView = new IDCTableView(this.dom.tableDiv, this, args)
		} else {
			this.tableView.setArgs(args)
		}

		if (!this.loadResult) {
			try {
				this.loadResult = await this.model.loadParquetWithFallback(args.retries)
				if (!this.loadResult) {
					throw new Error(
						'Failed to load IDC mapping data from all available sources. Please check your network connection and try refreshing the page.'
					)
				}
			} catch (e: any) {
				if (this.dom.errorDiv) {
					sayerror(this.dom.errorDiv, `Error loading IDCViewer: ${e.message || e}`)
				}
				return
			}
		}

		try {
			this.dom.loadingDiv.style('display', 'flex')
			const caseData = await this.model.getCaseFromCurrentCohort(args, this.loadResult.case_ids as string[])
			const tableData = this.viewModel.buildTableData(this.loadResult.idc_data, caseData.hits)
			this.tableView.render(tableData, caseData.pagination)
			if (newCohort) {
				const cohortCaseTotal = (await this.model.getCaseFromCurrentCohort(args)).pagination.total
				this.searchView.render(caseData.pagination, cohortCaseTotal)
			}
		} catch (e: any) {
			if (this.dom.errorDiv) {
				sayerror(this.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
			}
		} finally {
			this.dom.loadingDiv.style('display', 'none')
		}
	}
}
