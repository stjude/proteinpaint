import type { AppApi } from '#rx'
import type { TableColumn, TableRow } from '#dom'
import type { SCConfig, SCState, SampleColumn } from '../SCTypes'
import type { SingleCellSample } from '#types'

/** TODOs when app resumes development
 *  - ?Implement data mapper for buttons?
 *  - Implement data mapper for plots in the dashboard
 */

export class SCViewModel {
	app: AppApi
	state: SCState
	tableData: { rows: TableRow[]; columns: TableColumn[]; selectedRows: number[] }

	constructor(app: AppApi, config: SCConfig, samples: SingleCellSample[], sampleColumns?: SampleColumn[]) {
		this.app = app
		this.state = this.app.getState()

		//Should only be called once
		const [rows, columns] = this.getTabelData(config, samples, sampleColumns)
		const selectedRows: number[] = []
		const i = samples.findIndex(i => i.sample == config.sample)
		if (i != -1) selectedRows.push(i)

		/** Returning this data separately from the eventual
		 * viewData because it's static. */
		this.tableData = {
			rows: rows as any,
			columns: columns as any,
			selectedRows
		}
	}

	getTabelData(plotConfig: SCConfig, samples: SingleCellSample[], sampleColumns?: SampleColumn[]) {
		const rows: TableRow[] = []
		const hasExperiments = samples.some(i => i.experiments)

		// first column is sample and is hardcoded
		const columns: TableColumn[] = [{ label: plotConfig.settings.sc.columns.sample, sortable: true }]
		if (hasExperiments) columns.push({ label: 'Sample', sortable: true }) //add after the case column

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

		for (const sample of samples) {
			if (hasExperiments)
				//GDC
				for (const exp of sample.experiments!) {
					// first cell is always sample name. sneak in experiment object to be accessed in click callback
					//TODO: Consider removing the experimentID as it is no longer needed.
					const row: { [index: string]: any }[] = [{ value: sample.sample, __experimentID: exp.experimentID }]
					// hardcode to expect exp.sampleName and add this as a column
					row.push({ value: exp.sampleName })
					// optional sample and experiment columns
					for (const col of sampleColumns || []) {
						row.push({ value: sample[col.termid] })
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
				const row: { [index: string]: any }[] = [{ value: sample.sample }]
				// optional sample columns
				for (const col of sampleColumns || []) {
					row.push({ value: sample[col.termid] })
				}
				rows.push(row)
			}
		}
		return [rows, columns]
	}
}
