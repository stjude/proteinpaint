export function sanitizeTrackLstConfig(config) {
	if (!config.trackLst?.facets) return
	for (const facet of config.trackLst.facets) delete facet.tracks
}
