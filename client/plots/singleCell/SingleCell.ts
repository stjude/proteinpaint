import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import type { BasePlotConfig, MassState } from '#mass/types/mass'
import { Model } from './model/Model'
import { sayerror } from '#dom'

class SingleCell extends RxComponentInner {
	readonly type = 'singleCell'
	data: object
	refName?: string

	constructor(opts) {
		super()
		const holder = opts.holder.append('div').classed('sjpp-single-cell-main', true)
		this.dom = {
			holder,
			errorDiv: holder.append('div').attr('data-testid', 'sjpp-single-cell-error'),
			actionsDiv: holder.append('div').attr('data-testid', 'sjpp-single-cell-actions'),
			plotDiv: holder.append('div').attr('data-testid', 'sjpp-single-cell-plot')
		}
		this.data = {}
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel,
			config,
			termfilter: appState.termfilter,
			termdbConfig: appState.termdbConfig
		}
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return
		if (!config.sample) throw new Error('No sample provided for single cell plot')
		try {
			const model = new Model(this.state)
			const result = await model.getData()
			if (result.error) {
				sayerror(this.dom.errorDiv, 'No samples found for this dataset')
			}
			//Not returned and not used????
			// this.refName = result.refName
			this.refName = result.refName || this.state.termdbConfig?.queries?.singleCell?.data?.refName
			this.data = result
		} catch (e: any) {
			if (e instanceof Error) console.error(`${e.message || e} [SingleCell.main()]`)
			else if (e.stack) console.log(e.stack)
			throw `${e} [SingleCell.main()]`
		}
	}
}

export const singleCellInit = getCompInit(SingleCell)
export const componentInit = singleCellInit

export function getDefaultSingleCellSettings(overrides = {}) {
	const defaults = {
		dotSize: 0.04,
		dotOpacity: 0.8,
		height: 600,
		showGrid: true,
		width: 600
	}
	return Object.assign(defaults, overrides)
}

export function getPlotConfig(opts, app) {
	if (!opts.sample) throw new Error('No .sample{} provided for single cell plot [SingleCell.getPlotConfig()]')

	const config = {
		chartType: 'singleCell',
		sample: opts.sample,
		plots: app.vocabApi.termdbConfig?.queries?.singleCell?.data?.plots || [],
		hiddenClusters: {},
		settings: {
			singleCell: getDefaultSingleCellSettings(opts.overrides)
		}
	}

	return copyMerge(config, opts)
}
