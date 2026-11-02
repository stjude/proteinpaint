import { Menu, addGeneSearchbox, mayRenderSampleTypeRow, getTermSampleTypes } from '#dom'
import { TermTypes } from '#types'
import { getGEunit } from '#tw/geneExpression'

export class SearchHandler {
	callback: any
	app: any
	dom: any
	sampleTypeSelect?: any
	init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		this.dom = {}
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		this.sampleTypeSelect = mayRenderSampleTypeRow(holder.append('div'), this.query, this.app.vocabApi.termdbConfig)
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: holder,
			searchOnly: 'gene',
			callback: () => this.selectGene(geneSearch)
		})
		holder.select('.sja_genesearchinput').style('margin', '0px')
	}

	get query() {
		return this.app.vocabApi.termdbConfig?.queries.geneExpression
	}

	async selectGene(geneSearch) {
		const gene = geneSearch?.geneSymbol
		if (!gene) throw new Error('No gene selected')
		const termSampleTypes = getTermSampleTypes(this.sampleTypeSelect, this.query, this.app.vocabApi.termdbConfig)
		if (!termSampleTypes) return
		const unit = getGEunit(this.app.vocabApi)
		const name = `${gene} ${unit}`
		this.callback({ gene, name, type: TermTypes.GENE_EXPRESSION, ...termSampleTypes })
	}
}
