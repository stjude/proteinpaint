import { Menu, make_radios, addGeneSearchbox, GeneSetEditUI } from '#dom'
import { getChildTerms } from '../../termsetting/handlers/geneVariant'

export class SearchHandler {
	opts: any
	dom: any
	term: any // tw.term
	q: any // tw.q
	callback: any

	init(opts) {
		this.opts = opts
		this.dom = {}
		this.term = { type: 'geneVariant' }
		this.q = { type: 'predefined-groupset' }
		this.callback = opts.callback
		opts.holder.style('padding', '5px 5px 10px 25px')
		this.dom.mutationTypeRadiosDiv = opts.holder.append('div').style('margin-bottom', '5px')
		this.dom.inputTypeRadiosDiv = opts.holder.append('div')
		this.dom.searchDiv = opts.holder.append('div')

		// create radios for mutation type
		// get child dt terms
		getChildTerms(this.term, this.opts.app.vocabApi)
		this.dom.mutationTypeRadiosDiv
			.append('div')
			.style('display', 'inline-block')
			.style('font-weight', 'bold')
			.style('margin-right', '2px')
			.text('Mutation type')
		// build radios based on child dt terms
		make_radios({
			holder: this.dom.mutationTypeRadiosDiv,
			styles: { display: 'inline-block' },
			options: this.term.childTerms.map((t, i) => {
				return { label: t.name, value: i, checked: i === 0 }
			}),
			callback: i => {
				this.q.predefined_groupset_idx = i
			}
		})
		this.q.predefined_groupset_idx = 0

		// create radios for type of gene input
		this.dom.inputTypeRadiosDiv
			.append('div')
			.style('display', 'inline-block')
			.style('font-weight', 'bold')
			.style('margin-right', '2px')
			.text('Input type')
		make_radios({
			holder: this.dom.inputTypeRadiosDiv,
			styles: { display: 'inline-block' },
			options: [
				{ label: 'Single Gene', value: 'single', checked: true },
				{ label: 'Gene Set', value: 'geneset', checked: false }
			],
			callback: v => (v == 'single' ? this.searchGene() : this.searchGeneSet())
		})
		this.searchGene()
	}

	searchGene() {
		this.dom.searchDiv.selectAll('*').remove()
		this.dom.searchDiv.style('margin-top', '10px')
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: this.opts.genomeObj,
			row: this.dom.searchDiv,
			callback: () => this.selectGene(geneSearch)
		})
		this.dom.searchDiv.select('.sja_genesearchinput').style('margin', '0px')
	}

	selectGene(geneSearch) {
		if (geneSearch.geneSymbol) {
			const name = geneSearch.geneSymbol
			Object.assign(this.term, {
				name,
				genes: [
					{
						kind: 'gene',
						id: name,
						gene: name,
						name,
						type: 'geneVariant'
					}
				],
				type: 'geneVariant'
			})
		} else if (geneSearch.chr && geneSearch.start && geneSearch.stop) {
			const { chr, start, stop } = geneSearch
			// name should be 1-based coordinate
			const name = `${chr}:${start + 1}-${stop}`
			Object.assign(this.term, {
				name,
				genes: [
					{
						kind: 'coord',
						chr,
						start,
						stop,
						name,
						type: 'geneVariant'
					}
				],
				type: 'geneVariant'
			})
		} else {
			throw 'no gene or position specified'
		}
		this.callback({ term: this.term, q: this.q })
	}

	searchGeneSet() {
		this.dom.searchDiv.selectAll('*').remove()
		this.dom.searchDiv.style('margin-top', '0px')
		new GeneSetEditUI({
			holder: this.dom.searchDiv.append('div'),
			genome: this.opts.genomeObj,
			vocabApi: this.opts.app.vocabApi,
			callback: result => this.selectGeneSet(result)
		})
		this.dom.searchDiv.select('.sja_genesetinput').style('padding', '0px')
	}

	selectGeneSet(result) {
		const genes = result.geneList.map(v => {
			if (!v.gene) throw 'gene name not found'
			const name = v.gene
			const gene = {
				kind: 'gene',
				id: name,
				gene: name,
				name,
				type: 'geneVariant'
			}
			return gene
		})
		Object.assign(this.term, {
			name: genes.map(gene => gene.name).join(', '),
			genes,
			type: 'geneVariant'
		})
		this.callback({ term: this.term, q: this.q })
	}
}
