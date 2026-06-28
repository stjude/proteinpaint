import type { MassAppApi } from '#mass/types/mass'
import { getNormalRoot } from '#filter'
import { sanitizeTrackLstConfig } from '../trackLst.ts'

export class Interactions {
	app: MassAppApi
	dom: any
	id: string
	facetTrackNames = new Set<string>()
	constructor(app: MassAppApi, dom: any, id: string) {
		this.app = app
		this.dom = dom
		this.id = id
	}

	setFacetTrackNames(names: Set<string>) {
		this.facetTrackNames = names
	}

	onCoordinateChange = (rglst, blockInstance?) => {
		if (!rglst?.length) return
		const config: any = {
			geneSearchResult: { chr: rglst[0].chr, start: rglst[0].start, stop: rglst[0].stop }
		}
		const block = getBlockState(blockInstance, rglst)
		if (block) config.block = block
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}

	onGeneSearch = (result, blockIsProteinMode) => {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: {
				geneSearchResult: result,
				blockIsProteinMode,
				block: { rglst: [] }
			}
		})
	}

	// copied from "GB.ts", should try to inherit it instead
	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			filter: getNormalRoot(appState.termfilter.filter),
			vocab: appState.vocab
		}
	}

	maySaveTrackUpdatesToState = blockInstance => {
		/* following changes will be saved in state:
		- when a mds3 subtk is created/updated, its tk.filterObj should be saved to state so it can be recovered from session
		- a facet track is removed by user via block ui */
		if (!blockInstance) return
		// since maySaveTrackUpdatesToState() is used as callback in block.js,
		// this.state.config will become stale; therefore need to regenerate
		// live plot state
		const state = this.getState(this.app.getState())
		const config = structuredClone(state.config)
		sanitizeTrackLstConfig(config)
		config.subMds3Tks = []
		for (const t of blockInstance.tklst) {
			if (t.type == 'mds3' && t.filterObj) {
				const mclassHiddenValues = t.legend?.mclass?.hiddenvalues
				if (!t.subtk) {
					// "main" track
					if (mclassHiddenValues) {
						// track has hidden mclass values, store in config root
						config.mclassHiddenValues = [...mclassHiddenValues]
					}
					// do not add this track to subMds3Tks[], as it would cause an issue of auto-creating unwanted subtk on global filter change
					continue
				} else {
					// sub track
					const subtk: any = { filterObj: t.filterObj }
					if (mclassHiddenValues) {
						// track has hidden mclass values, store in subtk obj
						subtk.mclassHiddenValues = [...mclassHiddenValues]
					}
					config.subMds3Tks.push(subtk)
					// filter0?
				}
			}
		}
		let facetActiveTracksChanged = false
		if (config.trackLst?.activeTracks && this.facetTrackNames.size) {
			// active facet tracks are inuse; if user deletes such tracks from block ui, remove from activeTracks
			const newLst = config.trackLst.activeTracks.filter(n => blockInstance.tklst.find(i => i.name == n))
			// if user re-adds a facet track from block ui (e.g. block.tk.menu), add it back to activeTracks
			for (const t of blockInstance.tklst) {
				if (t.name && this.facetTrackNames.has(t.name) && !newLst.includes(t.name)) {
					newLst.push(t.name)
				}
			}
			if (
				newLst.length != config.trackLst.activeTracks.length ||
				newLst.some(n => !config.trackLst.activeTracks.includes(n))
			) {
				facetActiveTracksChanged = true
			}
			config.trackLst.activeTracks = newLst
		}
		if (facetActiveTracksChanged) {
			// a facet track was added or removed via block ui (e.g. block.tk.menu);
			// must dispatch so the facet table ui re-renders to reflect the change
			this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config
			})
		} else {
			this.app.save({
				type: 'plot_edit',
				id: this.id,
				config
			})
		}
	}

	launchFacet = config => {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}

	launchVariantTrack = toDisplay => {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { snvindel: { shown: toDisplay } }
		})
	}

	launchLdTrack = tracks => {
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

export function getBlockState(blockInstance, rglst) {
	const blockRglst = cloneRglst(blockInstance?.rglst || rglst)
	if (!blockRglst?.length) return null
	const block: any = { rglst: blockRglst }
	for (const key of ['startidx', 'stopidx', 'regionspace', 'gmmode']) {
		const value = blockInstance?.[key]
		if (value !== undefined) block[key] = value
	}
	if (blockInstance?.coord?.reverse !== undefined) block.coordReverse = blockInstance.coord.reverse
	return block
}

function cloneRglst(rglst) {
	if (!Array.isArray(rglst)) return null
	return rglst.map(r => {
		const r2: any = {
			chr: r.chr,
			start: r.start,
			stop: r.stop
		}
		for (const key of ['bstart', 'bstop', 'width', 'reverse', 'name']) {
			if (r[key] !== undefined) r2[key] = r[key]
		}
		return r2
	})
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
