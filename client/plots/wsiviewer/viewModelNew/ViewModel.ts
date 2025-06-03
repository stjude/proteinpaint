// import Settings from "#plots/wsiviewer/Settings.ts";
import type { WSImage } from '@sjcrh/proteinpaint-types'
import type { WSImageLayers } from '#plots/wsiviewer/viewModelNew/WSImageLayers.ts'

export class ViewModel {
	public sampleWSImages: WSImage[]
	public wsimageLayers: Array<WSImageLayers>
	public wsimageLayersLoadError: string | undefined

	constructor(
		sampleWSImages: WSImage[],
		wsimageLayers: Array<WSImageLayers>,
		wsimageLayersLoadError: undefined | string
	) {
		this.sampleWSImages = sampleWSImages
		this.wsimageLayers = wsimageLayers
		this.wsimageLayersLoadError = wsimageLayersLoadError
	}
}
