import type TileLayer from 'ol/layer/Tile'
import type Zoomify from 'ol/source/Zoomify'
import type Layer from 'ol/layer/Layer'

export type WSImageLayers = {
	wsimage: TileLayer<Zoomify>
	overlays?: Array<Layer>
}
