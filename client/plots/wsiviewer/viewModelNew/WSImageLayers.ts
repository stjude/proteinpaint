import TileLayer from "ol/layer/Tile";
import Zoomify from "ol/source/Zoomify";

export type WSImageLayers = {
    wsimage: TileLayer<Zoomify>
    overlays?: Array<TileLayer<Zoomify>>
}
