import { Menu, make_radios, addGeneSearchbox, GeneSetEditUI, table2col } from '#dom'
import type { VocabApi } from '#types'
import { dtTerms } from '#shared/common.js'

// TODO: output of this handler should not be q.predefined_groupset_idx, instead should be q.dt and q.origin. Then, in client/tw/geneVariant.ts, should fill in q.predefined_groupset_idx based on q.dt and q.origin. This will also allow easy specification of desired dt/origin in url. Will need to make separate radio buttons for dt and origin to support the different q properties.

type Opts = {
	holder: any
	app: any
	genomeObj: any
	dt?: number // dt to search, if missing will use first available dt in ds
	msg?: string // message to be displayed below search bar
	callback: (tw: any) => Promise<void>
}

export class SearchHandler {
	opts: any
	dom: any
	mutationTypeRadio: any
	term: any // tw.term
	q: any // tw.q
	callback: any

	async init(opts: Opts) {
		this.opts = opts
		this.dom = {}
		this.term = { type: 'geneVariant' }
		this.q = { type: 'predefined-groupset' }
		this.callback = opts.callback
		opts.holder.style('padding', '5px 10px 10px 25px')
		this.dom.typeSettingDiv = opts.holder.append('div')
		this.dom.searchDiv = opts.holder
			.append('div')
			.attr('data-testid', 'sjpp-genevariant-geneSearchDiv')
			.style('padding-left', '3px')
		this.dom.msgDiv = opts.holder
			.append('div')
			.style('display', 'none')
			.style('font-size', '.7em')
			.style('margin-top', '5px')
			.style('padding-left', '3px')
		if (opts.msg) this.dom.msgDiv.style('display', 'block').text(opts.msg)

		// get child dt terms
		getChildTerms(this.term, this.opts.app.vocabApi)

		// get index of child dt term to select in mutation type radios
		const childTermIdx = opts.dt ? this.term.childTerms.findIndex(t => t.dt == opts.dt) : 0
		if (!Number.isInteger(childTermIdx) || childTermIdx == -1) throw 'invalid child term index'

		{
			const table = table2col({ holder: this.dom.typeSettingDiv, margin: '0px 0px 15px 0px' })
			// create radios for mutation type
			{
				const [td1, td2] = table.addRow()
				td1.text('Mutation Type')
				this.mutationTypeRadio = make_radios({
					holder: td2.attr('data-testid', 'sjpp-genevariant-mutationTypeRadios'),
					styles: { display: 'inline-block' },
					options: this.term.childTerms.map((t, i) => {
						return { label: t.name, value: i, checked: i == childTermIdx }
					}),
					callback: () => {}
				})
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
		this.dom.searchDiv.style('margin', '10px 0px')
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: this.opts.genomeObj,
			row: this.dom.searchDiv,
			/* only allowing gene search for now because:
			- coordinate search is not yet supported for gdc
			- for other datasets, even though coordinate search is supported, it is not compatible with input type radios (single gene vs. geneset) because a coordinate may include one or more genes.
			TODO: fully support coordinate search
			*/
			searchOnly: 'gene',
			callback: async () => await this.selectGene(geneSearch)
		})
		this.dom.searchDiv.select('.sja_genesearchinput').style('margin', '0px')
	}

	async selectGene(geneSearch) {
		if (geneSearch.geneSymbol) {
			const name = geneSearch.geneSymbol
			Object.assign(this.term, {
				id: name,
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
				id: name,
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
			nameInput: true,
			//maxNumGenes: 100, // can enable to set max limit for # genes
			callback: async result => await this.selectGeneSet(result)
		})
		this.dom.searchDiv.select('.sja_genesetinput').style('padding', '0px').style('margin-top', '-10px')
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
		const name = result.name
		if (!name) throw 'gene set name not found'
		Object.assign(this.term, {
			id: name,
			name,
			genes,
			type: 'geneVariant'
		})
		await this.runCallback()
	}

	async runCallback() {
		this.dom.msgDiv.style('display', 'block').text('LOADING ...')
		// add parent geneVariant term to each child term now
		// that gene(s) have been selected
		addParentTerm(this.term)
		const selectedMutationType = this.mutationTypeRadio.inputs.nodes().find(r => r.checked)
		this.q.predefined_groupset_idx = Number(selectedMutationType.value)
		await this.callback({ term: this.term, q: this.q })
		this.dom.msgDiv.style('display', 'none')
	}
}

// function to get child dt terms that are present in dataset
export function getChildTerms(term, vocabApi: VocabApi) {
	if (!vocabApi.termdbConfig?.queries) throw 'termdbConfig.queries is missing'
	term.childTerms = []
	for (const _t of dtTerms) {
		const t = structuredClone(_t)
		if (!Object.keys(vocabApi.termdbConfig.queries).includes(t.query)) continue // dt is not in dataset
		const byOrigin = vocabApi.termdbConfig.assayAvailability?.byDt[t.dt]?.byOrigin
		if (byOrigin) {
			// dt has origins in dataset
			if (!t.origin) continue // dt term does not have origin, so skip
			if (!Object.keys(byOrigin).includes(t.origin)) throw 'unexpected origin of dt term'
		} else {
			// dt does not have origins in dataset
			if (t.origin) continue // dt term has origin, so skip
		}
		term.childTerms.push(t)
	}
}

// add parent geneVariant term to each child dt term
// note: cannot be done within getChildTerms() because
// getChildTerms() is called by init() before any genes
// have been selected
export function addParentTerm(term) {
	if (!term.childTerms?.length) throw 'term.childTerms[] is missing'
	for (const t of term.childTerms) {
		t.parentTerm = structuredClone(term)
		delete t.parentTerm.childTerms // remove any nested child terms
		delete t.parentTerm.groupsetting // remove nested term groupsetting
	}
}
