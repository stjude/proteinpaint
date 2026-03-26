import { renderAssayAndCohortRadios } from '../../plots/proteomeAbundance.js'

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
	proteomeDetails!: { assay: string; cohort: string }

	async init(opts: Opts) {
		this.opts = opts
		this.dom = {}
		opts.holder.style('padding', '5px 10px 10px 25px')

		// Get available assays from termdbConfig
		this.assays = this.opts.app.vocabApi.termdbConfig?.queries?.proteome?.assays || {}
		const assayKeys = Object.keys(this.assays)
		if (!assayKeys.length) throw 'No proteome assays available'
		const initialProteomeDetails = opts.usecase?.proteomeDetails || {}

		const selectedAssay =
			initialProteomeDetails.assay && this.assays[initialProteomeDetails.assay]
				? initialProteomeDetails.assay
				: assayKeys[0]
		const cohortKeys = Object.keys(this.assays[selectedAssay]?.cohorts || {})
		if (!cohortKeys.length) throw 'No cohorts available for selected assay'
		const selectedCohort =
			initialProteomeDetails.cohort && this.assays[selectedAssay]?.cohorts?.[initialProteomeDetails.cohort]
				? initialProteomeDetails.cohort
				: cohortKeys[0]
		this.proteomeDetails = { assay: selectedAssay, cohort: selectedCohort }

		this.dom.typeSettingDiv = opts.holder.append('div')
		renderAssayAndCohortRadios({
			holder: this.dom.typeSettingDiv,
			assays: this.assays,
			selectedProteomeDetails: this.proteomeDetails,
			onChange: proteomeDetails => {
				const { assay, cohort } = proteomeDetails
				this.proteomeDetails = { assay, cohort }
				void this.updateUsecase()
			}
		})
		await this.updateUsecase()
	}

	private async updateUsecase() {
		const { assay, cohort } = this.proteomeDetails
		const state = this.opts.app.getState()
		await this.opts.app.dispatch({
			type: 'app_refresh',
			state: {
				tree: {
					...state.tree,
					usecase: {
						...state.tree.usecase,
						proteomeDetails: { assay, cohort }
					}
				}
			}
		})
	}
}
