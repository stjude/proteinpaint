import { first_genetrack_tolist } from '#common/1stGenetk'

export class View {
	state: any
	dom: any
	opts: any
	interactions: any
	blockInstance: any
	constructor(state, dom, opts, interactions) {
		this.state = state
		this.dom = dom
		this.opts = opts
		this.interactions = interactions
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
			/*
            // use onsetheight but not onloadalltk_always, so callback will be called on all tk updates, including removing tk
            //onloadalltk_always:
            onsetheight: () => {
                // TODO on any tk update, collect tk config and save to state so they are recoverable from session
                // FIXME this is not called at protein mode
                this.maySaveTrackUpdatesToState()
            }
            */
			onAddRemoveTk: () => this.interactions.maySaveTrackUpdatesToState(this.blockInstance, this.state)
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
