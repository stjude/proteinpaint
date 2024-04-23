import { first_genetrack_tolist } from '#src/client'
import { Elem } from '../../../types/d3'
import { ChrPosition } from '../../../types/hic'
import { Selection } from 'd3-selection'
import blocklazyload from '#src/block.lazyload'

export class DetailBlock {
	hic: any
	width: number
	bbmargin: number
	/** either the x axis or rotor in y axis */
	holder: Elem | Selection<HTMLDivElement, any, any, any>
	bbw: number
	defaultLeft: number
	defaultTop: number
	isYblock: boolean

	block: any

	/** Defaults */
	leftheadw = 20
	rightheadw = 40
	lpad = 1
	rpad = 1
	firstRender = true

	constructor(
		hic: any,
		blockwidth: number,
		bbmargin: number,
		holder: Elem | Selection<HTMLDivElement, any, any, any>,
		isYblock: boolean
	) {
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
		const runPpMethods = {
			onloadalltk_always: (bb: any) => this.onload(bb, canvasHolder, canvas, sheath),
			onpanning: (xoff: number) => this.onpanning(xoff, canvas, this.isYblock)
		}
		if (this.isYblock) {
			//Button row height default is 30
			runPpMethods['onsetheight'] = (bbh: number) => {
				this.holder.transition().style('left', `${bbh + this.bbmargin + 30}px`)
			}
		}
		return runPpMethods
	}

	onload(bb: any, canvasHolder: any, canvas: any, sheath?: any) {
		//Calculate from the rendered block and apply as the default for canvas/heatmap rendering
		const bbw = bb.leftheadw + bb.lpad + bb.width + bb.rpad + bb.rightheadw + 2 * this.bbmargin
		this.bbw = bbw
		if (this.isYblock) {
			sheath.transition().style('height', `${bbw}px`)
			canvasHolder.style('height', `${bbw}px`)
		} else canvasHolder.style('width', `${bbw}px`)
		if (this.firstRender) {
			this.firstRender = false
			if (this.isYblock) {
				const top = this.bbmargin + bb.rightheadw + bb.rpad
				canvas.transition().style('top', `${top}px`)
				this.defaultTop = top
			} else {
				const left = this.bbmargin + bb.leftheadw + bb.lpad
				canvas.transition().style('left', `${left}px`)
				this.defaultLeft = left
			}
		}
	}

	onpanning(xoff: number, canvas: any, isYBlock: boolean) {
		if (isYBlock) canvas.style('left', `${xoff + this.defaultLeft}px`)
		else canvas.style('top', `${-xoff + this.defaultTop}px`)
	}

	async loadBlock(chrObj: ChrPosition, canvasHolder: any, canvas: any, sheath?: any) {
		const runPpArgs = this.setArgs(chrObj)
		const runPpMethods = this.isYblock
			? this.setMethods(canvasHolder, canvas, sheath)
			: this.setMethods(canvasHolder, canvas)

		const args = Object.assign(runPpArgs, runPpMethods)

		await blocklazyload(args).then(block => {
			//access the block methods
			this.block = block
		})

		/** this won't work, will duplicate the chunk for block, try named chunk
		import('./block').then(p=>{
			this.block = new p.Block(arg2)
		}) */
	}
}
