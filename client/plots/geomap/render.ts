import type { Div, SvgG } from '../../types/d3.d'
import type { GeomapConfig, GeomapSite } from '#types'
import type { Feature } from 'geojson'
import type { GeoPermissibleObjects, GeoPath } from 'd3-geo'
import { geoPath, geoGraticule10, zoom, zoomIdentity } from 'd3'
import { Menu } from '#dom'
import {
	world,
	WIDTH,
	HEIGHT,
	getSiteKey,
	getHighlightSet,
	getValidSites,
	getSiteCount,
	createProjection,
	countriesWithSites
} from './helpers'

const LAND_FILL = '#e8e8e8'
const LAND_STROKE = '#bcbcbc'
const PIN_FILL = '#2b6cb0'
const PIN_HIGHLIGHT_FILL = '#dd6b20'
const PIN_R = 3.5
const PIN_HIGHLIGHT_R = 6

/*
Render a d3-geo world map with a pin per site into `holder`. Standalone (no rx/plot state) so it is
shared by both the geomap mass plot and the mass "about" landing tab. Reads only sites[] + highlightIds[]
from the config, keeping it dataset-agnostic.
*/
export function renderGeomap(holder: Div, geomap?: GeomapConfig, tip: Menu = new Menu({ padding: '9px 11px' })): void {
	holder.selectAll('*').remove()
	const sites = getValidSites(geomap)
	const highlight = getHighlightSet(geomap)

	// relative wrapper lets the zoom buttons overlay the map
	const wrapper = holder.append('div').style('position', 'relative')
	// full-width, responsive: viewBox keeps the WIDTHxHEIGHT projection space while the svg scales to its container
	const svg = wrapper
		.append('svg')
		.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
		.attr('preserveAspectRatio', 'xMidYMid meet')
		.attr('width', '100%')
		.style('height', 'auto')
		.style('display', 'block')
		.style('border', '1px solid #ededed')
		.style('background', '#f6fbff')
	const mapG = svg.append('g')

	const projection = createProjection()
	const path = geoPath(projection)

	// graticule + country outlines as a static basemap
	mapG
		.append('path')
		.attr('d', path(geoGraticule10()) || '')
		.attr('fill', 'none')
		.attr('stroke', '#dceaf5')
		.attr('stroke-width', 0.5)
	mapG
		.append('g')
		.selectAll('path')
		.data(world.features)
		.enter()
		.append('path')
		.attr('d', (d: Feature) => path(d.geometry as GeoPermissibleObjects) || '')
		.attr('fill', LAND_FILL)
		.attr('stroke', LAND_STROKE)
		.attr('stroke-width', 0.4)

	// label the countries that contain sites, at each country's centroid
	if (geomap?.showCountryLabels) renderCountryLabels(mapG, path, sites)

	// pins: render the non-highlighted first so emphasized pins draw on top
	const pinG = mapG.append('g')
	const ordered = [...sites].sort((a, b) => Number(highlight.has(getSiteKey(a))) - Number(highlight.has(getSiteKey(b))))
	for (const site of ordered) {
		const xy = projection([site.lon, site.lat])
		if (!xy) continue
		const isHi = highlight.has(getSiteKey(site))
		const count = getSiteCount(geomap, site)
		pinG
			.append('circle')
			.attr('cx', xy[0])
			.attr('cy', xy[1])
			.attr('r', isHi ? PIN_HIGHLIGHT_R : PIN_R)
			.attr('fill', isHi ? PIN_HIGHLIGHT_FILL : PIN_FILL)
			.attr('stroke', '#fff')
			.attr('stroke-width', isHi ? 1.2 : 0.6)
			.attr('fill-opacity', 0.85)
			.style('cursor', 'default')
			.on('mouseover', (event: MouseEvent) => showTip(tip, event, site, isHi, count))
			.on('mouseout', () => tip.hide())
	}

	/*
	Drag to pan; use the on-map +/- buttons or ctrl/cmd+wheel to zoom. Plain wheel is intentionally
	NOT captured so the page keeps scrolling normally when the pointer is over this full-width map.
	*/
	const zoomBehavior = zoom<SVGSVGElement, unknown>()
		.scaleExtent([1, 8])
		.filter((event: WheelEvent | MouseEvent | TouchEvent) => {
			if (event.type === 'wheel') return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey
			// allow drag-pan and touch, but not the secondary mouse button
			return !(event as MouseEvent).button
		})
		.on('zoom', ev => mapG.attr('transform', ev.transform.toString()))
	svg.call(zoomBehavior).on('dblclick.zoom', null)

	renderZoomControls(
		wrapper,
		() => {
			svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.6)
		},
		() => {
			svg
				.transition()
				.duration(300)
				.call(zoomBehavior.scaleBy, 1 / 1.6)
		},
		() => {
			svg.transition().duration(300).call(zoomBehavior.transform, zoomIdentity)
		}
	)

	renderLegend(holder, highlight.size > 0)
}

function showTip(tip: Menu, event: MouseEvent, site: GeomapSite, isHi: boolean, count?: number): void {
	tip.clear().show(event.clientX, event.clientY)
	const card = tip.d.append('div').style('line-height', '1.4').style('color', '#2a2a2a')

	// name + a subtle "Your site" pill for the user's own sites (no bold)
	const nameRow = card.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '8px')
	nameRow
		.append('span')
		.style('font-size', '13px')
		.style('font-weight', '500')
		.style('color', '#1a1a1a')
		.text(site.name)
	if (isHi)
		nameRow
			.append('span')
			.style('font-size', '9.5px')
			.style('font-weight', '500')
			.style('letter-spacing', '0.02em')
			.style('color', PIN_HIGHLIGHT_FILL)
			.style('background', 'rgba(221, 107, 32, 0.12)')
			.style('padding', '1px 7px')
			.style('border-radius', '9px')
			.style('white-space', 'nowrap')
			.text('Your site')

	// location line (country / iso), muted
	const sub = [site.country, site.iso].filter(Boolean).join(', ')
	if (sub) card.append('div').style('font-size', '11px').style('color', '#8a8a8a').style('margin-top', '2px').text(sub)

	// patient count (own sites only) — number tinted, rest muted, no bold
	if (count != null) {
		const line = card.append('div').style('font-size', '11.5px').style('color', '#6b7280').style('margin-top', '6px')
		line.append('span').style('color', PIN_FILL).text(count.toLocaleString())
		line.append('span').text(` patient${count === 1 ? '' : 's'}`)
	}
}

function renderCountryLabels(mapG: SvgG, path: GeoPath, sites: GeomapSite[]): void {
	const g = mapG.append('g').style('pointer-events', 'none')
	for (const feature of countriesWithSites(sites)) {
		const [x, y] = path.centroid(feature as unknown as GeoPermissibleObjects)
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue
		const name = (feature.properties as { name?: string } | null)?.name
		if (!name) continue
		g.append('text')
			.attr('x', x)
			.attr('y', y)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.style('font-size', '9px')
			.style('fill', '#333')
			.style('stroke', '#fff')
			.style('stroke-width', '2.5px')
			.style('paint-order', 'stroke')
			.text(name)
	}
}

function renderZoomControls(wrapper: Div, onIn: () => void, onOut: () => void, onReset: () => void): void {
	const box = wrapper
		.append('div')
		.style('position', 'absolute')
		.style('top', '8px')
		.style('right', '8px')
		.style('display', 'flex')
		.style('flex-direction', 'column')
		.style('gap', '4px')
	const btn = (label: string, title: string, onClick: () => void) =>
		box
			.append('button')
			.attr('type', 'button')
			.attr('title', title)
			.style('width', '28px')
			.style('height', '28px')
			.style('cursor', 'pointer')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('background', '#fff')
			.style('font-size', '16px')
			.style('line-height', '1')
			.text(label)
			.on('click', onClick)
	btn('+', 'Zoom in', onIn)
	btn('−', 'Zoom out', onOut)
	btn('↺', 'Reset', onReset)
}

function renderLegend(holder: Div, hasHighlight: boolean): void {
	const legend = holder.append('div').style('display', 'flex').style('gap', '18px').style('margin-top', '8px')
	const row = (color: string, label: string, r: number) => {
		const item = legend.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '6px')
		item
			.append('svg')
			.attr('width', 16)
			.attr('height', 16)
			.append('circle')
			.attr('cx', 8)
			.attr('cy', 8)
			.attr('r', r)
			.attr('fill', color)
			.attr('stroke', '#fff')
		item.append('span').style('font-size', '12px').text(label)
	}
	row(PIN_FILL, 'All sites', PIN_R + 1)
	if (hasHighlight) row(PIN_HIGHLIGHT_FILL, 'Your sites', PIN_HIGHLIGHT_R)
}
