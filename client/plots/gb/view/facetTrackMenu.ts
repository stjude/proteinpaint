/* Menus of facet tracks, each to show or hide in the block: for a cell of a facet table, and for the CONFIG panel of a
facet track in the block, which lists the other tracks of its sample */

/** the interactions the menus use, see Interactions.ts */
type FacetInteractions = {
	facetData: any[]
	getActiveFacetTracks: () => string[]
	toggleFacetTrack: (name: string) => boolean
}

/** For the CONFIG panel of a facet track tk in the block: a button that lists the other tracks of the facet named
facetName from the sample of tk, none when it has none, in place of the panel. Reads the facet data and active tracks
as of the click, as the track outlives the view that made it */
export function renderSampleTracksButton(holder, facetName: string, tk, interactions: FacetInteractions) {
	const tklst = getOtherSampleTracks(interactions.facetData, facetName, tk)
	if (!tklst.length) return
	holder
		.append('div')
		.style('margin-bottom', '10px')
		.attr('class', 'sja_menuoption')
		.attr('data-testid', 'sjpp-gb-sampletracks-btn')
		.text(`List other ${tklst.length} track${tklst.length > 1 ? 's' : ''} from ${tk.sample}`)
		.on('click', () => {
			holder.selectAll('*').remove()
			const listDiv = holder.append('div').style('max-height', '300px').style('overflow-y', 'auto')
			renderFacetTrackToggles(listDiv, tklst, interactions, true)
		})
}

/** the tracks of the facet named facetName from the sample of tk, other than tk */
export function getOtherSampleTracks(facetData: any[], facetName: string, tk) {
	if (!tk.sample) return []
	const facet = facetData.find(f => f.name == facetName)
	return (facet?.tracks || []).filter(t => t.sample == tk.sample && t.name != tk.name)
}

/** a row for each of tklst[], to click to show or hide the track, marked SHOWN when shown. showAssay: whether rows name
the assay of the track, as its name may not */
export function renderFacetTrackToggles(holder, tklst: any[], interactions: FacetInteractions, showAssay = false) {
	const activeTracks = interactions.getActiveFacetTracks()
	const table = holder.append('table').style('margin', '5px 5px 5px 2px')
	for (const tk of tklst) {
		const tr = table.append('tr')
		const td1 = tr
			.append('td')
			.style('font-size', '.8em')
			.text(activeTracks.includes(tk.name) ? 'SHOWN' : '')
		if (showAssay)
			tr.append('td')
				.style('opacity', 0.7)
				.text(tk.assay || '')
		tr.append('td')
			.attr('class', 'sja_menuoption')
			.text(tk.name)
			.on('click', () => td1.text(interactions.toggleFacetTrack(tk.name) ? 'SHOWN' : ''))
	}
}
