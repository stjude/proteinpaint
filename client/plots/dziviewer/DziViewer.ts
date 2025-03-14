import { getCompInit } from '#rx'
import OpenSeadragon from 'openseadragon'

export default class DziViewer {
	// following attributes are required by rx
	private type: string
	private opts: any
	private app: any

	constructor(opts: any) {
		this.type = 'DziViewer'
		this.opts = opts
	}

	async init() {
		const state = this.app.getState()
		const holder = this.opts.holder.style('padding', '0px 50px')
		holder.append('div').attr('id', 'openseadragon-viewer').style('width', '50vw').style('height', ' 50vw')

		const tileSources: Array<string> = []

		for (const dzimage of state.dzimages) {
			tileSources.push(`dzimages/${state.sample_id}?genome=${state.genome}&dslabel=${state.dslabel}&file=${dzimage}`)
		}

		/*const viewer =*/ OpenSeadragon({
			id: 'openseadragon-viewer',
			tileSources: tileSources,
			prefixUrl: 'https://openseadragon.github.io/openseadragon/images/',
			showNavigator: true,
			navigatorAutoFade: false,
			sequenceMode: tileSources.length > 1,
			defaultZoomLevel: 1
			// gestureSettingsMouse: {
			// 	clickToZoom: true,
			// 	scrollToZoom: false,
			// 	flickEnabled: true
			// }
		})
	}
}

export const dziViewer = getCompInit(DziViewer)

export const componentInit = dziViewer

export async function getPlotConfig() {
	return {
		chartType: 'DziViewer',
		subfolder: 'dziviewer',
		extension: 'ts'
	}
}
