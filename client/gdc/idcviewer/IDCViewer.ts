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
	viewer.main({ ...IDCViewerDefaults, filter0: filter0 }).catch(e => {
		sayerror(viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
	})
	async function update({ filter0 }) {
		await viewer.main({ ...IDCViewerDefaults, filter0: filter0 })
	}

	const publicApi = { update }
	return publicApi
}

export class IDCViewer {
	private model = new IDCModel()
	private viewModel = new IDCViewModel()
	private tableView: IDCTableView | undefined
	private loadResult: IDCParquetLoadResult | undefined
	public opts: any
	public dom: { [name: string]: any } = {}

	constructor(holder: Selection<HTMLDivElement, unknown, any, any>) {
		this.dom = {
			holder: holder,
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

	async main(args: IDCViewerOpts): Promise<void> {
		this.dom.errorDiv.selectAll('*').remove()
		if (!this.dom.searchView) {
			this.dom.searchView = new IDCSearchView(this.dom.searchDiv, this, args)
		} else {
			this.dom.searchView.setArgs(args)
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
			const caseData = await this.model.getCaseFromCurrentCohort(args)
			const tableData = this.viewModel.buildTableData(this.loadResult.idc_data, caseData.hits)
			this.tableView.render(tableData, caseData.pagination)
			console.trace('Rendering table with args:', args)
			if (!(args.action === 'search')) {
				this.dom.searchView.render(caseData.pagination)
			} else {
				args.action = undefined
				this.dom.searchView.setArgs(args)
				this.tableView.setArgs(args)
			}
		} catch (e: any) {
			if (this.dom.errorDiv) {
				sayerror(this.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
			}
		}
	}
}

// case "=":
//       return handler.handleEquals(op, hooks);
//     case "!=":
//       return handler.handleNotEquals(op, hooks);
//     case "<":
//       return handler.handleLessThan(op, hooks);
//     case "<=":
//       return handler.handleLessThanOrEquals(op, hooks);
//     case ">":
//       return handler.handleGreaterThan(op, hooks);
//     case ">=":
//       return handler.handleGreaterThanOrEquals(op, hooks);
//     case "missing":
//       return handler.handleMissing(op, hooks);
//     case "exists":
//       return handler.handleExists(op, hooks);
//     case "includes":
//       return handler.handleIncludes(op, hooks);
//     case "excludes":
//       return handler.handleExcludes(op, hooks);
//     case "excludeifany":
//       return handler.handleExcludeIfAny(op, hooks);
//     case "and":
//       return handler.handleIntersection(op, hooks);
//     case "or":
//       return handler.handleUnion(op, hooks);
//     default:
//       return assertNever(op);
//   }
