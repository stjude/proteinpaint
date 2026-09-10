import type { WsiSampleSummary } from '#types' // per-sample listing from wsiBySample
import type { TableColumn, TableRow } from '#dom' // renderTable's row/column shapes
import type Settings from '../Settings.ts' // plot settings (selected sample index)

/** what View.render() consumes */
export type ViewData = {
	/** sample table skeleton for renderTable() */
	columns: TableColumn[]
	/** one row per sample with images */
	rows: TableRow[]
	/** the sample whose image is shown in the viewer; undefined when none selected */
	selectedSample?: WsiSampleSummary
}

/** Shapes the server data for rendering: one table row per sample that has
 whole-slide images on disk, plus the currently selected sample. */
export class ViewModel {
	viewData: ViewData // built once in the constructor, read by View

	constructor(samples: WsiSampleSummary[], settings: Settings) {
		// table skeleton + current selection, derived from server data and settings
		this.viewData = {
			columns: [{ label: 'Sample' }, { label: 'Images' }], // two-column table
			rows: samples.map(s => [{ value: s.sampleId }, { value: String(s.count) }]), // one row per sample
			selectedSample: samples[settings.selectedSampleIndex] // undefined when index is -1
		}
	}
}
