import type { AppApi } from '#rx'
import type { SCModel } from '../model/SCModel.ts'
import type { SCViewer } from '../SC.ts'
import type { SCDom } from '../SCTypes'
import type { SCViewModel } from '../viewModel/SCViewModel.ts'

/** Handles the interactivity from the view */
export class SCInteractions {
	app: AppApi
	dom: SCDom
	id: string
	model: SCModel
	viewModel: SCViewModel

	constructor(sc: SCViewer) {
		this.app = sc.app
		this.dom = sc.dom
		this.id = sc.id
		this.model = sc.model
		this.viewModel = sc.viewModel
	}

	/** Add the plot to the state.plots array with .parentId. Adding
	 * .parentId prevents the plot from launching in a new sandbox outside SC.
	 * Pass the .parentId to both the plotConfig and the action.
	 * this.getState() in SC.ts will find all the subplots with the parentId==this.id
	 * SC.main() initializes the subplots as components in chartsDiv */
	async createSubplot(config) {
		const c = Object.assign({}, config, { parentId: this.id })
		await this.app.dispatch({
			type: 'plot_create',
			parentId: this.id,
			config: c
		})
	}

	/** Updates the item in the plot settings */
	async updateItem(item) {
		item.isMetaResult = this.viewModel.metaResultIds.has(item.sID)
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { settings: { sc: { item } } }
		})
	}

	async getDropDownOptions(plot): Promise<string[] | undefined> {
		return this.model.getCategories(plot)
	}

	toggleLoading(on: boolean) {
		if (on) {
			this.dom.loading.selectAll('*').remove()
			this.dom.loading
				.style('display', 'block')
				.append('div')
				.style('position', 'relative')
				.style('top', '50%')
				.append('span')
				.attr('class', 'sjpp-spinner')
			this.dom.loading.style('display', '')
		} else {
			this.dom.loading.selectAll('.sjpp-spinner').remove()
			this.dom.loading.style('display', 'none')
		}
	}
}
