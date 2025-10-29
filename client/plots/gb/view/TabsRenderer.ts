import { Tabs, make_one_checkbox, renderTable } from '#dom'

export class TabsRenderer {
	state: any
	dom: any
	interactions: any
	tabs: any
	constructor(state, dom, interactions) {
		this.state = state
		this.dom = dom
		this.interactions = interactions
	}

	main() {
		this.getTabs()
		this.mayRenderTabs()
	}

	getTabs() {
		const tabs: any[] = []
		/* based on ds configuration and data/query type availability, 
        get list of tabs corresponding to different functionalities of the genome browser
        due to constrain of how tab works, must generate tab array first, call `new Tabs` to initiate holder for each tab
        then render contents into each holder for each tab
        thus has to duplicate the logic for computing tabs
        */

		if (this.state.config.trackLst?.facets) {
			// one tab for each facet table
			// quick fix to hardcode showing facet table as first tab. allow customization later
			for (const facet of this.state.config.trackLst.facets) {
				tabs.push({ label: facet.name || 'Facet Table' })
			}
		}

		if (this.state.config.snvindel) {
			// has snvindel. some logic to decide if show tab for it
			if (this.state.config.snvindel.details) {
				// has details for data precomputing, must show tab in order to generate contents
				tabs.push({ label: 'Variant Values' })

				if (this.state.config.variantFilter) {
					// for now, this filter only works with snvindel.details
					tabs.push({ label: 'Variant Filter' })
				}
			} else {
				// no computing detail.
				if (this.state.config.trackLst) {
					// also there is trackLst. in order *not to show trackLst tab alone*, also show snvindel tab and allow to toggle mds3 tk on/off
					tabs.push({ label: 'Variants' })
				} else {
					// do not add tab, to avoid showing a lone snvindel tab
				}
			}
		}
		if (this.state.config.ld) {
			tabs.push({ label: 'LD Map' })
		}
		this.tabs = tabs
	}

	mayRenderTabs() {
		const tabs = this.tabs
		if (!tabs?.length) return
		// has some tabs! initiate the tab ui, then at <div> of each tab, render contents
		const toggles = new Tabs({
			holder: this.dom.tabsDiv.append('div').style('border-bottom', 'solid 1px #ccc').style('padding-bottom', '20px'),
			tabs,
			hideOnDblClick: true
		})
		toggles.main()

		////////////////////////////////////
		//
		// must repeat tab-computing logic in exact order above!! otherwise out of sync
		// after filling contents for each tab, advance index value of tabsIdx
		//
		////////////////////////////////////
		let tabsIdx = 0

		if (this.state.config.trackLst?.facets) {
			// (above) quick fix to hardcode showing facet table as first tab. allow customization later
			for (const facet of this.state.config.trackLst.facets) {
				const div = tabs[tabsIdx++].contentHolder.append('div')
				this.renderFacetTable(facet, div)
			}
		}

		if (this.state.config.snvindel) {
			if (this.state.config.snvindel.details) {
				const div = tabs[tabsIdx++].contentHolder.append('div')
				// hardcode to 2 groups used by this.state.config.snvindel.details.groups[]
				this.dom.group1div = div.append('div')
				this.dom.group2div = div.append('div')
				this.dom.testMethodDiv = div.append('div').style('margin-top', '3px')

				if (this.state.config.variantFilter) {
					// the whole holder has white-space=nowrap (likely from sjpp-output-sandbox-content)
					// must set white-space=normal to let INFO filter wrap and not to extend beyond holder
					this.dom.variantFilterHolder = tabs[tabsIdx++].contentHolder.append('div').style('white-space', 'normal')
				}
			} else {
				if (this.state.config.trackLst) {
					// snvindel show/hide toggling
					const div = tabs[tabsIdx++].contentHolder.append('div')
					make_one_checkbox({
						labeltext: 'Show variant track',
						checked: this.state.config.snvindel.shown,
						holder: div,
						callback: this.interactions.launchVariantTrack
					})
				}
			}
		}
		if (this.state.config.ld) {
			/* tricky: duplicate ld.tracks[] and scope it here, to pass to dispatch
            somehow, this doesn't work for dispatch
            config: {
                ld: {
                    tracks: {
                        [i]: {shown}
                    }
                }
            }
            */
			const tracks = structuredClone(this.state.config.ld.tracks)

			const div = tabs[tabsIdx++].contentHolder.append('div')
			div.append('div').text('Show/hide linkage disequilibrium map from an ancestry:').style('opacity', 0.5)
			for (const [i, t] of tracks.entries()) {
				make_one_checkbox({
					labeltext: t.name,
					checked: t.shown,
					holder: div,
					callback: checked => this.interactions.launchLdTrack(tracks, i, checked)
				})
			}
		}
	}

	renderFacetTable(facet, div) {
		/* facet.tracks[] each is {name/assay/sample}
        layout a table with assay for columns, sample for rows, cells are tracks
        */
		const assayset = new Set(),
			sampleset = new Set()
		for (const t of facet.tracks) {
			if (t.assay) assayset.add(t.assay)
			if (t.sample) sampleset.add(t.sample)
		}

		const sampleLst = [...sampleset]
		const assayLst = [...assayset] // TODO facet hardcodes assay order

		// TODO click on row/column header to batch operate

		const columns: any = [{ label: 'Sample' }] // TODO use ds sample type
		for (const assay of assayLst) {
			columns.push({
				label: assay,
				fillCell: (td, si) => {
					// "si" index of sample/rows[]; find tracks belonging to this assay+sample combo
					const tklst = facet.tracks.filter(i => i.assay == assay && i.sample == sampleLst[si])
					if (tklst.length == 0) return // no tracks for this combo
					// has track(s) for this combo; render <div> in table cell; click to launch tracks
					// TODO text color based on if track is already shown, but hard to update facet table when user remove a track from block
					td.append('div')
						.attr('class', 'sja_clbtext')
						.style('text-align', 'center')
						.text(tklst.length)
						.on('click', event => this.interactions.clickFacetCell(event, tklst, this.state))
				}
			})
		}
		const rows: any[] = []
		for (const sample of sampleLst) {
			// 1st column is sample name
			// TODO may link sample to sampleview
			const row: any[] = [{ value: sample }]
			// one blank cell for each assay
			for (let i = 0; i < assayLst.length; i++) {
				row.push({})
			}
			rows.push(row)
		}
		renderTable({
			columns,
			rows,
			div
		})
	}
}
