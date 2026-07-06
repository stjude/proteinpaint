import type { MassState, BasePlotConfig, MassAppApi } from '#mass/types/mass'
import type { GeomapConfig, GeomapSite } from '#types'
import type { Elem, Div, SvgSvg, SvgG } from '../../types/d3.d'
import type { Feature } from 'geojson'
import type { GeoPermissibleObjects } from 'd3-geo'
import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import { Menu } from '#dom'
import { geoPath, geoGraticule10, zoom, zoomIdentity } from 'd3'
import { world, WIDTH, HEIGHT, getSiteKey, getHighlightSet, getValidSites, createProjection } from './helpers'

const LAND_FILL = '#e8e8e8'
const LAND_STROKE = '#bcbcbc'
const PIN_FILL = '#2b6cb0'
const PIN_HIGHLIGHT_FILL = '#dd6b20'
const PIN_R = 3.5
const PIN_HIGHLIGHT_R = 6

type GeomapDom = {
	holder: Div
	header?: Elem
	controls?: Elem
	svg?: SvgSvg
	mapG?: SvgG
	legend?: Div
	tip: Menu
}

class Geomap extends PlotBase implements RxComponent {
	static type = 'geomap'
	type: string
	dom: GeomapDom

	constructor(opts: { holder: Div; header?: Elem; controls?: Elem }, api: ComponentApi) {
		super(opts, api)
		this.type = Geomap.type
		const holder = opts.holder.append('div').style('padding', '10px')
		this.dom = {
			holder,
			header: opts.header,
			controls: opts.controls,
			tip: new Menu({ padding: '4px 8px' })
		}
		if (this.dom.header) this.dom.header.html('Site Map')
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	reactsTo(action: { type: string; id?: string }) {
		if (action.type.startsWith('plot_')) return action.id === this.id
		return true
	}

	async main() {
		const geomap: GeomapConfig | undefined = this.state.config.geomap
		this.render(geomap)
	}

	private render(geomap?: GeomapConfig) {
		this.dom.holder.selectAll('*').remove()
		const sites = getValidSites(geomap)
		const highlight = getHighlightSet(geomap)

		const svg = this.dom.holder
			.append('svg')
			.attr('width', WIDTH)
			.attr('height', HEIGHT)
			.style('max-width', '100%')
			.style('border', '1px solid #ededed')
			.style('background', '#f6fbff') as SvgSvg
		const mapG = svg.append('g') as SvgG
		this.dom.svg = svg
		this.dom.mapG = mapG

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

		// pins: render the non-highlighted first so emphasized pins draw on top
		const pinG = mapG.append('g')
		const ordered = [...sites].sort(
			(a, b) => Number(highlight.has(getSiteKey(a))) - Number(highlight.has(getSiteKey(b)))
		)
		for (const site of ordered) {
			const xy = projection([site.lon, site.lat])
			if (!xy) continue
			const isHi = highlight.has(getSiteKey(site))
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
				.on('mouseover', (event: MouseEvent) => this.showTip(event, site, isHi))
				.on('mouseout', () => this.dom.tip.hide())
		}

		// pan + zoom
		svg.call(
			zoom<SVGSVGElement, unknown>()
				.scaleExtent([1, 8])
				.on('zoom', ev => mapG.attr('transform', ev.transform.toString()))
		)
		svg
			.on('dblclick.zoom', null)
			.on('dblclick', () => svg.transition().duration(400).call(zoom<SVGSVGElement, unknown>().transform, zoomIdentity))

		this.renderLegend(highlight.size > 0)
	}

	private showTip(event: MouseEvent, site: GeomapSite, isHi: boolean) {
		this.dom.tip.clear().show(event.clientX, event.clientY)
		const d = this.dom.tip.d.append('div')
		d.append('div').style('font-weight', 'bold').text(site.name)
		const sub = [site.country, site.iso].filter(Boolean).join(', ')
		if (sub) d.append('div').style('font-size', '12px').style('color', '#555').text(sub)
		if (isHi) d.append('div').style('font-size', '12px').style('color', PIN_HIGHLIGHT_FILL).text('Your site')
	}

	private renderLegend(hasHighlight: boolean) {
		const legend = this.dom.holder
			.append('div')
			.style('display', 'flex')
			.style('gap', '18px')
			.style('margin-top', '8px')
		this.dom.legend = legend
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
}

export const componentInit = getCompInit(Geomap)

export async function getPlotConfig(opts: { geomap?: GeomapConfig }, app: MassAppApi) {
	// seed locations from the dataset-provided termdbConfig.geomap when the launcher
	// (about-tab button / chart catalog) passes only { chartType:'geomap' }
	const fromDs: GeomapConfig | undefined = app?.vocabApi?.termdbConfig?.geomap
	const config = {
		chartType: 'geomap',
		// the map is not filtered by dictionary terms, so hide the per-plot filter UI
		hidePlotFilter: true,
		geomap: fromDs ? structuredClone(fromDs) : { sites: [] }
	}
	return copyMerge(config, opts)
}
