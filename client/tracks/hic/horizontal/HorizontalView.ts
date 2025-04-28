import { first_genetrack_tolist } from '../../../src/client'
import type { MainPlotDiv, ReturnedItems } from '../../../types/hic.ts'
import blocklazyload from '#src/block.lazyload'

export class HorizontalView {
	app: any
	hic: any
	plotDiv: MainPlotDiv
	items: ReturnedItems
	parent: (prop: string) => string | number

	/** Defaults*/
	maxPercentage = 5
	subPanelPxWidth = 600
	borderColor = 'rgba(200,0,0,.1)'

	constructor(opts: any) {
		this.app = opts.app
		this.hic = opts.hic
		this.plotDiv = opts.plotDiv
		this.items = opts.items
		this.parent = opts.parent
	}

	setRunPpTracks() {
		const tracks = [
			{
				type: 'hicstraw',
				file: this.hic.file,
				url: this.hic.url,
				name: this.hic.name,
				enzyme: this.hic.enzyme,
				maxpercentage: this.maxPercentage,
				pyramindup: 1
			}
		]

		if (this.hic.tklst) {
			for (const t of this.hic.tklst) {
				tracks.push(t)
			}
		}

		first_genetrack_tolist(this.hic.genome, tracks)
		return tracks
	}

	setRunPpArgs(tracks: any) {
		const arg = {
			holder: this.plotDiv.plot,
			hostURL: this.hic.hostURL,
			jwt: this.hic.jwt,
			genome: this.hic.genome,
			nobox: 1,
			tklst: tracks
		}

		const state = this.parent('state') as any

		if (state.x.chr == state.y.chr && Math.max(state.x.start, state.y.start) < Math.min(state.x.stop, state.y.stop)) {
			// x/y overlap
			arg['chr'] = state.x.chr
			arg['start'] = Math.min(state.x.start!, state.y.start!)
			arg['stop'] = Math.max(state.x.stop!, state.y.stop!)
		} else {
			arg['chr'] = state.x.chr
			arg['start'] = state.x.start
			arg['stop'] = state.x.stop
			arg['width'] = this.subPanelPxWidth
			arg['subpanels'] = [
				{
					chr: state.y.chr,
					start: state.y.start,
					stop: state.y.stop,
					width: this.subPanelPxWidth,
					leftpad: 10,
					leftborder: this.borderColor
				}
			]
		}
		return arg
	}

	render() {
		const tracks = this.setRunPpTracks()
		const arg = this.setRunPpArgs(tracks)
		blocklazyload(arg)
	}

	// update() {
	// 	//Not required.
	// 	//If controls are added back. Implement changes here.
	// }
}
