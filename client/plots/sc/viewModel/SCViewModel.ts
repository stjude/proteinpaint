import type { AppApi } from '#rx'
import type { TableColumn, TableRow } from '#dom'
import type { SCActiveSubplot, SCConfig, SCFormattedState, SampleColumn, SCTableData } from '../SCTypes'
import type { SingleCellSample } from '#types'

export class SCViewModel {
	app: AppApi
	state: SCFormattedState
	tableData!: SCTableData
	sampleColumns: SampleColumn[]

	constructor(app: AppApi, sampleColumns?: SampleColumn[]) {
		this.app = app
		this.state = this.app.getState()
		this.sampleColumns = sampleColumns || []
	}

	processData(config: SCConfig, _items: SingleCellSample[], activeSubplots: SCActiveSubplot[] = []) {
		//Sort meta analysis results to show at the beginning of the table.
		//Prevents breaking the logic for selected rows after formating the table data.
		const items = _items.sort((a, b) => (b.isMetaResult === a.isMetaResult ? 0 : b.isMetaResult ? 1 : -1))

		const [rows, columns, sampleColIdx] = this.getTabelData(config, items, this.sampleColumns, activeSubplots)
		const selectedRows: number[] = []
		const sID = config.settings.sc.item?.sID
		const i = sID
			? items.findIndex(item => item.sample === sID || item.experiments?.some(e => e.sampleName === sID))
			: -1
		if (i != -1) selectedRows.push(i)

		/** Returning this data separately from the eventual
		 * viewData because it's static. */
		this.tableData = {
			rows: rows as any,
			columns: columns as any,
			selectedRows,
			sampleColIdx,
			activeSubplots
		}
	}

	getTabelData(
		plotConfig: SCConfig,
		items: SingleCellSample[],
		sampleColumns?: SampleColumn[],
		_activeSubplots: SCActiveSubplot[] = []
	): [TableRow[], TableColumn[], number] {
		const rows: TableRow[] = []
		const hasExperiments = items.some(i => i.experiments)
		let sampleColIdx = -1

		// first column is sample and is hardcoded
		const columns: TableColumn[] = [{ label: plotConfig.settings.sc.columns.sample, sortable: true }]
		if (hasExperiments) {
			columns.push({ label: 'Sample', sortable: true }) //add after the case column
			sampleColIdx = 1
		} else sampleColIdx = 0
		columns.push({ label: 'Shown plots' }) //Empty column for plot buttons

		// add in optional sample columns
		for (const col of sampleColumns || []) {
			columns.push({
				label: col.label,
				width: '14vw',
				sortable: true
			})
		}

		// if samples are using experiments, add the hardcoded experiment column at the end
		if (hasExperiments) columns.push({ label: 'Experiment', sortable: true }) // corresponds to this.samples[].experiments[].experimentID

		for (const item of items) {
			if (hasExperiments)
				//GDC
				for (const exp of item.experiments!) {
					// first cell is always sample name. sneak in experiment object to be accessed in click callback
					//TODO: Consider removing the experimentID as it is no longer needed.
					const row: { [index: string]: any }[] = [{ value: item.sample, __experimentID: exp.experimentID }]
					// hardcode to expect exp.sampleName and add this as a column
					row.push({ value: exp.sampleName })
					row.push({ value: '' }) //Empty cell for shown plot buttons
					// optional sample and experiment columns
					for (const col of sampleColumns || []) {
						row.push({ value: item[col.termid] })
					}

					// hardcode to always add in experiment id column
					if (this.state.vocab.dslabel == 'GDC')
						row.push({ value: exp.experimentID, url: `https://portal.gdc.cancer.gov/files/${exp.experimentID}` })
					else row.push({ value: exp.experimentID })
					rows.push(row)
				}
			else {
				// sample does not use experiment
				// first cell is sample name
				const row: { [index: string]: any }[] = item.isMetaResult
					? [{ html: item.sample.replace(/_/g, ' '), value: item.sample }]
					: [{ value: item.sample }]
				//Empty cell for shown plot buttons
				row.push({ value: '' })
				// optional sample columns
				for (const col of sampleColumns || []) {
					const value = item[col.termid]
					if (value == null && item.isMetaResult) row.push({ value: 'All' })
					else row.push({ value: item[col.termid] })
				}
				rows.push(row)
			}
		}
		return [rows, columns, sampleColIdx]
	}
}
