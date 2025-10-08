import { getCompInit, type RxComponent } from '#rx'
import { PlotBase } from '../PlotBase'
import 'ol/ol.css'
import type TileLayer from 'ol/layer/Tile.js'
import { WSIViewerInteractions } from '#plots/wsiviewer/interactions/WSIViewerInteractions.ts'
import type Settings from '#plots/wsiviewer/Settings.ts'
import wsiViewerDefaults from '#plots/wsiviewer/defaults.ts'
import 'ol-ext/dist/ol-ext.css'
import { WSIAnnotationsRenderer } from '#plots/wsiviewer/view/WSIAnnotationsRenderer.ts'
import { Buffer } from '#plots/wsiviewer/interactions/Buffer.ts'
import { ViewModelProvider } from '#plots/wsiviewer/viewModel/ViewModelProvider.ts'
import { ThumbnailRenderer } from '#plots/wsiviewer/view/ThumbnailRenderer.ts'
import { MapRenderer } from '#plots/wsiviewer/view/MapRenderer.ts'
import { MetadataRenderer } from '#plots/wsiviewer/view/MetadataRenderer.ts'
import { LegendRenderer } from '#plots/wsiviewer/view/LegendRenderer.ts'
import { ModelTrainerRenderer } from './view/ModelTrainerRenderer'
import type OLMap from 'ol/Map'
import type { ImageViewData } from '#plots/wsiviewer/viewModel/ImageViewData.ts'
import type { ViewModel } from '#plots/wsiviewer/viewModel/ViewModel.ts'
import { sayerror } from '#dom'

class WSIViewer extends PlotBase implements RxComponent {
	static type = 'WSIViewer'
	// following attributes are required by rx
	type: string

	private wsiViewerInteractions: WSIViewerInteractions

	private thumbnailsContainer: any
	private viewModelProvider = new ViewModelProvider()

	private thumbnailRenderer = new ThumbnailRenderer()
	private metadataRenderer = new MetadataRenderer()
	private legendRenderer = new LegendRenderer()
	private map: OLMap | undefined = undefined
	private annotationTable: any

	constructor(opts: any, api) {
		super(opts, api)
		this.type = 'WSIViewer'
		this.opts = opts
		this.wsiViewerInteractions = new WSIViewerInteractions(this, opts)
		this.dom = {
			holder: opts.holder,
			loadingDiv: opts.holder
				.append('div')
				.attr('class', 'wsiViewer-progress')
				.style('position', 'absolute')
				.style('top', '0')
				.style('left', '0')
				.style('width', '100%')
				.style('height', '100%')
				.style('background-color', 'rgba(255, 255, 255, 0.95)')
				.style('text-align', 'center')
				.style('display', 'none'),

			errorDiv: opts.holder.append('div').attr('class', 'wsiViewer-error').style('margin-left', '10px'),
			mapHolder: opts.holder.append('div').attr('id', 'wsiviewer-mapHolder'),
			annotationsHolder: opts.holder
				.append('div')
				.attr('id', 'annotations-table-wrapper')
				.style('padding', '20px')
				.style('display', 'inline-block'),
			legendHolder: opts.holder
				.append('div')
				.attr('id', 'sjpp-legendHolder')
				.style('display', 'inline-block')
				.style('vertical-align', 'top')
		}
	}

	async init(): Promise<void> {
		const state = this.app.getState()
		if (this.opts.header) {
			//If sandbox is present, add sample id and data type to the header
			this.opts.header.html(
				`${state.sample_id} <span style="font-size:.8em">${state.termdbConfig.queries.WSImages.type} images</span>`
			)
		}
	}

	async main(): Promise<void> {
		const state = structuredClone(this.state)
		const settings = state.plots.find(p => p.id === this.id).settings as Settings
		const holder = this.opts.holder

		const buffers = {
			annotationsIdx: new Buffer<number>(0),
			tmpClass: new Buffer<{ label: string; color: string }>({ label: '', color: '' })
		}

		// TODO verify if state.vocab.genome is needed?
		const genome = state.genome || state.vocab.genome
		const dslabel = state.dslabel || state.vocab.dslabel
		const sample_id = state.sample_id
		const aiProjectID = state.aiProjectID
		const aiWSIMageFiles = state.aiWSIMageFiles as Array<string>

		const viewModel: ViewModel = await this.viewModelProvider.provide(
			genome,
			dslabel,
			sample_id,
			settings.sessionsTileSelection,
			settings.displayedImageIndex,
			aiProjectID,
			aiWSIMageFiles
		)

		const wsimages = viewModel.sampleWSImages

		const wsimageLayers = viewModel.wsimageLayers
		const wsimageLayersLoadError = viewModel.wsimageLayersLoadError

		if (wsimages.length === 0) {
			sayerror(this.dom.errorDiv, 'No WSI images found.')
			this.wsiViewerInteractions.toggleLoadingDiv(false)
			return
		}

		if (wsimageLayersLoadError) {
			sayerror(this.dom.errorDiv, wsimageLayersLoadError)
			this.wsiViewerInteractions.toggleLoadingDiv(false)
			return
		}

		const activeImage: TileLayer = wsimageLayers[settings.displayedImageIndex].wsimage
		const activeImageExtent = activeImage?.getSource()?.getTileGrid()?.getExtent()

		const imageViewData: ImageViewData = viewModel.getImageViewData(settings.displayedImageIndex)

		if (settings.renderWSIViewer) {
			this.wsiViewerInteractions.toggleLoadingDiv(settings.renderAnnotationTable)

			this.thumbnailsContainer = this.thumbnailRenderer.render(
				this.dom.mapHolder,
				this.thumbnailsContainer,
				wsimageLayers.map(wsimageLayers => wsimageLayers.wsimage),
				settings,
				this.wsiViewerInteractions
			)

			this.map = new MapRenderer(
				wsimageLayers[settings.displayedImageIndex],
				this.wsiViewerInteractions.viewerClickListener,
				viewModel.sampleWSImages[settings.displayedImageIndex],
				buffers,
				settings
			).render(this.dom.mapHolder, settings)

			if (activeImageExtent && this.map) {
				this.map.getView().fit(activeImageExtent)
			}
		}

		this.metadataRenderer.renderMetadata(this.dom.holder, imageViewData)

		if (settings.renderAnnotationTable && this.map) {
			const modelTrainerRenderer = new ModelTrainerRenderer(this.wsiViewerInteractions)

			const wsiAnnotationsRenderer = new WSIAnnotationsRenderer(buffers, this.wsiViewerInteractions)
			this.annotationTable = wsiAnnotationsRenderer.render(
				this.dom.annotationsHolder,
				imageViewData,
				activeImageExtent!,
				this.map
			)
			this.dom.legendHolder.selectAll('*').remove()
			modelTrainerRenderer.render(this.dom.legendHolder, aiProjectID, genome, dslabel)
			this.legendRenderer.render(this.dom.legendHolder, imageViewData)

			const initialZoomInCoordinate = viewModel.getInitialZoomInCoordinate(settings.displayedImageIndex)

			if (initialZoomInCoordinate != undefined) {
				this.wsiViewerInteractions.zoomInEffectListener(
					activeImageExtent,
					initialZoomInCoordinate,
					this.map,
					imageViewData.activePatchColor!
				)
				this.wsiViewerInteractions.setKeyDownListener(
					holder,
					viewModel.sampleWSImages[settings.displayedImageIndex],
					this.map,
					activeImageExtent,
					imageViewData.activePatchColor!,
					aiProjectID,
					imageViewData.shortcuts,
					buffers
				)
			}
		}
		this.wsiViewerInteractions.toggleLoadingDiv(false)
	}
}

export default WSIViewer

export const wsiViewer = getCompInit(WSIViewer)

export const componentInit = wsiViewer

export async function getPlotConfig(opts: any) {
	return {
		chartType: 'WSIViewer',
		subfolder: 'wsiviewer',
		extension: 'ts',
		hidePlotFilter: true, //Disable the filter in the sandbox header
		settings: wsiViewerDefaults(opts.overrides)
	}
}
