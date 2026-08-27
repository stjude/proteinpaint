import {
	Menu,
	make_radios,
	addGeneSearchbox,
	GeneSetEditUI,
	table2col,
	renderSampleTypeSelect,
	getSelectedSampleTypes
} from '#dom'
import type { VocabApi } from '#types'
import { dtTerms, dtcnv, dtsnvindel } from '#shared/common.js'
import { isEligibleForAllelicGroupset } from '../../tw/geneVariant'
import { mayShowRememberedGvQ } from './rememberedGvQ.ts'

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
	sampleTypeSelect?: any
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
			/* unlike the child dt terms above, this one spans two dts, so it declares them rather
			than carrying a single .dt -- the same way its groupset does, see
			listPredefinedGroupsets() in client/tw/geneVariant.ts. Read by mayShowRememberedQ() */
			mutationTypeTerms.push({ name: 'Bi/mono-allelic', dts: [dtsnvindel, dtcnv] })

		// kept to name and match the selected mutation type in mayShowRememberedQ()
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
						this.updateSampleTypeSelect()
						/* any remembered settings still waiting for a choice were offered against the
						mutation type selected when the gene was picked -- both their order and their
						"Continue with ..." option, see mayShowRememberedQ() -- so a changed radio leaves
						them stale. Cleared rather than re-rendered, since the gene is picked again below */
						this.clearRememberedQ()
						// return focus to the gene search box so the user can type a gene right away
						this.focusSearchbox()
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
					callback: v => {
						// the gene input is rebuilt empty, so any settings offered for the gene that
						// was in it are waiting on a choice the user can no longer make sense of
						this.clearRememberedQ()
						if (v == 'single') this.searchGene()
						else this.searchGeneSet()
					}
				})
			}
			{
				this.dom.sampleTypeSelectRow = table.addRow()
				this.updateSampleTypeSelect()
			}
		}
		this.toggleGeneSetRadioDisplay(mutationTypeTermIdx)
		this.searchGene()
	}

	updateSampleTypeSelect() {
		const [td1, td2] = this.dom.sampleTypeSelectRow
		const querySampleTypes = this.getQuerySampleTypes()
		this.sampleTypeSelect = renderSampleTypeSelect(td2, querySampleTypes, this.opts.app.vocabApi.termdbConfig)
		if (this.sampleTypeSelect) {
			td1.style('display', null).text('Sample Type')
			td2.style('display', null)
		} else {
			td1.style('display', 'none')
			td2.style('display', 'none')
		}
	}

	// get sample types that are present in the selected data type
	getQuerySampleTypes() {
		const selectedMutationType = this.mutationTypeRadio.inputs.nodes().find(r => r.checked)
		if (!selectedMutationType) return
		const mutationTypeIdx = Number(selectedMutationType.value)
		if (!Number.isInteger(mutationTypeIdx)) return
		const dt = this.mutationTypeTerms[mutationTypeIdx]?.dt
		if (!Number.isInteger(dt)) return
		const bySampleType = this.opts.app.vocabApi.termdbConfig?.assayAvailability?.byDt?.[dt]?.bySampleType
		if (!bySampleType) return
		const querySampleTypes: number[] = []
		for (const [k, v] of Object.entries(bySampleType)) {
			if (v.hasSamples) querySampleTypes.push(Number(k))
		}
		return querySampleTypes
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
		const searchDiv = this.dom.searchDiv
		searchDiv.selectAll('*').remove()
		searchDiv.style('margin', '10px 0px')
		const geneSearch: any = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: this.opts.genomeObj,
			row: searchDiv,
			/* only allowing gene search for now because:
			- coordinate search is not yet supported for gdc
			- for other datasets, even though coordinate search is supported, it is not compatible with input type radios (single gene vs. geneset) because a coordinate may include one or more genes.
			TODO: fully support coordinate search
			*/
			searchOnly: 'gene',
			callback: async () => await this.selectGene(geneSearch)
		})
		this.dom.searchbox = geneSearch.searchbox
		searchDiv.select('.sja_genesearchinput').style('margin', '0px')
	}

	/** focus on the search box of the current gene input (single gene or gene set) */
	focusSearchbox() {
		this.dom.searchbox?.node()?.focus()
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

	// TODO: support sample type selection here too
	searchGeneSet() {
		this.dom.searchDiv.selectAll('*').remove()
		this.dom.searchDiv.style('margin-top', '0px')
		const ui = new GeneSetEditUI({
			holder: this.dom.searchDiv.append('div'),
			genome: this.opts.genomeObj,
			vocabApi: this.opts.app.vocabApi,
			nameInput: true,
			maxNumGenes: this.maxNumGenes,
			callback: async result => await this.selectGeneSet(result)
		})
		this.dom.searchbox = ui.geneSearch?.searchbox
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
	Offer the settings the user built earlier for the gene(s) just picked, so that the mutation
	type behind them is not applied until the user chooses, see mayShowRememberedGvQ() in
	./rememberedGvQ.ts.

	Only offered where the q of the selected term reaches the consumer, see keepsQ in
	client/termdb/TermTypeSearch.ts.

	The selected mutation type is handed over as well, so that a setting built for that same
	mutation type leads the options rather than the way to continue with it, see there.
	*/
	mayShowRememberedQ(): boolean {
		if (!this.opts.keepsQ) return false
		const idx = Number(this.mutationTypeRadio.inputs.nodes().find(r => r.checked).value)
		const mutationType = this.mutationTypeTerms[idx]
		const shown = mayShowRememberedGvQ({
			holder: this.dom.reuseDiv,
			vocabApi: this.opts.app.vocabApi,
			term: this.term,
			mutationType,
			skipLabel: `Continue with ${mutationType.name}`,
			callback: async q => (q ? await this.applyRememberedQ(q) : await this.applyMutationType())
		})
		/* a caller's message tells the user what picking a gene does, e.g. "Hit ENTER to launch
		plot." in client/plots/summarizeMutationSurvival.ts, which is no longer what happens
		while these options wait for a choice */
		if (shown) this.dom.msgDiv.style('display', 'none')
		return shown
	}

	/** clear the remembered settings offered for the gene last picked, and put back any caller
	message that mayShowRememberedQ() hid while they waited for a choice */
	clearRememberedQ() {
		this.dom.reuseDiv.style('display', 'none').selectAll('*').remove()
		if (this.opts.msg) this.dom.msgDiv.style('display', 'block').text(this.opts.msg)
	}

	/** apply the mutation type that the radios select, which is the default for a new term */
	async applyMutationType() {
		this.mayApplySampleType()
		if (this.sampleTypeSelect && !this.q.sampleTypes?.length) {
			window.alert('Must select at least one sample type')
			return
		}
		const selectedMutationType = this.mutationTypeRadio.inputs.nodes().find(r => r.checked)
		this.q.predefined_groupset_idx = Number(selectedMutationType.value)
		await this.submit(this.q)
	}

	mayApplySampleType() {
		this.q.sampleTypes = getSelectedSampleTypes(this.sampleTypeSelect)
	}

	async applyRememberedQ(q) {
		// copied, since the same entry may be picked again for another plot
		await this.submit({ ...structuredClone(q), isAtomic: true })
	}

	async submit(q) {
		this.dom.msgDiv.style('display', 'block').text('LOADING ...')
		await this.callback({ term: this.term, q })
		this.clearRememberedQ()
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
