import {
	Menu,
	addGeneSearchbox,
	renderSampleTypeSelect,
	mayRenderSampleTypeSelect,
	getSelectedSampleTypes,
	table2col
} from '#dom'
import { TermTypes } from '#types'
import { getGEunit } from '#tw/geneExpression'

export class SearchHandler {
	callback: any
	app: any
	sampleTypeSelect?: any[]
	init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		if (mayRenderSampleTypeSelect(this.app.vocabApi.termdbConfig)) {
			// render sample type select
			const sampleTypeDiv = holder.append('div')
			const table = table2col({ holder: sampleTypeDiv, margin: '0px 0px 15px 0px' })
			const [td1, td2] = table.addRow()
			td1.text('Sample Type')
			this.sampleTypeSelect = renderSampleTypeSelect(td2, this.app.vocabApi.termdbConfig)
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
		const sampleTypes = getSelectedSampleTypes(this.sampleTypeSelect)
		if (this.sampleTypeSelect && !sampleTypes?.length) {
			window.alert('Must select at least one sample type')
			return
		}
		const unit = getGEunit(this.app.vocabApi)
		const name = `${gene} ${unit}`
		this.callback({
			q: { sampleTypes },
			term: { gene, name, type: TermTypes.GENE_EXPRESSION }
		})
	}
}
