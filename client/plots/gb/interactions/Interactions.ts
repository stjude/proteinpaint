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

	clickFacetCell(event, tklst, state) {
		this.dom.tip.clear().showunder(event.target)
		const table = this.dom.tip.d.append('table').style('margin', '5px 5px 5px 2px')
		for (const tk of tklst) {
			const tr = table.append('tr')
			const td1 = tr
				.append('td')
				.style('font-size', '.8em')
				.text(state.config.trackLst.activeTracks.includes(tk.name) ? 'SHOWN' : '')
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text(tk.name)
				.on('click', () => {
					let newActiveTracks, newRemoveTracks // default undefined to not remove any track
					if (state.config.trackLst.activeTracks.includes(tk.name)) {
						td1.text('')
						newActiveTracks = state.config.trackLst.activeTracks.filter(n => n != tk.name)
						newRemoveTracks = [tk.name]
					} else {
						td1.text('SHOWN')
						newActiveTracks = structuredClone(state.config.trackLst.activeTracks)
						newActiveTracks.push(tk.name)
					}
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: {
							trackLst: {
								activeTracks: newActiveTracks,
								removeTracks: newRemoveTracks
							}
						}
					})
				})
		}
	}

	launchVariantTrack = toDisplay => {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { snvindel: { shown: toDisplay } }
		})
	}

	launchLdTrack = (tracks, i, toDisplay) => {
		tracks[i].shown = toDisplay
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { ld: { tracks } }
		})
	}

	launchGroupsFilter = groups => {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { snvindel: { details: { groups } } }
		})
	}

	launchSnvIndelDetails = details => {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { snvindel: { details } }
		})
	}

	launchVariantFilter = filter => {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { variantFilter: { filter } }
		})
	}
}

export function mayUpdateGroupTestMethodsIdx(state, d) {
	if (d.groups.length != 2) return // not two groups, no need to update test method
	// depending on types of two groups, may need to update test method
	const [g1, g2] = d.groups
	if (g1.type == 'info' || g2.type == 'info' || (g1.type == 'population' && g2.type == 'population')) {
		// if any group is INFO, or both are population, can only allow value difference and not fisher test
		const i = state.config.snvindel.details.groupTestMethods.findIndex(i => i.name == 'Allele frequency difference')
		if (i == -1) throw 'Allele frequency difference not found'
		d.groupTestMethodsIdx = i
	} else {
		// otherwise, do not change existing method idx
	}
}
