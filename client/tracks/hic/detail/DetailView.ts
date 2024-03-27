import { MainPlotDiv } from '../../../types/hic.ts'
//import { ColorizeElement } from '../dom/ColorizeElement.ts'

export class DetailView {
	app: any
	hic: any
	plotDiv: MainPlotDiv
	data: any
	parent: (prop: string) => string | number
	colorizeElement: any

	initialbinnum_detail = 20

	constructor(opts) {
		this.app = opts.app
		this.hic = opts.hic
		this.plotDiv = opts.plotDiv
		this.data = opts.data
		this.parent = opts.parent
	}

	render() {
		//TODO
	}

	update() {
		//TODO
	}
}
