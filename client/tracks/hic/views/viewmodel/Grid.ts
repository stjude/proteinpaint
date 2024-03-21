import { Chromosome } from './Chromosome.ts'
import { font } from '#src/client'
import { GridElementData } from './GridElementData.ts'

export class Grid {
	static checkerFill = '#DEF3FA'
	static spaceColor = '#CCC'
	static fontSize = 15
	static font = font
	static borderWidth = 1
	static defaultChrLabWidth = 100

	chromosomeMatrix: Map<string, Map<string, GridElementData>> = new Map()
	chromosomeList: Chromosome[] = []
	totalpx: number
	xoff: number
	yoff: number

	private chrlst: string[]
	private chr2px: any = []

	constructor(chrlst: string[], resolution: number, chrlookup: any, binpx: number) {
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

		this.xoff = 0
		this.yoff = 0
		for (let i = 0; i < this.chrlst.length; i++) {
			//Lead = 1st chromosome = x chromosome
			const lead = this.chrlst[i]
			this.chromosomeMatrix.set(lead, new Map())

			for (let j = 0; j <= i; j++) {
				// follow = 2nd chromosome = y chromosome
				const follow = this.chrlst[j]

				const gridElem = this.chromosomeMatrix.get(lead)!.get(follow)
				if (gridElem) {
					const leadchrlen = chrlookup[lead.toUpperCase()].len
					const followchrlen = chrlookup[follow.toUpperCase()].len

					const xbins = Math.ceil(leadchrlen / resolution)
					const ybins = Math.ceil(followchrlen / resolution)

					this.chromosomeMatrix.get(lead)!.set(follow, {
						x: this.xoff,
						y: this.yoff,
						xbins: xbins * binpx,
						ybins: ybins * binpx
					})
				}

				this.yoff += this.chr2px[follow] + Grid.borderWidth
			}
			this.xoff += this.chr2px[lead] + Grid.borderWidth
		}
	}
}
