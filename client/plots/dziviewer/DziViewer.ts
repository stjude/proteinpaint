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
		const holder = this.opts.holder
		holder.append('div').attr('id', 'openseadragon-viewer').style('width', '80vw').style('height', ' 80vh')

		const tileSources: Array<string> = []

		for (const dzimage of state.dzimages) {
			tileSources.push(`dzimages/${state.sample_id}?genome=${state.genome}&dslabel=${state.dslabel}&file=${dzimage}`)
		}

		const viewer = OpenSeadragon({
			id: 'openseadragon-viewer',
			tileSources: tileSources,
			prefixUrl: 'https://openseadragon.github.io/openseadragon/images/',
			showNavigator: true,
			sequenceMode: tileSources.length > 1
			// gestureSettingsMouse: {
			// 	clickToZoom: true,
			// 	scrollToZoom: false,
			// 	flickEnabled: true
			//   },
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
