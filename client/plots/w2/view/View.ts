import { renderTable, Tabs } from '#dom' // sample table + per-image tab strip
import { dofetch3 } from '#common/dofetch' // fetch wrapper for the meta request
import 'ol/ol.css' // OpenLayers base styles (zoom buttons etc.)
import OlMap from 'ol/Map.js' // the pan/zoom map widget
import OlView from 'ol/View.js' // its camera (resolutions + extent)
import TileLayer from 'ol/layer/Tile.js' // layer that mosaics the fetched tiles
import Zoomify from 'ol/source/Zoomify.js' // tile source matching wsi_tile.py's tier math
import type { SpatialImage, WsiImage } from '#types' // the two image kinds wsiBySample returns
import type Settings from '../Settings.ts' // burger-menu + selection settings
import type { ViewData } from '../viewModel/ViewModel.ts' // shaped sample table data
import type { WsiInteractions } from '../interactions/WsiInteractions.ts' // state-edit dispatchers

/** Renders the sample table and, when a sample is selected, tabs for its
 images (one per image folder on disk, shown when there are several) and an
 OpenLayers pan/zoom viewer for the selected image via the openslide-backed
 wsitiles route (no tile server sidecar, no auth). */
export class View {
	constructor(
		/** the plot's table/viewer/error divs (created by Wsi's constructor) */
		readonly dom: { table: any; viewer: any; error: any },
		/** shaped sample table rows + current selection */
		readonly viewData: ViewData,
		/** the selected sample's images from termdb/wsiBySample */
		readonly images: (WsiImage | SpatialImage)[],
		/** burger-menu + selection settings */
		readonly settings: Settings,
		/** dispatchers for sample/image selection */
		readonly interactions: WsiInteractions,
		/** addresses the dataset in wsitiles queries */
		readonly vocab: { genome: string; dslabel: string }
	) {}

	async render() {
		this.renderSampleTable() // the pick-a-sample table
		await this.renderViewer() // tabs + map for the selected sample/image
	}

	private renderSampleTable() {
		this.dom.table.selectAll('*').remove() // full re-render on every state change
		renderTable({
			div: this.dom.table, // mount point
			columns: this.viewData.columns, // Sample | Images
			rows: this.viewData.rows, // one row per sample with images
			singleMode: true, // radio buttons: one sample viewed at a time
			selectedRows: this.settings.selectedSampleIndex != -1 ? [this.settings.selectedSampleIndex] : [],
			noButtonCallback: index => this.interactions.selectSample(index), // row click = select sample
			resize: true, // user-resizable table
			striped: true, // alternating row shading
			maxHeight: '30vh', // table scrolls; the viewer keeps the space below
			header: { style: { 'text-transform': 'capitalize' } } // 'sample' -> 'Sample'
		})
	}

	private async renderViewer() {
		const holder = this.dom.viewer
		holder.selectAll('*').remove() // discard the previous map/tabs

		const sample = this.viewData.selectedSample // row picked in the table
		const selected = this.settings.selectedImageIndex // tab picked by the user
		const image = this.images[selected] ?? this.images[0] // fall back to the first image
		if (!sample || !image) return // nothing to show

		// a tab per image (labelled by its folder name on disk), mirroring the
		// singleCell chart's per-sample tabs; always shown so the user sees how
		// many images the sample has, and picking one re-renders the viewer
		// fileName is <imageName>/<file> in both roots
		const imageName = (f: string) => f.split('/').slice(-2)[0] || f // the image's folder name
		new Tabs({
			holder: holder.append('div'), // tab strip sits above the map
			tabsPosition: 'horizontal',
			tabs: this.images.map((img, i) => ({
				label: imageName(img.fileName), // e.g. 'image1'
				active: i == (this.images[selected] ? selected : 0), // highlight the shown image
				callback: () => this.interactions.selectImage(i) // dispatch -> re-render with image i
			}))
		}).main() // render the tabs now

		// query params match the wsitiles route (server/src/routes/wsitiles.ts);
		// the server resolves the file inside the sample's subfolder of the w2
		// root matching imageType (folder for spatial, wsiFolder for wsi), so
		// same-named paths in both roots can't select the wrong slide
		const params = `wsimage=${encodeURIComponent(image.fileName)}&dslabel=${this.vocab.dslabel}&genome=${
			this.vocab.genome
		}&sample_id=${encodeURIComponent(sample.sampleId)}&imageType=${image.type}`

		if (image.type == 'spatial') {
			// spatial (Xenium) image: reuse the direct viewer, which draws the
			// boundary/expression overlays, addressing the slide via the dataset.
			// Burger-menu settings override the dataset's values (null = not edited yet)
			const s = this.settings
			// genes always load so the hover tooltip reports their counts; the
			// 'Gene expression' checkbox only controls the fill overlay
			const genes = s.geneExpression ?? image.geneExpression
			const direct = await import('../wsi.direct') // lazy-load the overlay viewer
			await direct.init(
				{
					slideQuery: params, // addresses the slide through the dataset (no direct-path gate)
					label: image.fileName, // display name in the info line
					spatialData: image.spatialData, // the consolidated h5ad, source of every overlay
					hideCellStrokes: !s.showCellBoundaries, // polygons without their green outlines
					hideNucleusStrokes: !s.showNucleusBoundaries, // skip the nucleus overlay entirely
					showCellTypes: s.showCellTypes, // fill cells by their cell_type annotation
					cellTypeFilter: s.cellTypeFilter ?? undefined, // 'Types shown' dropdowns; ''/null = all
					geneExpression: s.spatialMode == 'gene_groups' ? undefined : genes, // one overlay per gene
					geneGroups: s.spatialMode == 'gene_groups' ? genes : undefined, // or one summed overlay
					hideExpressionFills: !s.showGeneExpression, // checkbox off = hover counts only, no fills
					annotationLevel: s.annotationLevel ?? image.annotationLevel, // burger overrides dataset
					width: '100%', // fill the sandbox
					height: this.settings.viewerHeight // e.g. 70vh
				},
				holder
			)
			return
		}

		// slide dimensions are needed before tiles can be requested
		const meta = await dofetch3(`wsitiles/meta?${params}`)
		if (!meta || meta.error || meta.status === 'error') {
			// surface the failure in the plot's error div; no viewer without geometry
			this.dom.error.text(`Error loading ${image.fileName}: ${meta?.error || 'failed to load slide metadata'}`)
			return
		}

		const [w, h] = meta.slide_dimensions // level-0 slide size in px
		// server origin for tile URLs ('' when same-origin); trailing slashes trimmed
		const host = (sessionStorage.getItem('hostURL') || (window as any).testHost || '').replace(/\/+$/, '')

		const source = new Zoomify({
			// {z}/{x}/{y} hit wsitiles/tile; the unused {TileGroup} token only satisfies
			// OpenLayers' requirement that a {TileGroup}/{tileIndex} placeholder be present.
			// v=<slide mtime>: tiles are served immutable, so a regenerated slide must
			// change the URL to bust the browser cache
			url: `${host}/wsitiles/tile/{z}/{x}/{y}?${params}&v=${meta.version || 0}&_={TileGroup}`,
			size: [w, h], // OL derives the tier count from this, same math as wsi_tile.py
			crossOrigin: 'anonymous', // tiles come from the API origin, not the page's
			zDirection: -1 // pick the sharper tier when between two zoom levels
		})
		const grid = source.getTileGrid()! // the z/x/y grid OL computed from [w, h]
		const extent = grid.getExtent() // slide bounds in map coordinates

		const mapDiv = holder.append('div').style('width', '100%').style('height', this.settings.viewerHeight)
		const map = new OlMap({
			target: mapDiv.node(), // mount the map into the plot's viewer div
			layers: [new TileLayer({ source })], // OL fetches+mosaics tiles as the user pans/zooms
			view: new OlView({ resolutions: grid.getResolutions(), extent }) // camera locked to the pyramid
		})
		map.getView().fit(extent) // start fully zoomed out, whole slide visible
	}
}
