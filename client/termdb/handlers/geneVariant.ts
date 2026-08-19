import { Menu, make_radios, addGeneSearchbox, GeneSetEditUI, table2col } from '#dom'
import type { VocabApi } from '#types'
import { dtTerms, dtcnv } from '#shared/common.js'
import { isEligibleForAllelicGroupset } from '../../tw/geneVariant'

// TODO: output of this handler should not be q.predefined_groupset_idx, instead should be q.dt and q.origin. Then, in client/tw/geneVariant.ts, should fill in q.predefined_groupset_idx based on q.dt and q.origin. This will also allow easy specification of desired dt/origin in url. Will need to make separate radio buttons for dt and origin to support the different q properties.

type Opts = {
	holder: any
	app: any
	genomeObj: any
	dt?: number // dt to search, if missing will use first available dt in ds
	msg?: string // message to be displayed below search bar
	/** true when the consumer keeps the q of the selected term, see SearchHandlerOpts in
	 * client/termdb/TermTypeSearch.ts. Remembered settings are only offered when it does */
	keepsQ?: boolean
	callback: (tw: any) => Promise<void>
}

export class SearchHandler {
	opts: any
	dom: any
	mutationTypeRadio: any
	mutationTypeTerms!: any[]
	inputTypeRadio: any
	term: any // tw.term
	q: any // tw.q
	callback: any
	maxNumGenes: any

	async init(opts: Opts) {
		this.opts = opts
		this.dom = {}
		this.term = { type: 'geneVariant' }
		this.q = { type: 'predefined-groupset' }
		this.callback = opts.callback
		this.maxNumGenes = this.opts.app.vocabApi.termdbConfig?.maxGeneVariantGeneSetSize || 200 // max # genes allowed
		opts.holder.style('padding', '5px 10px 10px 25px')
		this.dom.typeSettingDiv = opts.holder.append('div')
		this.dom.searchDiv = opts.holder
			.append('div')
			.attr('data-testid', 'sjpp-genevariant-geneSearchDiv')
			.style('padding-left', '3px')
		// settings remembered for the gene(s) just picked, filled in by mayShowRememberedQ()
		this.dom.reuseDiv = opts.holder.append('div').style('display', 'none').style('margin-top', '10px')
		this.dom.msgDiv = opts.holder
			.append('div')
			.style('display', 'none')
			.style('font-size', '.7em')
			.style('margin-top', '5px')
			.style('padding-left', '3px')
		if (opts.msg) this.dom.msgDiv.style('display', 'block').text(opts.msg)

		// get child dt terms
		getChildTerms(this.term, this.opts.app.vocabApi)

		// collect mutation type terms
		const mutationTypeTerms = structuredClone(this.term.childTerms)
		// add in bi/mono-allelic mutation type, if applicable
		if (isEligibleForAllelicGroupset(this.term, this.opts.app.vocabApi))
			mutationTypeTerms.push({ name: 'Bi/mono-allelic' })

		// kept to name the selected mutation type in mayShowRememberedQ()
		this.mutationTypeTerms = mutationTypeTerms

		// get index of mutation type term to select in mutation type radios
		const mutationTypeTermIdx = opts.dt ? mutationTypeTerms.findIndex(t => t.dt == opts.dt) : 0
		if (!Number.isInteger(mutationTypeTermIdx) || mutationTypeTermIdx == -1)
			throw new Error('invalid mutation type term index')

		{
			const table = table2col({ holder: this.dom.typeSettingDiv, margin: '0px 0px 15px 0px' })
			// create radios for mutation type
			{
				const [td1, td2] = table.addRow()
				td1.text('Mutation Type')
				this.mutationTypeRadio = make_radios({
					holder: td2.attr('data-testid', 'sjpp-genevariant-mutationTypeRadios'),
					styles: { display: 'inline-block' },
					options: mutationTypeTerms.map((t, i) => {
						return {
							label: t.name,
							value: i,
							checked: i == mutationTypeTermIdx,
							testid: 'sjpp-genevarianttermdbhandler-radio-' + t.name
						}
					}),
					callback: v => {
						this.toggleGeneSetRadioDisplay(v)
					}
				})
			}
			// create radios for type of gene input
			{
				const [td1, td2] = table.addRow()
				td1.text('Input Type')
				this.inputTypeRadio = make_radios({
					holder: td2.attr('data-testid', 'sjpp-genevariant-genesetTypeRadios'),
					styles: { display: 'inline-block' },
					options: [
						{
							label: 'Single Gene',
							value: 'single',
							checked: true,
							testid: 'sjpp-genevarianttermdbhandler-singlegene'
						},
						{ label: 'Gene Set', value: 'geneset', checked: false, testid: 'sjpp-genevarianttermdbhandler-geneset' }
					],
					callback: v => (v == 'single' ? this.searchGene() : this.searchGeneSet())
				})
			}
		}
		this.toggleGeneSetRadioDisplay(mutationTypeTermIdx)
		this.searchGene()
	}

	// hide gene set radio when mutation type is cnv
	// because cnv of one gene can disguise cnv of another gene
	// example: if sample has cnv amplification in geneA and
	// cnv deletion in geneB, classification of the sample will
	// be ambiguous
	toggleGeneSetRadioDisplay(childTermIdx) {
		const childTerm = this.term.childTerms[childTermIdx]
		const geneSetDiv = this.inputTypeRadio.divs.filter(d => {
			if (d.value != 'single' && d.value != 'geneset') throw new Error('unexpected input type radio value')
			return d.value == 'geneset'
		})
		const geneInput = this.inputTypeRadio.inputs.filter(d => {
			if (d.value != 'single' && d.value != 'geneset') throw new Error('unexpected input type radio value')
			return d.value == 'single'
		})
		if (childTerm?.dt == dtcnv) {
			// mutation type is cnv
			// hide gene set radio button
			geneSetDiv.style('display', 'none')
			// select single gene radio button
			geneInput.node().click()
		} else {
			// mutation type is not cnv
			// can display gene set radio button
			geneSetDiv.style('display', 'inline-block')
		}
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
			maxNumGenes: this.maxNumGenes,
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
		this.dom.reuseDiv.style('display', 'none').selectAll('*').remove()
		// add parent geneVariant term to each child term now
		// that gene(s) have been selected
		addParentTerm(this.term)
		// a setting the user built for this gene before is worth offering, and is only known
		// once the gene is picked, so the selected mutation type is not applied until the user
		// either picks one of those settings or skips them
		if (this.mayShowRememberedQ()) return
		await this.applyMutationType()
	}

	/*
	Offer the settings the user built earlier for the gene(s) just picked, see remember_gvq()
	in client/mass/store.ts. Returns true when the choices are rendered, so that runCallback()
	waits for a click rather than applying the mutation type radio behind them.

	Nothing is offered where the q would not survive the selection, see keepsQ in
	client/termdb/TermTypeSearch.ts, nor outside a mass app, whose store is the only one that
	remembers these.
	*/
	mayShowRememberedQ(): boolean {
		if (!this.opts.keepsQ) return false
		const lst = this.opts.app.vocabApi.getGvQLst?.(this.term) || []
		if (!lst.length) return false

		const div = this.dom.reuseDiv.style('display', 'block')
		div
			.append('div')
			.style('margin-bottom', '5px')
			.style('opacity', 0.65)
			.style('font-size', '.9em')
			.text(`Previously used for ${this.term.name}`)

		/* these options are rendered after the enclosing menu has already wired its own tab
		navigation, which only covers what existed when the menu opened (see setTabNavigation()
		in client/dom/menu.js), so each one makes itself keyboard operable */
		const options: any[] = []
		const addOption = (label: string, callback: () => Promise<void>) => {
			const option = div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('tabindex', 0)
				.attr('role', 'button')
				.text(label)
				.on('click', callback)
				.on('keydown', (event: KeyboardEvent) => {
					/* activating on keydown rather than keyup: the gene above is picked by pressing
					Enter in the search box, and the keyup of that same press would otherwise land on
					the option focused below and apply it without the user choosing it */
					if (event.key == 'Enter' || event.key == ' ') {
						event.preventDefault()
						;(event.target as HTMLElement).click()
						return
					}
					const step = event.key == 'ArrowDown' ? 1 : event.key == 'ArrowUp' ? -1 : 0
					if (!step) return
					// wraps, so that arrowing past either end stays within the options
					const i = options.indexOf(option)
					options[(i + step + options.length) % options.length].node().focus()
					event.preventDefault() // arrowing moves the focus, it does not scroll the menu
				})
			options.push(option)
			return option
		}

		for (const entry of lst) {
			addOption(entry.label, async () => await this.applyRememberedQ(entry.q)).attr(
				'data-testid',
				'sjpp-genevariant-rememberedQ'
			)
		}
		const idx = Number(this.mutationTypeRadio.inputs.nodes().find(r => r.checked).value)
		addOption(`Continue with ${this.mutationTypeTerms[idx].name}`, async () => await this.applyMutationType()).style(
			'margin-top',
			'8px'
		)

		// the most recent setting is the likely choice, so it starts focused
		options[0].node().focus()
		return true
	}

	/** apply the mutation type that the radios select, which is the default for a new term */
	async applyMutationType() {
		const selectedMutationType = this.mutationTypeRadio.inputs.nodes().find(r => r.checked)
		this.q.predefined_groupset_idx = Number(selectedMutationType.value)
		await this.submit(this.q)
	}

	async applyRememberedQ(q) {
		// copied, since the same entry may be picked again for another plot
		await this.submit({ ...structuredClone(q), isAtomic: true })
	}

	async submit(q) {
		this.dom.msgDiv.style('display', 'block').text('LOADING ...')
		await this.callback({ term: this.term, q })
		this.dom.reuseDiv.style('display', 'none').selectAll('*').remove()
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
