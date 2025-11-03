import { dofetch3 } from '#common/dofetch'

export class Model {
	state: any
	app: any
	constructor(state, app) {
		this.state = state
		this.app = app
	}

	async preComputeData() {
		// precompute variant data that will be displayed on track

		if (
			!this.state.config.geneSearchResult ||
			!this.state.config.snvindel?.shown ||
			!this.state.config.snvindel?.details
		)
			return

		// state.config.snvindel.details{} contains analysis details, cohorts, and compute methods
		// send to backend to compute and get results back

		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			for: 'mds3variantData',
			chr: this.state.config.geneSearchResult.chr,
			start: this.state.config.geneSearchResult.start,
			stop: this.state.config.geneSearchResult.stop,
			details: this.state.config.snvindel.details,
			filter: this.state.filter,
			variantFilter: this.state.config.variantFilter?.filter
		}

		// using dofetch prevents the app from working with custom dataset; may change to vocab method later

		const data = await dofetch3('termdb', { body })
		if (data.error) throw data.error

		return data
	}
}
