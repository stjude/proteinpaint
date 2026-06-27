import type { Selection } from 'd3-selection'
import { sayerror } from '#dom'
import type { IDCParquetLoadResult, IDCViewerOpts, Pagination, ResponseHit } from './IDCTypes'
import { IDCModel } from './model/IDCModel'
import { IDCViewModel } from './viewModel/IDCViewModel'
import { IDCTableView } from './view/IDCTableView'
import { IDCViewerDefaults, MAX_CASES_LIMIT } from './settings/defaults'
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
	private cachedCohortHits: ResponseHit[] | undefined
	private cachedCohortTotal: number | undefined
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
			cohortWarningDiv: holder
				.append('div')
				.attr('class', 'idcviewer-cohort-warning')
				.style('display', 'none')
				.style('padding', '8px 12px')
				.style('margin-bottom', '8px')
				.style('background-color', '#fff8e1')
				.style('border', '1px solid #ffe082')
				.style('border-radius', '4px')
				.style('font-size', '14px')
				.style('color', '#6d4c00'),
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

			if (newCohort) {
				// Reset to page 1 and fetch all cohort cases upfront
				args.currentPage = 1
				const result = await this.model.fetchAllCasesForCohort(args.filter0)
				this.cachedCohortHits = result.hits
				this.cachedCohortTotal = result.total

				if (this.cachedCohortTotal > MAX_CASES_LIMIT) {
					this.dom.cohortWarningDiv
						.style('display', 'block')
						.text(
							`Note: Only the first ${MAX_CASES_LIMIT.toLocaleString()} cases from this cohort were processed. Results may be incomplete.`
						)
				} else {
					this.dom.cohortWarningDiv.style('display', 'none')
				}
			}

			const cachedHits = this.cachedCohortHits || []
			const isSearch = args.action === 'search'
			const searchQuery = args.searchFilter?.trim() || ''

			let hitsToProcess: ResponseHit[]
			if (isSearch && searchQuery) {
				// Client-side search: filter cached hits by case_id or submitter_id
				const lq = searchQuery.toLowerCase()
				hitsToProcess = cachedHits.filter(
					h => h.case_id.toLowerCase().includes(lq) || h.submitter_id.toLowerCase().includes(lq)
				)
				if (hitsToProcess.length === 0) {
					this.tableView.clear()
					sayerror(this.dom.errorDiv, 'The case you searched does not exist in current cohort')
					return
				}
			} else {
				hitsToProcess = cachedHits
			}

			const allRows = this.viewModel.buildTableData(this.loadResult.idc_data, hitsToProcess, {
				idcMatchedOnly: !(isSearch && searchQuery),
				sortBy: args.sortBy,
				sortDirection: args.sortDirection
			})

			const total = allRows.length
			const pages = Math.ceil(total / args.pageSize) || 1
			args.currentPage = Math.min(Math.max(args.currentPage, 1), pages)
			const from = (args.currentPage - 1) * args.pageSize
			const pagedRows = allRows.slice(from, from + args.pageSize)

			const pagination: Pagination = {
				count: pagedRows.length,
				from,
				page: args.currentPage,
				pages,
				size: args.pageSize,
				sort: `${args.sortBy}:${args.sortDirection}`,
				total
			}

			this.tableView.render(pagedRows, pagination)
			if (newCohort) {
				this.searchView.render(pagination, this.cachedCohortTotal)
			}
		} catch (e: any) {
			if (this.dom.errorDiv) {
				sayerror(this.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
			}
			console.error(e)
		} finally {
			this.dom.loadingDiv.style('display', 'none')
		}
	}
}
