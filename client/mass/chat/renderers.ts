// DOM rendering for result rows. One renderer per row kind (RENDERERS); every clickable button is made by
// addActionButton so styling, test ids and error handling live in one place.
import { escapeHtml } from '#dom'
import { getSampleFilter } from '../groups.js'
import { getGeneCategoriesFor } from './registry.ts'
import type { Launcher } from './launcher.ts'
import type { ResultsPopup } from './popup.ts'
import type { Capabilities, CoordRow, DictRow, GeneRow, HeadingRow, NoteRow, ResultRow, SampleRow } from './types.ts'

export type RenderDeps = {
	caps: Capabilities
	launcher: Launcher
	popup: ResultsPopup
	/** add a chat-history bubble; `me` marks the user's side */
	addBubble: (arg: { msg: string; me?: number }) => any
}

/** Append a clickable action button to `parent`. Errors thrown by onClick are shown in the popup. */
export function addActionButton(
	parent: any,
	deps: Pick<RenderDeps, 'popup'>,
	opts: { label: string; testid: string; onClick: () => Promise<void> }
) {
	return parent
		.append('span')
		.attr('class', 'sja_menuoption')
		.attr('data-testid', opts.testid)
		.style('display', 'inline-block')
		.style('margin', '0px 3px')
		.style('padding', '5px 10px')
		.style('border-radius', '5px')
		.style('cursor', 'pointer')
		.text(opts.label)
		.on('click', () => void opts.onClick().catch(e => deps.popup.showError(e)))
}

function renderHeading(tr: any, row: HeadingRow) {
	// group label spanning both columns; not selectable
	tr.append('td')
		.attr('colspan', 2)
		.attr('data-testid', `sjpp-mass-chat-heading-${row.name.toLowerCase().replace(/\s+/g, '-')}`)
		.text(row.name)
		.style('padding', '6px 10px 2px')
		.style('font-weight', 'bold')
		.style('font-size', '0.85em')
		.style('text-transform', 'uppercase')
		.style('opacity', 0.5)
}

function renderNote(tr: any, row: NoteRow) {
	// "Displaying N out of M ... matches" at the bottom of a truncated group; not selectable
	tr.append('td')
		.attr('colspan', 2)
		.attr('data-testid', row.testid)
		.text(row.name)
		.style('padding', '2px 10px 6px')
		.style('font-size', '0.8em')
		.style('font-style', 'italic')
		.style('opacity', 0.6)
}

function renderCoord(tr: any, row: CoordRow, deps: RenderDeps) {
	// region label + a genome browser button. No protein view: a bare region is not tied to one gene.
	tr.append('td').text(row.name).style('padding', '5px 10px')
	addActionButton(tr.append('td'), deps, {
		label: 'Genome Browser',
		testid: 'sjpp-mass-chat-coord-genomebrowser',
		onClick: () => deps.launcher.launchGenomeBrowserView('genomic', { coord: row.coord })
	})
}

/** Sample actions, in display order. An action appears only when the server confirmed it applies to this
 * particular sample. */
const SAMPLE_ACTIONS: {
	label: string
	testid: (row: SampleRow) => string
	available: (row: SampleRow) => boolean
	config: (row: SampleRow) => any
}[] = [
	{
		label: 'Sample View',
		testid: row => `sjpp-mass-chat-sample-view-${row.sampleId}`,
		available: () => true,
		// config.sample (singular): the same single-sample shape the scatter click handler dispatches
		config: row => ({ chartType: 'sampleView', sample: { sampleId: row.sampleId, sampleName: row.name } })
	},
	{
		label: 'Single cell',
		testid: row => `sjpp-mass-chat-single-cell-${row.sampleId}`,
		available: row => Boolean(row.singleCell),
		config: row => ({ chartType: 'sc', settings: { sc: { item: row.singleCell } } })
	},
	{
		label: 'Whole Slide Images',
		testid: row => `sjpp-mass-chat-wsimages-${row.sampleId}`,
		available: row => Boolean(row.wsimages),
		// whole-slide viewer in fixed-sample mode, restricted to plain slides
		config: row => ({ chartType: 'wsi', sample: { sID: row.name }, imageType: 'wsi' })
	},
	{
		label: 'Facet Table',
		testid: row => `sjpp-mass-chat-assays-${row.sampleId}`,
		available: row => Boolean(row.facetTracks?.length),
		config: row => ({ chartType: 'genomeBrowser', hidePlotFilter: true, filter: getSampleFilter(row.sampleId) })
	}
]

function renderSample(tr: any, row: SampleRow, deps: RenderDeps) {
	tr.append('td').text(row.name).style('padding', '5px 10px')
	const actionsTd = tr.append('td')
	for (const action of SAMPLE_ACTIONS) {
		if (!action.available(row)) continue
		addActionButton(actionsTd, deps, {
			label: action.label,
			testid: action.testid(row),
			onClick: () => deps.launcher.launchPlot(action.config(row))
		})
	}
}

/** Category rows for a selected gene (Gene expression / variants / DNA methylation) into `holder`: one label
 * + action button(s) per category the dataset allows AND this gene has. */
export function renderGeneCategories(holder: any, row: GeneRow, deps: RenderDeps) {
	for (const { label, actions } of getGeneCategoriesFor(deps.caps, row)) {
		const line = holder.append('div').style('margin', '4px 0')
		line
			.append('span')
			.style('font-weight', 'bold')
			.style('margin-right', '8px')
			.text(label + ':')
		for (const action of actions) {
			addActionButton(line, deps, {
				label: action.label,
				testid: action.testid(row.gene),
				onClick: () => action.run(deps.launcher, row)
			})
		}
	}
}

function renderGene(tr: any, row: GeneRow, deps: RenderDeps) {
	// Clicking the name selects the gene: echoes "[ME] <name> (gene)" into chat history, then renders the
	// available categories into a new bubble right below it.
	tr.append('td')
		.text(row.name)
		.style('padding', '5px 10px')
		.style('cursor', 'pointer')
		.attr('class', 'sja_menuoption')
		.attr('data-testid', `sjpp-mass-chat-gene-select-${row.gene}`)
		.on('click', () => {
			deps.popup.inputNode.value = ''
			deps.popup.hide()
			deps.addBubble({ msg: escapeHtml(row.name) + ' (gene)', me: 1 })
			renderGeneCategories(deps.addBubble({ msg: '' }), row, deps)
		})
}

function renderDict(tr: any, row: DictRow, deps: RenderDeps) {
	const nameTd = tr.append('td').text(row.name)
	if (row.selectable) {
		nameTd
			.style('cursor', 'pointer')
			.attr('class', 'sja_menuoption')
			.attr('data-testid', `sjpp-mass-chat-term-${row.term.id}`)
			.on('click', async () => {
				deps.addBubble({ msg: escapeHtml(row.name) + ' (dictionary variable)', me: 1 })
				try {
					await deps.launcher.launchPlot({
						chartType: row.term.type == 'survival' ? 'survival' : 'summary',
						term: { term: row.term }
					})
				} catch (e) {
					deps.popup.showError(e)
				}
			})
	} else {
		nameTd.style('padding', '5px 10px').style('opacity', 0.5)
	}
	tr.append('td').text(row.ancestors).style('opacity', 0.5).style('font-size', '.7em')
}

/** Render one result row into its <tr>. Switching on `kind` is exhaustive: adding a row kind to ResultRow
 * without a case here is a type error. */
export function renderRow(tr: any, row: ResultRow, deps: RenderDeps) {
	switch (row.kind) {
		case 'heading':
			return renderHeading(tr, row)
		case 'note':
			return renderNote(tr, row)
		case 'coord':
			return renderCoord(tr, row, deps)
		case 'sample':
			return renderSample(tr, row, deps)
		case 'gene':
			return renderGene(tr, row, deps)
		case 'dict':
			return renderDict(tr, row, deps)
		default: {
			const _exhaustive: never = row
			return _exhaustive
		}
	}
}
