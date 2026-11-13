import type { OmnisearchResult } from '#types'
import { addActionButton } from '../buttons.ts'
import type { HandlerDeps, OmnisearchHandler, SearchInput } from '../types.ts'

/** Sample actions, in display order. An action appears only when the server confirmed it applies to this
 * particular sample. `config` is the plot config to launch (may be async to load code lazily). */
export const SAMPLE_ACTIONS: {
	label: string
	testid: (row: SampleRow) => string
	available: (row: SampleRow) => boolean
	config: (row: SampleRow) => any | Promise<any>
}[] = [
	{
		label: 'Sample View',
		testid: row => `sjpp-mass-search-sample-view-${row.sampleId}`,
		available: () => true,
		// config.sample (singular): the same single-sample shape the scatter click handler dispatches
		config: row => ({ chartType: 'sampleView', sample: { sampleId: row.sampleId, sampleName: row.name } })
	},
	{
		label: 'Single cell',
		testid: row => `sjpp-mass-search-single-cell-${row.sampleId}`,
		available: row => Boolean(row.singleCell),
		config: row => ({ chartType: 'sc', settings: { sc: { item: row.singleCell } } })
	},
	{
		label: 'Whole Slide Images',
		testid: row => `sjpp-mass-search-wsimages-${row.sampleId}`,
		available: row => Boolean(row.wsimages),
		// whole-slide viewer in fixed-sample mode, restricted to plain slides
		config: row => ({ chartType: 'wsi', sample: { sID: row.name }, imageType: 'wsi' })
	},
	{
		label: 'Facet Table',
		testid: row => `sjpp-mass-search-assays-${row.sampleId}`,
		available: row => Boolean(row.facetTracks?.length),
		config: async row => {
			const { getSampleFilter } = await import('../../groups.js')
			return { chartType: 'genomeBrowser', hidePlotFilter: true, filter: getSampleFilter(row.sampleId) }
		}
	}
]

/* Result kind: samples, matched by name. Searched only when the user presses Enter (the server scans every sample 
name), and only for datasets that display sample ids. The server also enforces access.*/

export class SearchResultHandler implements OmnisearchHandler<SampleRow> {
	readonly key = 'samples' as const
	readonly heading = 'Samples'
	readonly noun = 'sample'
	readonly label = 'Samples'
	readonly hint = 'press Enter to search'

	init() {}

	/** Only on Enter: the server scans every sample name, so this is never searched while typing. */
	includeInSearch({ enter }: SearchInput) {
		return enter
	}

	/** The server only sends samples when the dataset allows displaying sample ids, so no permission check is
	 * repeated here: an empty list means no match or a dataset that does not permit it. */
	buildRows(data: OmnisearchResult): SampleRow[] {
		return (Array.isArray(data.samples) ? data.samples : [])
			.filter(s => s?.name)
			.map(s => ({
				name: s.name,
				sampleId: s.id,
				singleCell: s.singleCell,
				facetTracks: s.assays,
				wsimages: s.wsimages
			}))
	}

	renderRow(tr: any, row: SampleRow, deps: HandlerDeps) {
		tr.append('td').text(row.name).style('padding', '5px 10px')
		const actionsTd = tr.append('td')
		for (const action of SAMPLE_ACTIONS) {
			if (!action.available(row)) continue
			addActionButton(actionsTd, deps, {
				label: action.label,
				testid: action.testid(row),
				onClick: async () => deps.launcher.launchPlot(await action.config(row))
			})
		}
	}
}

/** Whether this dataset has samples to search: only datasets that display sample ids. */
export function includeResult(termdbConfig: any): boolean {
	return Boolean(termdbConfig?.displaySampleIds)
}

/**********************
        TYPES
 **********************/

export type SampleRow = {
	name: string
	sampleId: number | string
	/** present only when the server confirmed this sample has single-cell data */
	singleCell?: { sID: string; eID?: string }
	/** present only when the sample has facet-table assays */
	facetTracks?: { facet: string; names: string[] }[]
	/** true only when the sample has plain whole-slide images */
	wsimages?: boolean
}
