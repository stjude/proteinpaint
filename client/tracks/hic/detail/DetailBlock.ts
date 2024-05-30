import { first_genetrack_tolist } from '#src/client'
import { Elem } from '../../../types/d3'
import { ChrPosition } from '../../../types/hic'
import { Selection } from 'd3-selection'
import blocklazyload from '#src/block.lazyload'

export class DetailBlock {
	app: any
	hic: any
	width: number
	bbmargin: number
	/** either the x axis or rotor in y axis */
	holder: Elem | Selection<HTMLDivElement, any, any, any>
	bbw: number
	isYblock: boolean
	defaultTop: number
	defaultLeft: number

	block: any

	/** Defaults */
	readonly leftheadw = 20
	readonly rightheadw = 40
	readonly lpad = 1
	readonly rpad = 1
	firstRender = 0

	constructor(
		app: any,
		hic: any,
		blockwidth: number,
		bbmargin: number,
		holder: Elem | Selection<HTMLDivElement, any, any, any>,
		isYblock: boolean
	) {
		this.app = app
		this.hic = hic
		this.width = blockwidth
		this.bbmargin = bbmargin
		this.holder = holder
		this.isYblock = isYblock
		this.bbw = this.leftheadw + this.lpad + this.width + this.rpad + this.rightheadw + 2 * this.bbmargin
		this.defaultLeft = this.bbmargin + this.leftheadw + this.lpad
		this.defaultTop = this.bbmargin + this.rightheadw + this.rpad
	}

	setArgs(chrObj: ChrPosition) {
		const runPpArgs = {
			hostURL: this.hic.hostURL,
			genome: this.hic.genome,
			holder: this.holder,
			noresize: true,
			nobox: true,
			butrowbottom: true,
			style: {
				margin: `${this.bbmargin}px`
			},
			width: this.width,
			leftheadw: this.leftheadw,
			chr: chrObj.chr,
			start: chrObj.start,
			stop: chrObj.stop,
			rightheadw: this.rightheadw,
			tklst: [],
			rotated: this.isYblock,
			showreverse: this.isYblock
		}

		first_genetrack_tolist(this.hic.genome, runPpArgs.tklst)

		return runPpArgs
	}

	setMethods(canvasHolder: any, canvas: any, sheath?: any) {
		/** Inherited methods used elsewhere is pannedby, panning, zoomblock, etc.
		 * Refer to block.js for those methodsv*/
		const runPpMethods = {
			onloadalltk_always: () => {
				this.onload(canvasHolder, canvas, sheath)
			},
			onpanning: (xoff: number) => this.onpanning(xoff, canvas)
		}
		if (this.isYblock) {
			//Button row height default is 30
			runPpMethods['onsetheight'] = (bbh: number) => {
				//this.holder = rotor for y block
				this.holder.transition().style('left', `${bbh + this.bbmargin + 30}px`)
			}
		}
		return runPpMethods
	}

	onload(canvasHolder: any, canvas: any, sheath?: any) {
		//Calculate from the rendered block and apply as the default for canvas/heatmap rendering
		this.bbw =
			this.block.leftheadw +
			this.block.lpad +
			this.block.width +
			this.block.rpad +
			this.block.rightheadw +
			2 * this.bbmargin

		if (this.isYblock) {
			sheath.transition().style('height', `${this.bbw}px`)
			canvasHolder.style('height', `${this.bbw}px`)
		} else canvasHolder.style('width', `${this.bbw}px`)
		//Reason for tracking first render?
		// if (this.firstRender) {
		// 	this.firstRender = false
		if (this.isYblock) {
			this.defaultTop = this.bbmargin + this.block.rightheadw + this.block.rpad
			canvas.style('top', `${this.defaultTop}px`)
		} else {
			this.defaultLeft = this.bbmargin + this.block.leftheadw + this.block.lpad
			canvas.style('left', `${this.defaultLeft}px`)
		}
		// 	return
		// }

		const config = {
			[this.isYblock ? 'y' : 'x']: {
				chr: this.block.rglst[0].chr,
				start: this.block.rglst[0].start,
				stop: this.block.rglst[0].stop
			}
		}
		if (this.firstRender >= 2) {
			/**Dispatches on change per block
			 * Should only dispatch once per change (e.g. changing
			 * the coordinates, zooming, etc.)
			 */
			this.app.dispatch({
				type: 'view_update',
				config
			})
		} else {
			//Reduce server requests on first load
			this.firstRender++
		}
	}

	onpanning(xoff: number, canvas: any) {
		if (!this.isYblock) canvas.style('left', `${xoff + this.defaultLeft}px`)
		else canvas.style('top', `${-xoff + this.defaultTop}px`)
	}

	async loadBlock(chrObj: ChrPosition, canvasHolder: any, canvas: any, sheath?: any) {
		const runPpArgs = this.setArgs(chrObj)
		const runPpMethods = this.isYblock
			? this.setMethods(canvasHolder, canvas, sheath)
			: this.setMethods(canvasHolder, canvas)

		const args = Object.assign(runPpArgs, runPpMethods)

		await blocklazyload(args).then(async (block: any) => {
			//access the block methods
			this.block = block
		})

		/** this won't work, will duplicate the chunk for block, try named chunk
		import('./block').then(p=>{
			this.block = new p.Block(arg2)
		}) */
	}
}
