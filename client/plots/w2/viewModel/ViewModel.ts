import type { WsiSampleSummary } from '#types'
import type { TableColumn, TableRow } from '#dom'
import type Settings from '../Settings.ts'

export type ViewData = {
	/** sample table skeleton for renderTable() */
	columns: TableColumn[]
	rows: TableRow[]
	/** the sample whose image is shown in the viewer; undefined when none selected */
	selectedSample?: WsiSampleSummary
}

/** Shapes the server data for rendering: one table row per sample that has
 whole-slide images on disk, plus the currently selected sample. */
export class ViewModel {
	viewData: ViewData

	constructor(samples: WsiSampleSummary[], settings: Settings) {
		this.viewData = {
			columns: [{ label: 'Sample' }, { label: 'Images' }], // two-column table
			rows: samples.map(s => [{ value: s.sampleId }, { value: String(s.count) }]), // one row per sample
			selectedSample: samples[settings.selectedSampleIndex] // undefined when index is -1
		}
	}
}
