import {
	Menu,
	addGeneSearchbox,
	renderSampleTypeSelect,
	renderSampleTypesByTermsSelect,
	getSelectedSampleTypes,
	getSelectedSampleTypesByTerms,
	table2col
} from '#dom'
import { TermTypes } from '#types'
import { getGEunit } from '#tw/geneExpression'

export class SearchHandler {
	callback: any
	app: any
	querySampleTypes?: any[]
	querySampleTypesByTerms?: any
	sampleTypeSelect?: any
	init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		this.querySampleTypes = this.app.vocabApi.termdbConfig?.queries.geneExpression.sampleTypes
		this.querySampleTypesByTerms = this.app.vocabApi.termdbConfig?.queries.geneExpression.sampleTypesByTerms
		if (this.querySampleTypesByTerms) {
			// query sample types by terms defined
			const sampleTypeDiv = holder.append('div')
			this.sampleTypeSelect = renderSampleTypesByTermsSelect(sampleTypeDiv, this.querySampleTypesByTerms)
		} else if (Array.isArray(this.querySampleTypes) && this.querySampleTypes.length >= 2) {
			// multiple query sample types, render sample type select
			const sampleTypeDiv = holder.append('div')
			const table = table2col({ holder: sampleTypeDiv, margin: '0px 0px 15px 0px' })
			const [td1, td2] = table.addRow()
			td1.text('Sample Type')
			this.sampleTypeSelect = renderSampleTypeSelect(td2, this.querySampleTypes, this.app.vocabApi.termdbConfig)
		}
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: holder,
			searchOnly: 'gene',
			callback: () => this.selectGene(geneSearch)
		})
	}

	async selectGene(geneSearch) {
		const gene = geneSearch?.geneSymbol
		if (!gene) throw new Error('No gene selected')
		const sampleTypes = this.querySampleTypesByTerms
			? getSelectedSampleTypesByTerms(this.sampleTypeSelect, this.querySampleTypesByTerms)
			: getSelectedSampleTypes(this.sampleTypeSelect) || this.querySampleTypes
		if (this.sampleTypeSelect && !sampleTypes?.length) {
			window.alert('Must select at least one sample type')
			return
		}
		const unit = getGEunit(this.app.vocabApi)
		const name = `${gene} ${unit}`
		const term = { gene, name, type: TermTypes.GENE_EXPRESSION, sampleTypes }
		this.callback(term)
	}
}
