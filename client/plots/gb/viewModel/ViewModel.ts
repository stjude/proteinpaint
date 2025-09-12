import { filterJoin } from '#filter'

export class ViewModel {
	state: any
	app: any
	opts: any
	data: any
	blockInstance: any
	components: any
	maySaveTrackUpdatesToState: any
	constructor(state, app, opts, data) {
		this.state = state
		this.app = app
		this.opts = opts
		this.data = data
	}

	async generateTracks() {
		// handle multiple possibilities of generating genome browser tracks

		const tklst: any = [] // list of tracks to be shown in block

		if (this.state.config.snvindel?.shown) {
			// show snvindel-based mds3 tk
			if (this.data) {
				// variant data has been precomputed
				// launch custom mds3 tk to show the variants
				// TODO move computing logic to official mds3 tk and avoid tricky workaround using custom tk
				const tk = await this.launchCustomMds3tk(this.data)
				if (tk) {
					// tricky! will not return obj when block is already shown, since it updates data for existing tk obj
					tklst.push(tk)
				}
			} else {
				// official mds3 tk without precomputed tk data
				const tk = {
					type: 'mds3',
					dslabel: this.app.opts.state.vocab.dslabel,
					onClose: () => {
						// on closing subtk, the filterObj corresponding to the subtk will be "removed" from subMds3TkFilters[], by regenerating the array
						this.maySaveTrackUpdatesToState()
					},
					// for showing disco etc as ad-hoc sandbox, persistently in the mass plotDiv, rather than a menu
					newChartHolder: this.opts.plotDiv
				}
				// any cohort filter for this tk
				{
					//const lst = []
					// register both global filter and local filter to pass to mds3 data queries
					/** FIXME: address tsc issues here:
					if (this.state.filter?.lst?.length) lst.push(this.state.filter)
					if (this.state.config.snvindel.filter) lst.push(this.state.config.snvindel.filter)
					if (lst.length == 1) {
						tk.filterObj = structuredClone(lst[0])
					} else if (lst.length > 1) {
						tk.filterObj = filterJoin(lst)
					} **/
					// TODO this will cause mds3 tk to show a leftlabel to indicate the filtering, which should be hidden
				}
				tklst.push(tk)

				if (this.state.config?.subMds3TkFilters) {
					for (const subFilter of this.state.config.subMds3TkFilters) {
						// for every element, create a new subtk
						const t2: any = {
							type: 'mds3',
							dslabel: this.app.opts.state.vocab.dslabel,
							// for showing disco etc as ad-hoc sandbox, persistently in the mass plotDiv, rather than a menu
							newChartHolder: this.opts.plotDiv
						}
						if (this.state.filter?.lst?.length) {
							// join sub filter with global
							t2.filterObj = filterJoin([this.state.filter, subFilter])
						} else {
							// no global. only sub
							t2.filterObj = structuredClone(subFilter)
						}
						tklst.push(t2)
					}
				}
			}
		}
		if (this.state.config?.trackLst?.activeTracks?.length) {
			// include active facet tracks
			for (const n of this.state.config.trackLst.activeTracks) {
				for (const f of this.state.config.trackLst.facets) {
					for (const t of f.tracks) {
						if (t.name == n) tklst.push(t)
					}
				}
			}
		}
		if (this.state.config.ld?.tracks) {
			for (const t of this.state.config.ld.tracks) {
				if (t.shown) tklst.push(t)
			}
		}
		return tklst
	}

	async launchCustomMds3tk(data) {
		//this.mayDisplaySampleCountInControls(data) // TODO: move to View

		if (this.blockInstance) {
			// block already launched. update data on the tk and rerender
			const t2 = this.blockInstance.tklst.find(i => i.type == 'mds3')
			t2.custom_variants = data.mlst

			// details.groups[] may have changed. update label and tooltip callback etc, of tk numeric axis view mode object
			furbishViewModeWithSnvindelComputeDetails(
				this,
				t2.skewer.viewModes.find(i => i.type == 'numeric')
			)

			t2.load()
			return
		}

		const nm = {
			// numeric mode object; to fill in based on snvindel.details{}
			type: 'numeric',
			inuse: true,
			byAttribute: 'nm_axis_value'
		}
		furbishViewModeWithSnvindelComputeDetails(this, nm)
		const tk = {
			type: 'mds3',
			// despite having custom data, still provide dslabel for the mds3 tk to function as an official dataset
			dslabel: this.app.opts.state.vocab.dslabel,
			name: 'Variants',
			custom_variants: data.mlst,
			skewerModes: [nm]
		}
		return tk
	}

	mayDisplaySampleCountInControls(data) {
		/* quick fix
		group sample count returned by server is not part of state and is not accessible to controls component
		has to synthesize a "current" object with the _partialData special attribute
		and pass it to api.update() for component instance to receive it via getState()
		*/
		if (Number.isInteger(data.totalSampleCount_group1) || Number.isInteger(data.totalSampleCount_group2)) {
			const current = {
				appState: {
					plots: [
						{
							id: this.components.gbControls.id,
							_partialData: {
								groupSampleCounts: [data.totalSampleCount_group1, data.totalSampleCount_group2],
								pop2average: data.pop2average
							}
						}
					]
				}
			}
			this.components.gbControls.update(current)
		}
	}
}

/* given group configuration, determine: numeric track axis label
- viewmode.label as axis label of numeric mode
- viewmode.tooltipPrintValue()
*/
function furbishViewModeWithSnvindelComputeDetails(self, viewmode) {
	delete viewmode.tooltipPrintValue

	const [g1, g2] = self.state.config.snvindel.details.groups
	if (g1 && g2) {
		if (g1.type == 'info' || g2.type == 'info') {
			// either group is info field. value type can only be value difference
			viewmode.label = 'Value difference'
			return
		}
		// none of the group is info field. each group should derive AF and there can be different ways of comparing it from two groups
		const testMethod =
			self.state.config.snvindel.details.groupTestMethods[self.state.config.snvindel.details.groupTestMethodsIdx]
		viewmode.label = testMethod.axisLabel || testMethod.name
		if (testMethod.name == 'Allele frequency difference') {
			// callback returns value separated by ' = ', which allows this to be also displayed in itemtable.js
			viewmode.tooltipPrintValue = m => [{ k: 'AF diff', v: m.nm_axis_value }]
		} else if (testMethod.name == "Fisher's exact test") {
			viewmode.tooltipPrintValue = m => [{ k: 'p-value', v: m.p_value }]
		}
		return
	}

	// only 1 group
	if (g1.type == 'info') {
		const f = self.state.config.variantFilter?.terms?.find(i => i.id == g1.infoKey)
		viewmode.label = f?.name || g1.infoKey
		viewmode.tooltipPrintValue = m => [{ k: viewmode.label, v: m.info[g1.infoKey] }]
		return
	}
	if (g1.type == 'filter') {
		viewmode.label = 'Allele frequency'
		viewmode.tooltipPrintValue = m => [{ k: 'Allele frequency', v: m.nm_axis_value }]
		return
	}
	if (g1.type == 'population') {
		viewmode.label = 'Allele frequency'
		viewmode.tooltipPrintValue = m => [{ k: 'Allele frequency', v: m.nm_axis_value }]
		return
	}
	throw 'unknown type of the only group'
}
