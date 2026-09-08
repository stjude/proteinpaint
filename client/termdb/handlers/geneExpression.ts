import {
	Menu,
	addGeneSearchbox,
	renderSampleTypeSelect,
	renderSampleTypesByTermsSelect,
	getSelectedSampleTypes,
	getSelectedSampleTypesByTerms,
	getSampleTypeLabelByTerms,
	table2col
} from '#dom'
import { TermTypes } from '#types'
import { getGEunit } from '#tw/geneExpression'

export class SearchHandler {
	callback: any
	app: any
	dom: any
	querySampleTypes?: any[]
	querySampleTypesByTerms?: any
	sampleTypeSelect?: any
	init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		this.dom = {}
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		this.dom.sampleTypeDiv = holder.append('div')
		this.mayRenderSampleTypeSelect()
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: holder,
			searchOnly: 'gene',
			callback: () => this.selectGene(geneSearch)
		})
		holder.select('.sja_genesearchinput').style('margin', '0px')
	}

	mayRenderSampleTypeSelect() {
		this.dom.sampleTypeDiv.selectAll('*').remove()
		this.querySampleTypes = this.app.vocabApi.termdbConfig?.queries.geneExpression.sampleTypes
		this.querySampleTypesByTerms = this.app.vocabApi.termdbConfig?.queries.geneExpression.sampleTypesByTerms
		if ((Array.isArray(this.querySampleTypes) && this.querySampleTypes.length >= 2) || this.querySampleTypesByTerms) {
			// render sample type select
			const table = table2col({ holder: this.dom.sampleTypeDiv, margin: '0px 0px 15px 0px' })
			const [td1, td2] = table.addRow()
			td1.text('Sample Type')
			td2.style('padding-left', '10px')
			if (this.querySampleTypesByTerms) {
				this.sampleTypeSelect = renderSampleTypesByTermsSelect(
					td2,
					this.querySampleTypesByTerms,
					this.app.vocabApi.termdbConfig
				)
			} else {
				this.sampleTypeSelect = renderSampleTypeSelect(td2, this.querySampleTypes, this.app.vocabApi.termdbConfig)
			}
		}
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
		if (this.querySampleTypesByTerms) {
			const sampleTypeLabel = getSampleTypeLabelByTerms(this.sampleTypeSelect)
			if (sampleTypeLabel) {
				term.sampleTypeLabel = sampleTypeLabel
				term.name += ` (${sampleTypeLabel})`
			}
		}
		this.callback(term)
	}
}
