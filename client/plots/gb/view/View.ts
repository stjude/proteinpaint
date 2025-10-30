import { first_genetrack_tolist } from '#common/1stGenetk'
import { filterJoin } from '#filter'

export class View {
	state: any
	data: any
	dom: any
	opts: any
	interactions: any
	blockInstance: any
	constructor(state, data, dom, opts, interactions) {
		this.state = state
		this.data = data
		this.dom = dom
		this.opts = opts
		this.interactions = interactions
	}

	async main() {
		const tklst = await this.generateTracks()
		await this.launchBlockWithTracks(tklst)
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
				const tk: any = {
					type: 'mds3',
					dslabel: this.state.vocab.dslabel,
					onClose: () => {
						// on closing subtk, the filterObj corresponding to the subtk will be "removed" from subMds3Tks[], by regenerating the array
						this.maySaveTrackUpdatesToState()
					},
					callbackOnRender: () => {
						// will allow legend filtering changes to be saved to state
						this.maySaveTrackUpdatesToState()
					},
					// for showing disco etc as ad-hoc sandbox, persistently in the mass plotDiv, rather than a menu
					newChartHolder: this.opts.plotDiv
				}
				// any cohort filter for this tk
				{
					const lst: any = []
					// register both global filter and local filter to pass to mds3 data queries
					if (this.state.filter?.lst?.length) lst.push(this.state.filter)
					if (this.state.config.snvindel.filter) lst.push(this.state.config.snvindel.filter)
					if (lst.length == 1) {
						tk.filterObj = structuredClone(lst[0])
					} else if (lst.length > 1) {
						tk.filterObj = filterJoin(lst)
					}
					// TODO this will cause mds3 tk to show a leftlabel to indicate the filtering, which should be hidden
				}
				if (this.state.config.mclassHiddenValues) {
					tk.legend = { mclass: { hiddenvalues: new Set(this.state.config.mclassHiddenValues) } }
				}
				tklst.push(tk)

				if (this.state.config?.subMds3Tks) {
					for (const subtk of this.state.config.subMds3Tks) {
						// for every element, create a new subtk
						const t2: any = {
							type: 'mds3',
							subtk: true,
							dslabel: this.state.vocab.dslabel,
							onClose: () => {
								// on closing subtk, the filterObj corresponding to the subtk will be "removed" from subMds3Tks[], by regenerating the array
								this.maySaveTrackUpdatesToState()
							},
							callbackOnRender: async () => {
								// will allow legend filtering changes to be saved to state
								this.maySaveTrackUpdatesToState()
							},
							// for showing disco etc as ad-hoc sandbox, persistently in the mass plotDiv, rather than a menu
							newChartHolder: this.opts.plotDiv
						}
						if (this.state.filter?.lst?.length) {
							// join sub filter with global
							t2.filterObj = filterJoin([this.state.filter, subtk.filterObj])
						} else {
							// no global. only sub
							t2.filterObj = structuredClone(subtk.filterObj)
						}
						if (subtk.mclassHiddenValues) {
							t2.legend = { mclass: { hiddenvalues: new Set(subtk.mclassHiddenValues) } }
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
		this.mayGetSampleCounts(data)

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
			dslabel: this.state.vocab.dslabel,
			name: 'Variants',
			custom_variants: data.mlst,
			skewerModes: [nm]
		}
		return tk
	}

	mayGetSampleCounts(data) {
		this.mayRenderSampleCount('group1', data.totalSampleCount_group1)
		this.mayRenderSampleCount('group2', data.totalSampleCount_group2)
		this.mayRenderPop2Avg(data.pop2average)
	}

	mayRenderSampleCount(group, count) {
		if (!Number.isInteger(count)) return
		this.dom.tabsDiv
			.select(`.sjpp-gb-${group}`)
			.select('.sjpp-gb-filter-count')
			.style('display', 'inline')
			.text('n=' + count)
	}

	mayRenderPop2Avg(pop2average) {
		if (!pop2average) return
		const div = this.dom.tabsDiv.select('#sjpp-gb-pop2avg')
		console.log('div:', div)
		const lst: any = []
		for (const k in pop2average) {
			const value = pop2average[k]
			if (!Number.isFinite(value)) continue // if there are no samples involved in current view, admix value is null
			lst.push(`${k}=${value.toFixed(2)}`)
		}
		if (lst.length) {
			// has valid admix values to display
			div.style('display', 'inline')
			const txt = div.text()
			div.text(`${txt}: ${lst.join(', ')}`)
		} else {
			div.style('display', 'none')
		}
	}

	maySaveTrackUpdatesToState = () => {
		/* following changes will be saved in state:
		- when a mds3 subtk is created/updated, its tk.filterObj should be saved to state so it can be recovered from session
		- a facet track is removed by user via block ui */
		if (!this.blockInstance) return
		const config = structuredClone(this.state.config)
		config.subMds3Tks = []
		for (const t of this.blockInstance.tklst) {
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
		if (config.trackLst?.activeTracks) {
			// active facet tracks are inuse; if user deletes such tracks from block ui, must update state
			const newLst = config.trackLst.activeTracks.filter(n => this.blockInstance.tklst.find(i => i.name == n))
			config.trackLst.activeTracks = newLst
		}
		this.interactions.saveToState(config)
	}

	/* tricky logic */
	async launchBlockWithTracks(tklst) {
		if (this.blockInstance) {
			/* block instance is present
            this should be updating tracks in this block, by adding new ones listed in tklst[],
            and deleting old ones via a tricky method
            */
			for (const tk of tklst) {
				let tki // index of this tk in block
				if (tk.dslabel) {
					// tk has dslabel and must be identified by it
					tki = this.blockInstance.tklst.findIndex(i => i.dslabel == tk.dslabel)
				} else if (tk.name) {
					// identify tk by name
					tki = this.blockInstance.tklst.findIndex(i => i.name == tk.name)
				} else {
					throw 'tk missing dslabel & name'
				}
				if (tki == -1) {
					// this tk is not in block, add to block
					const t = this.blockInstance.block_addtk_template(tk)
					this.blockInstance.tk_load(t)
				}
			}
			if (this.state.config.trackLst?.removeTracks) {
				// facet table marks these tracks for removal. they are all identified by tk.name
				for (const n of this.state.config.trackLst.removeTracks) {
					const i = this.blockInstance.tklst.findIndex(i => i.name == n)
					if (i != -1) this.blockInstance.tk_remove(i)
				}
			}
			// tricky! if snvindel.shown is false, means user has toggled it off. thus find all mds3 tk and remove them
			if (this.state.config.snvindel && !this.state.config.snvindel.shown) {
				let found = true
				while (found) {
					found = false
					for (const [i, tk] of this.blockInstance.tklst.entries()) {
						if (tk.type == 'mds3') {
							this.blockInstance.tk_remove(i)
							found = true
							break
						}
					}
				}
			}
			return
		}

		// no block instance, create new block

		this.dom.blockHolder.selectAll('*').remove()
		const arg: any = {
			holder: this.dom.blockHolder,
			genome: this.opts.genome, // genome obj
			nobox: true,
			tklst,
			debugmode: this.opts.debug,
			onAddRemoveTk: () => {
				this.maySaveTrackUpdatesToState()
			}
		}
		if (this.state.config.blockIsProteinMode) {
			// must be in protein mode and requires gene symbol
			if (!this.state.config.geneSearchResult.geneSymbol) throw 'blockIsProteinMode=true but geneSymbol missing'
			// dataset config wants to default to gene view, and gene symbol is available
			// call block.init to launch gene view
			arg.query = this.state.config.geneSearchResult.geneSymbol
			const _ = await import('#src/block.init')
			await _.default(arg)
			this.blockInstance = arg.__blockInstance

			// update sandbox header with gene name
			this.opts.header.text(arg.query)
			return
		}
		// must be in genomic mode and requires coord
		if (!this.state.config.geneSearchResult.chr) throw 'blockIsProteinMode=false but chr missing'
		arg.chr = this.state.config.geneSearchResult.chr
		arg.start = this.state.config.geneSearchResult.start
		arg.stop = this.state.config.geneSearchResult.stop
		first_genetrack_tolist(this.opts.genome, arg.tklst)

		arg.onCoordinateChange = this.interactions.onCoordinateChange

		const _ = await import('#src/block')
		this.blockInstance = new _.Block(arg)
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
