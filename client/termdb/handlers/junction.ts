import { junctionCustomTermSource, withSampleTypes, type JunctionCustomTerm } from './junction.customTerm.ts'
import { mayRenderFractionSelection } from './termCollectionFractionSelection.ts'
import {
	Menu,
	addGeneSearchbox,
	mayRenderSampleTypeRow,
	getTermSampleTypes,
	getChosenSampleTypes,
	getChildSampleTypeQuery
} from '#dom'

export class SearchHandler {
	async init(opts) {
		if (!opts?.holder) throw new Error('opts.holder is required')
		if (typeof opts.callback != 'function') throw new Error('opts.callback is required')

		const entries = getJunctionCustomTerms(opts.app.vocabApi.state?.customTerms)
		render(opts, entries)
	}
}

export function getJunctionCustomTerms(customTerms: any): JunctionCustomTerm[] {
	if (!Array.isArray(customTerms)) return []
	return customTerms.filter(term => term?.source === junctionCustomTermSource && term.tw?.term)
}

function render(opts, entries: JunctionCustomTerm[]) {
	const holder = opts.holder
	holder.selectAll('*').remove()
	const div = holder.append('div').style('padding', '10px 0px')
	const termdbConfig = opts.app.vocabApi.termdbConfig
	// the sample types with a parent, as the genome browser offers them
	const query = getChildSampleTypeQuery(termdbConfig?.queries?.junction, termdbConfig)

	if (!entries.length) {
		renderNoJunctions(div, opts, query)
		return
	}

	/* the sample types to read the picked junction for, as for gene expression and methylation terms.
	Drawn once: a delete redraws only the list below, so the choice stays */
	const sampleTypeSelect = mayRenderSampleTypeRow(div.append('div'), query, termdbConfig)
	/* a junction or event term, or the term wrapper of an event's fraction from the fraction chooser, with
	the chosen sample types, see withSampleTypes() */
	const pick = (termOrTw: any) => {
		const termSampleTypes = getTermSampleTypes(sampleTypeSelect, query, termdbConfig)
		// nothing selectable, which getTermSampleTypes() has alerted
		if (!termSampleTypes) return
		/* every sample type of the junction file, or its only one, is the same as no choice: the term then
		reads every sample, as before there was a selector, including any sample without a sample type. A term
		selected from a genome browser track that reads some sample types keeps them, unless others are chosen here */
		const all = !getChosenSampleTypes(query, termSampleTypes.sampleTypes)
		const apply = (term: any) => (all ? term : withSampleTypes(term, termSampleTypes))
		return opts.callback(termOrTw.term ? { ...termOrTw, term: apply(termOrTw.term) } : apply(termOrTw))
	}

	const listHolder = div.append('div')
	const renderList = () => {
		const entries = getJunctionCustomTerms(opts.app.vocabApi.state?.customTerms)
		// the last one is deleted
		if (!entries.length) return render(opts, entries)
		listHolder.selectAll('*').remove()
		const itemOpts = { ...opts, callback: pick, renderList }

		// the fraction chooser is rendered in a sibling div, so that the list may be
		// restored without reloading, when the user backs out of the chooser
		const listDiv = listHolder.append('div')
		const fractionDiv = listHolder.append('div')

		for (const entry of entries) {
			if (entry.eventlabel) renderJunctionEvent(listDiv, fractionDiv, entry, itemOpts)
			else renderJunction(listDiv, entry, itemOpts)
		}

		listDiv
			.append('div')
			.style('font-size', '.7em')
			.style('margin-top', '10px')
			.style('opacity', 0.7)
			.text('Select additional junctions from genome browser.')
	}
	renderList()
}

/* Junction terms are made only in a genome browser, by Select on a junction of its splice junction
track, so a search here opens one, in the mass app that vocabApi belongs to. As in the gene
expression picker, the sample type row is above the search: the genome browser opens with
the chosen sample types, which a junction selected from its track keeps. */
function renderNoJunctions(div, opts, query) {
	const termdbConfig = opts.app.vocabApi.termdbConfig
	const massApp = opts.app.vocabApi.app
	// only the mass app, whose state lists plots, can open a genome browser; a standalone termdb app cannot
	const canOpen = Array.isArray(massApp?.getState?.()?.plots) && opts.genomeObj
	const sampleTypeSelect = canOpen ? mayRenderSampleTypeRow(div.append('div'), query, termdbConfig) : undefined
	div.append('div').text('Junctions selected from genome browser will be shown here.')
	if (!canOpen) return
	const row = div.append('div').style('margin-top', '10px')
	row.append('span').style('margin-right', '5px').text('Open genome browser at')
	const geneSearch = addGeneSearchbox({
		tip: new Menu({ padding: '0px' }),
		genome: opts.genomeObj,
		row,
		callback: () => {
			const { chr, start, stop } = geneSearch
			if (!chr) return
			const config = getGenomeBrowserConfig({ chr, start, stop }, sampleTypeSelect, query, termdbConfig)
			if (config) massApp.dispatch({ type: 'plot_create', config })
		}
	})
}

/** the genome browser the search opens: at the found region, on its splice junction tab, with the sample
 * types of the row (none, or every one, reads every sample). undefined when nothing is selectable, which
 * getTermSampleTypes() has alerted */
export function getGenomeBrowserConfig(geneSearchResult, sampleTypeSelect, query, termdbConfig) {
	const termSampleTypes = getTermSampleTypes(sampleTypeSelect, query, termdbConfig)
	if (!termSampleTypes) return
	const sampleTypes = getChosenSampleTypes(query, termSampleTypes.sampleTypes)
	return {
		chartType: 'genomeBrowser',
		blockIsProteinMode: false,
		geneSearchResult,
		activeTab: 'Splice Junction',
		...(sampleTypes ? { sampleTypes } : {})
	}
}

function renderJunction(holder, entry: JunctionCustomTerm, opts) {
	const choice = holder.append('div')
	choice
		.append('div')
		.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
		.style('display', 'inline-block')
		.style('border-radius', '6px')
		.style('margin', '1px 0')
		.text(entry.tw.term.name)
		.on('click', () => opts.callback(entry.tw.term))
	addDeleteButton(choice, entry, opts)
}

function renderJunctionEvent(holder, fractionDiv, entry: JunctionCustomTerm, opts) {
	const eventHolder = holder.append('div')
	const pillRow = eventHolder.append('div')
	pillRow
		.append('div')
		.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
		.style('display', 'inline-block')
		.style('border-radius', '6px')
		.style('margin', '1px 0')
		// the event label, and the sample types it was selected for
		.text(entry.name)
		.on('click', () => selectJunctionEvent(holder, fractionDiv, entry, opts))
	addDeleteButton(pillRow, entry, opts)
	eventHolder
		.append('div')
		.style('margin-left', '10px')
		.style('font-size', '.7em')
		.selectAll('div')
		.data(entry.tw.term.termlst, term => term.id)
		.enter()
		.append('div')
		.text(term => term.name)
}

function selectJunctionEvent(listDiv, fractionDiv, entry: JunctionCustomTerm, opts) {
	const isStaged = mayRenderFractionSelection({
		term: entry.tw.term,
		selectionMode: opts.termCollectionSelectionMode,
		listDiv,
		fractionDiv,
		callback: tw => opts.callback(tw)
	})
	if (!isStaged) opts.callback(entry.tw.term)
}

function addDeleteButton(holder, entry: JunctionCustomTerm, opts) {
	holder
		.append('button')
		.attr('data-testid', 'sjpp-junction-delete')
		.style('margin-left', '4px')
		.attr('aria-label', `Delete ${entry.name}`)
		.text('×')
		.on('click', async () => {
			await opts.app.vocabApi.deleteCustomTermById(entry.id)
			opts.renderList()
		})
}
