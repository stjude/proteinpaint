import { Chromosome } from './Chromosome.ts'

export class Grid {
	static fontSize = 15
	static checker_fill = '#DEF3FA'

	chromosomeList: Array<Chromosome> = []
	totalpx: number

	private chrlst: string[]

	private chromosomeMatrix: any
	private chr2px: any = []

	constructor(chrlst: string[], resolution: number, chrlookup: any, binpx) {
		console.log('chrlookup', chrlookup)
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
		console.log('totalpx', totalpx)
		console.log('this.chromosomeList', this.chromosomeList)
	}
}
