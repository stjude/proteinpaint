import type { MassAppApi } from '#mass/types/mass'

export class Interactions {
	app: MassAppApi
	dom: any
	id: string
	constructor(app: MassAppApi, dom: any, id: string) {
		this.app = app
		this.dom = dom
		this.id = id
	}

	// using arrow function to bind "this" to the Interactions class
	// otherwise "this" can refer to the Block class
	onCoordinateChange = async rglst => {
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { geneSearchResult: { chr: rglst[0].chr, start: rglst[0].start, stop: rglst[0].stop } }
		})
	}

	// TODO: need to test this
	maySaveTrackUpdatesToState = async (blockInstance, state) => {
		/* following changes will be saved in state:
		- when a mds3 subtk is created/updated, its tk.filterObj should be saved to state so it can be recovered from session
		- a facet track is removed by user via block ui */
		if (!blockInstance) return
		const config = structuredClone(state.config)
		for (const t of blockInstance.tklst) {
			if (t.type == 'mds3' && t.filterObj) {
				if (state.filter) {
					if (JSON.stringify(t.filterObj) == JSON.stringify(state.filter)) {
						// this tk filter is identical as state (mass global filter). this means the tk is the "main" tk and the filter was auto-added via mass global filter.
						// do not add such filter in subMds3TkFilters[], that will cause an issue of auto-creating unwanted subtk on global filter change
						continue
					}
				} else {
					if (!config.subMds3TkFilters) config.subMds3TkFilters = []
					config.subMds3TkFilters.push(t.filterObj)
					// filter0?
				}
			}
		}
		if (config.trackLst?.activeTracks) {
			// active facet tracks are inuse; if user deletes such tracks from block ui, must update state
			const newLst = config.trackLst.activeTracks.filter(n => blockInstance.tklst.find(i => i.name == n))
			config.trackLst.activeTracks = newLst
		}
		await this.app.save({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}
}
