import { RxComponentInner } from '../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import { renderTable, sayerror } from '#dom'
import type { TableColumn, TableRow } from '#dom'
import { dofetch3 } from '#common/dofetch'
import type { BasePlotConfig, MassState } from '#mass/types/mass'

class SCSampleTable extends RxComponentInner {
	readonly type = 'scSampleTable'
	samples: any

	constructor(opts) {
		super()
		const errorDiv = opts.holder.append('div').attr('data-testid', 'sjpp-sc-sample-table-error')
		const holder = opts.holder.append('div').classed('sjpp-sc-sample-table-main', true)
		this.dom = {
			errorDiv,
			holder
		}
		this.samples = []
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			dslabel: appState.vocab.dslabel,
			genome: appState.vocab.genome,
			termfilter: appState.termfilter,
			termdbConfig: appState.termdbConfig,
			vocab: appState.vocab
		}
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return
		try {
			const body = {
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				filter0: this.state.termfilter.filter0 || null
			}
			const result = await dofetch3('termdb/singlecellSamples', { body })
			if (result.error || !result.samples || !result.samples.length) {
				sayerror(this.dom.errorDiv, 'No samples found for this dataset')
			}
			this.samples = result.samples
		} catch (e: any) {
			if (e instanceof Error) console.error(`${e.message || e} [scSampleTable main()]`)
			else if (e.stack) console.log(e.stack)
			throw `${e} [scSampleTable main()]`
		}

		const [rows, columns] = await this.getTabelData(this.state)
		this.renderSamplesTable(rows, columns as any) //tsc incorrectly inferring row, not column, type
	}

	async getTabelData(state: any) {
		const dsSamples = state.termdbConfig.queries?.singleCell?.samples || {}
		const rows: TableRow[] = []
		const hasExperiments = this.samples.some(i => i.experiments)
		// first column is sample and is hardcoded
		const columns: TableColumn[] = [{ label: state.config.settings.scSampleTable.columns.sample, sortable: true }]
		if (hasExperiments) columns.push({ label: 'Sample', sortable: true }) //add after the case column

		// add in optional sample columns
		for (const col of dsSamples.sampleColumns || []) {
			columns.push({
				label: (await this.app.vocabApi.getterm(col.termid)).name,
				width: '14vw',
				sortable: true
			})
		}

		// if samples are using experiments, add the hardcoded experiment column at the end
		if (hasExperiments) columns.push({ label: 'Experiment', sortable: true }) // corresponds to this.samples[].experiments[].experimentID

		for (const sample of this.samples) {
			if (hasExperiments)
				//GDC
				for (const exp of sample.experiments) {
					// first cell is always sample name. sneak in experiment object to be accessed in click callback
					const row: { [index: string]: any }[] = [{ value: sample.sample, __experimentID: exp.experimentID }]
					// hardcode to expect exp.sampleName and add this as a column
					row.push({ value: exp.sampleName })
					// optional sample and experiment columns
					for (const c of dsSamples.sampleColumns || []) {
						row.push({ value: sample[c.termid] })
					}

					// hardcode to always add in experiment id column
					row.push({ value: exp.experimentID })
					rows.push(row)
				}
			else {
				// sample does not use experiment
				// first cell is sample name
				const row: { [index: string]: any }[] = [{ value: sample.sample }]
				// optional sample columns
				for (const c of dsSamples.sampleColumns || []) {
					row.push({ value: sample[c.termid] })
				}
				rows.push(row)
			}
		}
		return [rows, columns]
	}

	renderSamplesTable(rows, columns: TableColumn[]) {
		const selectedRows: number[] = []
		const i = this.samples.findIndex(i => i.sample == this.state.config.sample)
		if (i != -1) selectedRows.push(i)

		renderTable({
			rows,
			columns,
			div: this.dom.holder,
			singleMode: true,
			maxWidth: columns.length > 3 ? '98vw' : '40vw',
			maxHeight: '50vh',
			header: {
				allowSort: true,
				style: { 'text-transform': 'capitalize' }
			},
			striped: true,
			selectedRows
		})
	}
}

export const scSampleTableInit = getCompInit(SCSampleTable)
export const componentInit = scSampleTableInit

export function getDefaultSCSampleTableSettings(overrides = {}) {
	const defaults = {
		columns: {
			sample: 'Sample'
		}
	}
	return Object.assign(defaults, overrides)
}

export function getPlotConfig(opts) {
	const config = {
		settings: {
			scSampleTable: getDefaultSCSampleTableSettings(opts.overrides)
		}
	}
	return copyMerge(config, opts)
}
