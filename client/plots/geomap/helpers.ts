import type { GeomapConfig, GeomapSite } from '#types'
import type { Feature, FeatureCollection } from 'geojson'
import type { GeoProjection, GeoPermissibleObjects } from 'd3-geo'
import { geoNaturalEarth1, geoContains } from 'd3-geo'
import worldJson from './world.json'

export const world = worldJson as unknown as FeatureCollection

/** default render geometry; kept here so the renderer and the unit tests share one source of truth */
export const WIDTH = 900
export const HEIGHT = 460

/** stable key used to match a site against config.highlightIds; defaults to the name */
export function getSiteKey(site: GeomapSite): string {
	return site.id ?? site.name
}

/** build the set of keys to emphasize from the geomap config */
export function getHighlightSet(geomap?: GeomapConfig): Set<string> {
	return new Set(geomap?.highlightIds ?? [])
}

/** per-site value (e.g. patient count) to display on a pin, or undefined when none is configured */
export function getSiteCount(geomap: GeomapConfig | undefined, site: GeomapSite): number | undefined {
	return geomap?.counts?.[getSiteKey(site)]
}

/** drop sites without finite, in-range coordinates so a bad row never throws during projection */
export function getValidSites(geomap?: GeomapConfig): GeomapSite[] {
	if (!geomap?.sites) return []
	return geomap.sites.filter(
		s => Number.isFinite(s.lat) && Number.isFinite(s.lon) && Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180
	)
}

/** the world map projection, shared by the renderer and the unit tests */
export function createProjection(width = WIDTH, height = HEIGHT): GeoProjection {
	return geoNaturalEarth1().fitSize([width, height], world)
}

/** basemap country features that contain at least one site (for country-name labels) */
export function countriesWithSites(sites: GeomapSite[]): Feature[] {
	const out: Feature[] = []
	for (const feature of world.features) {
		const geom = feature as unknown as GeoPermissibleObjects
		if (sites.some(s => geoContains(geom, [s.lon, s.lat]))) out.push(feature)
	}
	return out
}
