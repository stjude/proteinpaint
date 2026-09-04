import type { AppApi } from '#rx'
import type { SCFormattedState } from '../SCTypes'
import { dofetch3 } from '#common/dofetch'
import type { SCViewer } from '../SC'
import { getNormalRoot } from '#filter/filter.utils'

/** Fetches data for sc app */
export class SCModel {
	sc: SCViewer
	app: AppApi
	id?: string
	state: SCFormattedState

	constructor(sc: SCViewer) {
		this.sc = sc
		this.app = sc.app
		this.id = sc.id
		this.state = sc.app.getState()
	}

	/********** All Single Cell SAMPLES for rendering the sample table ******** */
	async getAllSampleData(state) {
		const body = {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			filter: getNormalRoot(state.termfilter.filter),
			filter0: state.termfilter.filter0
		}
		return await dofetch3('termdb/singlecellSamples', { body, signal: this.sc.api?.getAbortSignal() })
	}

	//Fetches optional name for ds defined columns
	async getColumnLabels(dsScSamples: { [key: string]: any }) {
		if (!dsScSamples || !dsScSamples.sampleColumns) return
		const colsCopy = structuredClone(dsScSamples.sampleColumns)
		for (const col of colsCopy) {
			let label = col.termid
			try {
				label = (await this.app.vocabApi.getterm(col.termid)).name
			} catch (e: any) {
				if (e.message) {
					//Ignore. if statement to prevent tsc error.
				}
				/** Ignore errors and use the termid as the column header.
				 * this is due to practical constrain that gdc needs to supply
				 * analysis.workflow_type as 'Library', but this is not a term
				 * in gdc dictionary */
			}
			col.label = label
		}
		return colsCopy
	}

	/********** Single Cell DATA for rendering plots ********
	 * This is for the plot buttons. Returns an array plots with found files or
	 * available data. */
	async getSampleData() {
		const body = this.getDataRequestOpts()
		if (!body) return
		return await dofetch3('termdb/singlecellData', { body, signal: this.sc.api?.getAbortSignal() })
	}

	/** May provide active plots to the request and return plot data when
	 * checkPlotAvailability is false. When checkPlotAvailability is true,
	 * only returns which plots are available but not the actual data. */
	getDataRequestOpts(_plots: any[] = [], checkPlotAvailability = true) {
		const state = this.app.getState()
		const singleCellTermdbConfig = state.termdbConfig?.queries?.singleCell
		if (!singleCellTermdbConfig?.data) throw new Error('No singleCell.data defined in termdbConfig.queries')

		const config = state.plots.find((p: any) => p.id === this.id)
		if (!config.settings.sc.item) return

		const plots = _plots?.length ? _plots : singleCellTermdbConfig.data.plots.map(p => p.name)

		return {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			// if true, only return available plot names, but not actual plot data
			checkPlotAvailability,
			plots,
			sample: {
				eID: config.settings.sc.item.eID,
				sID: config.settings.sc.item.sID
			}
		}
	}

	/** whether a sample has a spatial image (with the consolidated h5ad the
	 spatial subplot needs), keyed by sID. Successful probes are cached;
	 failures return false for the current render and may be retried. */
	sampleHasSpatial: { [sID: string]: boolean } = {}
	async hasSpatialImage(sID: string): Promise<boolean> {
		if (!(sID in this.sampleHasSpatial)) {
			// only probe datasets that can have spatial images: supportedChartTypes
			// advertises 'wsi' (per cohort) when ds.queries.w2 exists; without it
			// the wsiBySample route can only 500, so skip the request entirely
			const supported = this.state.termdbConfig?.supportedChartTypes || {}
			if (!Object.values(supported).some((types: any) => types?.includes?.('wsi'))) return false
			let r: any
			try {
				r = await dofetch3('termdb/wsiBySample', {
					// imageType: only the spatial root is enumerated for the probe
					body: {
						genome: this.state.vocab.genome,
						dslabel: this.state.vocab.dslabel,
						sample_id: sID,
						imageType: 'spatial'
					},
					signal: this.sc.api?.getAbortSignal()
				})
			} catch (e: any) {
				// a superseding dispatch aborts in-flight requests: rethrow so
				// rx's stale-render handling stops this render, instead of it
				// continuing with a made-up false
				if (this.app.vocabApi?.isAbortError?.(e)) throw e
				return false // network failure: false for this render, retried next
			}
			// dofetch3 resolves server error payloads without rejecting: treat
			// them like a thrown failure — false now, uncached so a later
			// render can retry — never as proof the sample has no image
			if (r?.error) return false
			this.sampleHasSpatial[sID] = !!(r?.images || []).some((i: any) => i.type == 'spatial' && i.spatialData)
		}
		return this.sampleHasSpatial[sID]
	}

	/** Essentially for the GDC. Maybe applied to other ds in the future. */
	async getCategories(_plots: any[]): Promise<string[] | undefined> {
		const body = this.getDataRequestOpts(_plots, false)
		if (!body) return

		let res
		try {
			res = await dofetch3('termdb/singlecellData', { body, signal: this.sc.api?.getAbortSignal() })
		} catch (e: any) {
			if (e instanceof Error) console.error(`${e.message || e}`)
		}

		return this.formatCategories(res)
	}

	formatCategories(res: any): string[] {
		const plot = structuredClone(res.plots[0])

		plot.cells = [...plot.noExpCells, ...plot.expCells]
		const clusters: Set<string> = new Set(plot.cells.map(c => c.category))

		/** Clean up list into an descending array */
		const sortedClusters: string[] = Array.from(clusters).sort((a: any, b: any) => {
			const num1 = parseInt(a.split(' ')[1])
			const num2 = parseInt(b.split(' ')[1])
			return num1 - num2
		})
		return sortedClusters
	}
}
