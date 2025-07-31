import { Menu, make_radios, addGeneSearchbox, GeneSetEditUI } from '#dom'

export class SearchHandler {
	opts: any
	dom: any
	callback: any

	init(opts) {
		this.opts = opts
		this.dom = {}
		this.callback = opts.callback
		this.dom.radiosDiv = opts.holder.append('div')
		this.dom.searchDiv = opts.holder.append('div')
		/*
		retain ability of adding geneset as row in matrix, in addition to one gene per row
		if (this.opts.app?.opts?.state?.tree?.usecase?.target == 'matrix') {
			// hide radios in matrix to prevent switching to gene set
			// because matrix already adds genes one by one to gene set
			this.dom.radiosDiv.style('display', 'none')
		}
		*/
		make_radios({
			holder: this.dom.radiosDiv,
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
		this.dom.searchDiv.style('margin-top', '5px')
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: this.opts.genomeObj,
			row: this.dom.searchDiv,
			callback: () => this.selectGene(geneSearch)
		})
	}

	selectGene(geneSearch) {
		if (geneSearch.geneSymbol) {
			const name = geneSearch.geneSymbol
			const term = {
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
			}
			this.callback(term)
		} else if (geneSearch.chr && geneSearch.start && geneSearch.stop) {
			const { chr, start, stop } = geneSearch
			// name should be 1-based coordinate
			const name = `${chr}:${start + 1}-${stop}`
			const term = {
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
			}
			this.callback(term)
		} else {
			throw 'no gene or position specified'
		}
	}

	searchGeneSet() {
		this.dom.searchDiv.selectAll('*').remove()
		this.dom.searchDiv.style('margin-top', '0px')
		new GeneSetEditUI({
			holder: this.dom.searchDiv,
			genome: this.opts.genomeObj,
			vocabApi: this.opts.app.vocabApi,
			callback: result => this.selectGeneSet(result)
		})
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
		const term = {
			name: genes.map(gene => gene.name).join(', '),
			genes,
			type: 'geneVariant'
		}
		this.callback(term)
	}
}
