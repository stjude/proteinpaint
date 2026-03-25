import { renderAssayAndCohortRadios } from '../../plots/wholeProteomeAbundance.js'

type Opts = {
	holder: any
	app: any
	callback: (tw: any) => Promise<void>
	usecase: { target: string; detail: string; [index: string]: any }
}

export class SearchHandler {
	opts: any
	dom: any
	assays: any
	selectedAssayKey!: string
	selectedCohortKey!: string

	async init(opts: Opts) {
		this.opts = opts
		this.dom = {}
		opts.holder.style('padding', '5px 10px 10px 25px')

		// Get available assays from termdbConfig
		this.assays = this.opts.app.vocabApi.termdbConfig?.queries?.proteome?.assays || {}
		const assayKeys = Object.keys(this.assays)
		if (!assayKeys.length) throw 'No proteome assays available'

		this.selectedAssayKey =
			opts.usecase?.assayKey && this.assays[opts.usecase.assayKey] ? opts.usecase.assayKey : assayKeys[0]
		const cohortKeys = Object.keys(this.assays[this.selectedAssayKey]?.cohorts || {})
		if (!cohortKeys.length) throw 'No cohorts available for selected assay'
		this.selectedCohortKey =
			opts.usecase?.cohortKey && this.assays[this.selectedAssayKey]?.cohorts?.[opts.usecase.cohortKey]
				? opts.usecase.cohortKey
				: cohortKeys[0]

		this.dom.typeSettingDiv = opts.holder.append('div')
		renderAssayAndCohortRadios({
			holder: this.dom.typeSettingDiv,
			assays: this.assays,
			selectedAssayKey: this.selectedAssayKey,
			selectedCohortKey: this.selectedCohortKey,
			onChange: ({ assayKey, cohortKey }) => {
				this.selectedAssayKey = assayKey
				this.selectedCohortKey = cohortKey
				void this.updateUsecase()
			}
		})
		await this.updateUsecase()
	}

	private async updateUsecase() {
		const state = this.opts.app.getState()
		await this.opts.app.dispatch({
			type: 'app_refresh',
			state: {
				tree: {
					...state.tree,
					usecase: {
						...state.tree.usecase,
						assayKey: this.selectedAssayKey,
						cohortKey: this.selectedCohortKey
					}
				}
			}
		})
	}
}
