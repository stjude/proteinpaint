import { first_genetrack_tolist } from '#common/1stGenetk'

export class View {
	state: any
	app: any
	dom: any
	opts: any
	id: any
	blockInstance: any
	constructor(state, app, dom, opts, id) {
		this.state = state
		this.app = app
		this.dom = dom
		this.opts = opts
		this.id = id
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

		const arg: any = {
			holder: this.dom.blockHolder,
			genome: this.app.opts.genome, // genome obj
			nobox: true,
			tklst,
			debugmode: this.app.opts.debug,
			/*
            // use onsetheight but not onloadalltk_always, so callback will be called on all tk updates, including removing tk
            //onloadalltk_always:
            onsetheight: () => {
                // TODO on any tk update, collect tk config and save to state so they are recoverable from session
                // FIXME this is not called at protein mode
                this.maySaveTrackUpdatesToState()
            }
            */
			onAddRemoveTk: () => this.maySaveTrackUpdatesToState()
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
		first_genetrack_tolist(this.app.opts.genome, arg.tklst)

		arg.onCoordinateChange = async rglst => {
			await this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config: { geneSearchResult: { chr: rglst[0].chr, start: rglst[0].start, stop: rglst[0].stop } }
			})
		}

		const _ = await import('#src/block')
		this.blockInstance = new _.Block(arg)
	}

	async maySaveTrackUpdatesToState() {
		/* following changes will be saved in state:
		- when a mds3 subtk is created/updated, its tk.filterObj should be saved to state so it can be recovered from session
		- a facet track is removed by user via block ui
		*/
		if (!this.blockInstance) {
			// xx
			return
		}
		const config = structuredClone(this.state.config)
		for (const t of this.blockInstance.tklst) {
			if (t.type == 'mds3' && t.filterObj) {
				if (this.state.filter) {
					if (JSON.stringify(t.filterObj) == JSON.stringify(this.state.filter)) {
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
			const newLst = config.trackLst.activeTracks.filter(n => this.blockInstance.tklst.find(i => i.name == n))
			config.trackLst.activeTracks = newLst
		}
		await this.app.save({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}
}
