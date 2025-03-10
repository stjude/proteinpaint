export class DiffAnalysisInteractions {
	app: any
	volcanoResponse: any
	constructor(app) {
		this.app = app
		this.volcanoResponse = []
	}

	setVar(key, value) {
		this[key] = value
	}

	getGseaParameters() {
		const inputGenes = this.volcanoResponse.data.map(i => i.gene_symbol)
		const gsea_params = {
			genes: inputGenes,
			fold_change: this.volcanoResponse.data.map(i => i.fold_change),
			genome: this.app.vocabApi.opts.state.vocab.genome,
			genes_length: inputGenes.length
		}
		return gsea_params
	}
}
