import type { Selection } from 'd3-selection'
import { sayerror } from '#dom'
import type { IDCParquetLoadResult, IDCViewerOpts } from './IDCTypes'
import { IDCModel } from './model/IDCModel'
import { IDCViewModel } from './viewModel/IDCViewModel'
import { IDCTableView } from './view/IDCTableView'
import { IDCViewerDefaults } from './settings/defaults'
import { IDCSearchView } from './view/IDCSearchView'
import { applyStyles, idcViewerStyles } from './styling'

type IDCViewerInitArg = {
	/** GDC cohort filter */
	filter0: any
	/** a constant that's declared in portal-proto/.env.* files, with the following expected values:
	 * - "https://api.gdc.cancer.gov" in dev, works with 'http(s)://localhost' URLs, but has CORS error when used in portal.gdc.cancer.gov URLs
	 * - "https://portal.gdc.cancer.gov/auth/api/v0" or relative path "/auth/api/v0" in prod, works with with portal.gdc.cancer.gov URLs */
	GDC_API?: string
}

export async function init(
	{ filter0, GDC_API }: IDCViewerInitArg,
	holder: Selection<HTMLDivElement, unknown, any, any>
): Promise<{ update: (arg: { filter0: any }) => Promise<void> }> {
	const viewer = new IDCViewer(holder, GDC_API)
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
	private model: IDCModel
	private viewModel = new IDCViewModel()
	private tableView: IDCTableView | undefined
	private searchView: IDCSearchView | undefined
	private loadResult: IDCParquetLoadResult | undefined
	public dom: { [name: string]: any } = {}

	constructor(holder: Selection<HTMLDivElement, unknown, any, any>, GDC_API?: string) {
		this.model = new IDCModel(GDC_API)
		this.dom = {
			holder: holder,
			errorDiv: holder.append('div').attr('class', 'idcviewer-error-holder'),
			loadingDiv: applyStyles(
				holder.append('div').attr('class', 'idcviewer-loading-holder'),
				idcViewerStyles.loadingDiv
			),
			searchDiv: applyStyles(holder.append('div').attr('class', 'idcviewer-search-holder'), idcViewerStyles.searchDiv),
			tableDiv: holder.append('div').attr('class', 'idcviewer-table-holder'),
			versionDiv: holder
				.append('div')
				.attr('class', 'idcviewer-version-holder')
				.style('font-size', '12px')
				.style('display', 'flex')
				.style('padding', '2px 5px')
				.style('justify-content', 'right')
				.style('align-items', 'center')
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
			this.dom.versionDiv.text(
				`IDC URL version: ${this.loadResult.urlVersion || 'N/A'} - IDC metadata file version: ${
					this.loadResult.metadataVersion || 'N/A'
				}`
			)
		} catch (e: any) {
			if (this.dom.errorDiv) {
				sayerror(this.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
			}
		} finally {
			this.dom.loadingDiv.style('display', 'none')
		}
	}
}
