import { Chromosome } from '../axes/Chromosome.ts'
import { font } from '#src/client'
import type { GridElementData } from './GridElementData.ts'
import type { ChrLookUp } from '../../../types/clientGenome.ts'
import type { GridElementDom } from './GridElementDom.ts'

export class Grid {
	static checkerFill = '#DEF3FA'
	static spaceColor = '#CCC'
	static fontSize = 15
	static font = font
	static borderWidth = 1
	static defaultChrLabWidth = 100

	chromosomeMatrix: Map<string, Map<string, GridElementData & Partial<GridElementDom>>> = new Map()
	chromosomeList: Chromosome[] = []
	totalpx: number
	xoff = 0
	yoff = 0

	private chrlst: string[]
	private chr2px: any = []

	constructor(chrlst: string[], resolution: number, chrlookup: ChrLookUp, binpx: number) {
		this.chrlst = chrlst

		let totalpx = this.chrlst.length
		for (const chr of this.chrlst) {
			const w = Math.ceil(chrlookup[chr.toUpperCase()].len / resolution) * binpx
			const chromosome = new Chromosome(chr, w)
			this.chromosomeList.push(chromosome)
			this.chr2px[chr] = w
			totalpx += w
		}

		this.totalpx = totalpx

		for (let i = 0; i < this.chrlst.length; i++) {
			//chrx = 1st chromosome = chromosome on x axis
			const chrx = this.chrlst[i]
			this.chromosomeMatrix.set(chrx, new Map())
			let yoff = 0
			for (let j = 0; j <= i; j++) {
				// chry = 2nd chromosome = chromosome on y axis
				const chry = this.chrlst[j]

				const chrxChrLen = chrlookup[chrx.toUpperCase()].len
				const chryChrLen = chrlookup[chry.toUpperCase()].len

				const xbins = Math.ceil(chrxChrLen / resolution) * binpx
				const ybins = Math.ceil(chryChrLen / resolution) * binpx

				this.chromosomeMatrix.get(chrx)!.set(chry, {
					x: this.xoff,
					y: yoff,
					xbins,
					ybins,
					data: [] //Empty array of data to fill later
				})
				yoff += this.chr2px[chry] + Grid.borderWidth
			}
			this.yoff = yoff
			this.xoff += this.chr2px[chrx] + Grid.borderWidth
		}
	}
}
