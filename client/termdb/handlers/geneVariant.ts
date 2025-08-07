import { Menu, make_radios, addGeneSearchbox, GeneSetEditUI, table2col } from '#dom'
import { getChildTerms } from '../../termsetting/handlers/geneVariant'

export class SearchHandler {
	opts: any
	dom: any
	term: any // tw.term
	q: any // tw.q
	callback: any

	async init(opts) {
		this.opts = opts
		this.dom = {}
		this.term = { type: 'geneVariant' }
		this.q = { type: 'predefined-groupset' }
		this.callback = opts.callback
		opts.holder.style('padding', '5px 10px 10px 25px')
		this.dom.typeSettingDiv = opts.holder.append('div')
		this.dom.searchDiv = opts.holder.append('div').attr('data-testid', 'sjpp-genevariant-geneSearchDiv')
		this.dom.msgDiv = opts.holder
			.append('div')
			.style('display', 'none')
			.style('font-size', '.7em')
			.style('margin-top', '5px')
		if (opts.msg) this.dom.msgDiv.style('display', 'block').text(opts.msg)

		// get child dt terms
		await getChildTerms(this.term, this.opts.app.vocabApi, false)

		{
			const table = table2col({ holder: this.dom.typeSettingDiv, margin: '0px 0px 15px 0px' })
			// create radios for mutation type
			{
				const [td1, td2] = table.addRow()
				td1.text('Mutation Type')
				make_radios({
					holder: td2.attr('data-testid', 'sjpp-genevariant-mutationTypeRadios'),
					styles: { display: 'inline-block' },
					options: this.term.childTerms.map((t, i) => {
						return { label: t.name, value: i, checked: i === 0 }
					}),
					callback: i => {
						this.q.predefined_groupset_idx = i
					}
				})
				this.q.predefined_groupset_idx = 0
			}
			// create radios for type of gene input
			{
				const [td1, td2] = table.addRow()
				td1.text('Input Type')
				make_radios({
					holder: td2.attr('data-testid', 'sjpp-genevariant-genesetTypeRadios'),
					styles: { display: 'inline-block' },
					options: [
						{ label: 'Single Gene', value: 'single', checked: true },
						{ label: 'Gene Set', value: 'geneset', checked: false }
					],
					callback: v => (v == 'single' ? this.searchGene() : this.searchGeneSet())
				})
			}
		}
		this.searchGene()
	}

	searchGene() {
		this.dom.searchDiv.selectAll('*').remove()
		this.dom.searchDiv.style('margin-top', '10px')
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: this.opts.genomeObj,
			row: this.dom.searchDiv,
			callback: async () => await this.selectGene(geneSearch)
		})
		this.dom.searchDiv.select('.sja_genesearchinput').style('margin', '0px')
	}

	async selectGene(geneSearch) {
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
		await this.runCallback()
	}

	searchGeneSet() {
		this.dom.searchDiv.selectAll('*').remove()
		this.dom.searchDiv.style('margin-top', '0px')
		new GeneSetEditUI({
			holder: this.dom.searchDiv.append('div'),
			genome: this.opts.genomeObj,
			vocabApi: this.opts.app.vocabApi,
			callback: async result => await this.selectGeneSet(result)
		})
		this.dom.searchDiv.select('.sja_genesetinput').style('padding', '0px')
	}

	async selectGeneSet(result) {
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
		await this.runCallback()
	}

	async runCallback() {
		this.dom.msgDiv.style('display', 'block').text('LOADING ...')
		// get child dt terms again now that a gene/geneset has
		// been selected, mutation classes will be filtered
		// for those present in the data for that gene/geneset
		await getChildTerms(this.term, this.opts.app.vocabApi)
		this.callback({ term: this.term, q: this.q })
	}
}
