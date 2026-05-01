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
	organisms: any
	proteomeDetails!: { organism: string; assay: string; cohort: string }

	async init(opts: Opts) {
		this.opts = opts
		this.dom = {}
		opts.holder.style('padding', '5px 10px 10px 25px')

		this.organisms = this.opts.app.vocabApi.termdbConfig?.queries?.proteome?.organisms || {}
		const organismKeys = Object.keys(this.organisms)
		if (!organismKeys.length) throw 'No proteome organisms available'
		const initialProteomeDetails = opts.usecase?.proteomeDetails || {}

		const selectedOrganism =
			initialProteomeDetails.organism && this.organisms[initialProteomeDetails.organism]
				? initialProteomeDetails.organism
				: organismKeys[0]
		const selectedOrganismAssays = this.organisms[selectedOrganism]?.assays || {}
		const assayKeys = Object.keys(selectedOrganismAssays)
		if (!assayKeys.length) throw `No assays available for selected organism: ${selectedOrganism}`
		const selectedAssay =
			initialProteomeDetails.assay && selectedOrganismAssays[initialProteomeDetails.assay]
				? initialProteomeDetails.assay
				: assayKeys[0]
		const cohortKeys = Object.keys(selectedOrganismAssays[selectedAssay]?.cohorts || {})
		if (!cohortKeys.length) throw 'No cohorts available for selected assay'
		const selectedCohort =
			initialProteomeDetails.cohort && selectedOrganismAssays[selectedAssay]?.cohorts?.[initialProteomeDetails.cohort]
				? initialProteomeDetails.cohort
				: cohortKeys[0]
		this.proteomeDetails = { organism: selectedOrganism, assay: selectedAssay, cohort: selectedCohort }

		this.dom.typeSettingDiv = opts.holder.append('div')
		renderAssayAndCohortRadios({
			holder: this.dom.typeSettingDiv,
			organisms: this.organisms,
			selectedProteomeDetails: this.proteomeDetails,
			onChange: proteomeDetails => {
				const { organism, assay, cohort } = proteomeDetails
				this.proteomeDetails = { organism, assay, cohort }
				void this.updateUsecase()
			}
		})
		await this.updateUsecase()
	}

	private async updateUsecase() {
		const { organism, assay, cohort } = this.proteomeDetails
		const state = this.opts.app.getState()
		await this.opts.app.dispatch({
			type: 'app_refresh',
			state: {
				tree: {
					...state.tree,
					usecase: {
						...state.tree.usecase,
						proteomeDetails: { organism, assay, cohort }
					}
				}
			}
		})
	}
}
