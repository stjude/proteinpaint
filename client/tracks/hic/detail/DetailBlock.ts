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

	setMethods(canvas: any, sheath?: any) {
		const runPpMethods = {
			onloadalltk_always: () => this.onload(canvas, sheath),
			onpanning: (xoff: number) => this.onpanning(xoff, canvas, this.isYblock)
		}
		if (this.isYblock) {
			//Button row height default is 30
			runPpMethods['onsetheight'] = (bbh: number) => {
				this.holder.transition().style('height', `${bbh + this.bbmargin + 30}px`)
			}
		}
		return runPpMethods
	}

	onload(canvas: any, sheath?: any) {
		if (this.isYblock) sheath.transition().style('height', `${this.bbw}px`)
		if (this.firstRender) {
			this.firstRender = false
			if (!this.isYblock) {
				canvas.transition().style('left', `${this.defaultLeft}px`)
			} else {
				canvas.transition().style('top', `${this.defaultTop}px`)
			}
		}
		//TODO: recreate detailViewUpdateRegionFromBlock function
	}

	onpanning(xoff: number, canvas: any, isYBlock: boolean) {
		if (isYBlock) canvas.style('left', `${xoff + this.defaultLeft}px`)
		else canvas.style('top', `${-xoff + this.defaultTop}px`)
	}

	loadBlock(chrObj: ChrPosition, canvas: any, sheath?: any) {
		const runPpArgs = this.setArgs(chrObj)
		const runPpMethods = this.isYblock ? this.setMethods(canvas, sheath) : this.setMethods(canvas)

		const args = Object.assign(runPpArgs, runPpMethods)

		blocklazyload(args).then(block => {
			//access the block methods
			this.block = block
		})

		/** this won't work, will duplicate the chunk for block, try named chunk
		import('./block').then(p=>{
			this.block = new p.Block(arg2)
		}) */
	}
}
