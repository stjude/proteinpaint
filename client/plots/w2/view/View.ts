import { renderTable } from '#dom'
import { dofetch3 } from '#common/dofetch'
import 'ol/ol.css'
import OlMap from 'ol/Map.js'
import OlView from 'ol/View.js'
import TileLayer from 'ol/layer/Tile.js'
import Zoomify from 'ol/source/Zoomify.js'
import type { WsiImage } from '#types'
import type Settings from '../Settings.ts'
import type { ViewData } from '../viewModel/ViewModel.ts'
import type { WsiInteractions } from '../interactions/WsiInteractions.ts'

/** Renders the sample table and, when a sample is selected, an OpenLayers
 pan/zoom viewer for the sample's first whole-slide image via the
 openslide-backed wsitiles route (no tile server sidecar, no auth). */
export class View {
	constructor(
		readonly dom: { table: any; viewer: any; error: any },
		readonly viewData: ViewData,
		/** the selected sample's images from termdb/wsiBySample */
		readonly images: WsiImage[],
		readonly settings: Settings,
		readonly interactions: WsiInteractions,
		readonly vocab: { genome: string; dslabel: string }
	) {}

	async render() {
		this.renderSampleTable()
		await this.renderViewer()
	}

	private renderSampleTable() {
		this.dom.table.selectAll('*').remove()
		renderTable({
			div: this.dom.table,
			columns: this.viewData.columns,
			rows: this.viewData.rows,
			singleMode: true, // radio buttons: one sample viewed at a time
			selectedRows: this.settings.selectedSampleIndex != -1 ? [this.settings.selectedSampleIndex] : [],
			noButtonCallback: index => this.interactions.selectSample(index),
			resize: true,
			striped: true,
			maxHeight: '30vh',
			header: { style: { 'text-transform': 'capitalize' } }
		})
	}

	private async renderViewer() {
		const holder = this.dom.viewer
		holder.selectAll('*').remove()

		// simply display the sample's first image for now
		const sample = this.viewData.selectedSample
		const image = this.images[0]
		if (!sample || !image) return

		// query params match the wsitiles route (server/src/routes/wsitiles.ts);
		// the server resolves the file as ds.queries.w2.folder/<sample>/<fileName>
		const params = `wsimage=${encodeURIComponent(image.fileName)}&dslabel=${this.vocab.dslabel}&genome=${
			this.vocab.genome
		}&sample_id=${encodeURIComponent(sample.sampleId)}`

		// slide dimensions are needed before tiles can be requested
		const meta = await dofetch3(`wsitiles/meta?${params}`)
		if (!meta || meta.error || meta.status === 'error') {
			this.dom.error.text(`Error loading ${image.fileName}: ${meta?.error || 'failed to load slide metadata'}`)
			return
		}

		const [w, h] = meta.slide_dimensions
		const host = (sessionStorage.getItem('hostURL') || (window as any).testHost || '').replace(/\/+$/, '')

		const source = new Zoomify({
			// {z}/{x}/{y} hit wsitiles/tile; the unused {TileGroup} token only satisfies
			// OpenLayers' requirement that a {TileGroup}/{tileIndex} placeholder be present
			url: `${host}/wsitiles/tile/{z}/{x}/{y}?${params}&_={TileGroup}`,
			size: [w, h],
			crossOrigin: 'anonymous',
			zDirection: -1
		})
		const grid = source.getTileGrid()!
		const extent = grid.getExtent()

		const mapDiv = holder.append('div').style('width', '100%').style('height', this.settings.viewerHeight)
		const map = new OlMap({
			target: mapDiv.node(),
			layers: [new TileLayer({ source })],
			view: new OlView({ resolutions: grid.getResolutions(), extent })
		})
		map.getView().fit(extent) // start fully zoomed out, whole slide visible
	}
}
