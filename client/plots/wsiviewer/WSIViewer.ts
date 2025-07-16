import { getCompInit } from '#rx'
import 'ol/ol.css'
import type TileLayer from 'ol/layer/Tile.js'
import { WSIViewerInteractions } from '#plots/wsiviewer/interactions/WSIViewerInteractions.ts'
import type Settings from '#plots/wsiviewer/Settings.ts'
import wsiViewerDefaults from '#plots/wsiviewer/defaults.ts'
import { RxComponentInner } from '../../types/rx.d'
import 'ol-ext/dist/ol-ext.css'
import { WSIAnnotationsRenderer } from '#plots/wsiviewer/view/WSIAnnotationsRenderer.ts'
import { Buffer } from '#plots/wsiviewer/interactions/Buffer.ts'
import { ViewModelProvider } from '#plots/wsiviewer/viewModel/ViewModelProvider.ts'
import { ThumbnailRenderer } from '#plots/wsiviewer/view/ThumbnailRenderer.ts'
import { MapRenderer } from '#plots/wsiviewer/view/MapRenderer.ts'
import { MetadataRenderer } from '#plots/wsiviewer/view/MetadataRenderer.ts'
import { LegendRenderer } from '#plots/wsiviewer/view/LegendRenderer.ts'
import type OLMap from 'ol/Map'

export class WSIViewer extends RxComponentInner {
	// following attributes are required by rx
	private type: string

	private wsiViewerInteractions: WSIViewerInteractions

	private thumbnailsContainer: any
	private viewModelProvider = new ViewModelProvider()

	private thumbnailRenderer = new ThumbnailRenderer()
	private metadataRenderer = new MetadataRenderer()
	private legendRenderer = new LegendRenderer()

	constructor(opts: any) {
		super()
		this.type = 'WSIViewer'
		this.opts = opts
		this.wsiViewerInteractions = new WSIViewerInteractions(this, opts)
	}

	async init(): Promise<void> {
		const state = this.app.getState()
		if (this.opts.header) {
			//If sandbox is present, add sample id and data type to the header
			console.log('header', this.opts.header)
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

		const viewModel = await this.viewModelProvider.provide(genome, dslabel, sample_id)
		const wsimages = viewModel.sampleWSImages
		const wsimageLayers = viewModel.wsimageLayers
		const wsimageLayersLoadError = viewModel.wsimageLayersLoadError

		if (wsimages.length === 0) {
			holder.append('div').style('margin-left', '10px').text('No WSI images.')
			return
		}

		if (wsimageLayersLoadError) {
			holder.append('div').style('margin-left', '10px').text(wsimageLayersLoadError)
			return
		}

		const activeImage: TileLayer = wsimageLayers[settings.displayedImageIndex].wsimage
		const activeImageExtent = activeImage?.getSource()?.getTileGrid()?.getExtent()

		let map: OLMap | undefined = undefined
		const imageViewData = viewModel.getImageViewData(settings.displayedImageIndex)

		if (settings.renderWSIViewer) {
			this.thumbnailsContainer = this.thumbnailRenderer.render(
				holder,
				this.thumbnailsContainer,
				wsimageLayers.map(wsimageLayers => wsimageLayers.wsimage),
				settings,
				this.wsiViewerInteractions
			)

			holder.select('div[id="wsi-viewer"]').remove()

			holder
				.append('div')
				.attr('id', 'wsi-viewer')
				.style('width', settings.imageWidth)
				.style('height', settings.imageHeight)

			//TODO: Handle this better
			if (imageViewData.activePatchColor) {
				this.wsiViewerInteractions.activePatchColor = imageViewData.activePatchColor
			}

			map = new MapRenderer(
				wsimageLayers[settings.displayedImageIndex],
				this.wsiViewerInteractions.viewerClickListener,
				activeImageExtent
			).getMap()
		}

		if (settings.renderAnnotationTable && map) {
			const wsiAnnotationsRenderer = new WSIAnnotationsRenderer(buffers, this.wsiViewerInteractions)
			wsiAnnotationsRenderer.render(holder, imageViewData, activeImageExtent!, map)
			this.legendRenderer.render(holder, imageViewData)
			this.metadataRenderer.renderMetadata(holder, imageViewData)

			const zoomInPoints = wsimages[settings.displayedImageIndex].zoomInPoints

			if (zoomInPoints != undefined) {
				this.wsiViewerInteractions.addZoomInEffect(activeImageExtent, zoomInPoints, map)
				this.wsiViewerInteractions.addMapKeyDownListener(
					holder,
					map,
					activeImageExtent,
					imageViewData.shortcuts,
					buffers,
					wsimages[settings.displayedImageIndex]
				)
			}
		}

		if (activeImageExtent && map) {
			map.getView().fit(activeImageExtent)
		}
	}
}

export const wsiViewer = getCompInit(WSIViewer)

export const componentInit = wsiViewer

export async function getPlotConfig(opts: any) {
	return {
		chartType: 'WSIViewer',
		subfolder: 'wsiviewer',
		extension: 'ts',
		settings: wsiViewerDefaults(opts.overrides)
	}
}
