import type Chromosome from './Chromosome.ts'
import type Settings from '../Settings.ts'

export default class Reference {
	chromosomes: Array<Chromosome> = []
	chromosomesOrder: Array<string> = []
	totalSize: number

	totalPadAngle: number
	totalChromosomesAngle: number

	private keysArray: Array<string> = []
	private totalSizeArray: Array<number> = []
	private chrSizesArray: Array<number> = []

	private settings: Settings

	/**
	 * Creates a Reference object that contains information about chromosomes.
	 * @param settings State settings
	 * @param chromosomes Chromosome order. This function formats into an obj with `chr` removed.
	 * @param chromosomeOverride Obj of chromsome keys and sizes. Filtered to remove hidden chromosomes in settings.
	 */
	constructor(
		settings: Settings,
		chromosomes: string[] | { [chromosome: string]: number },
		chromosomeOverride?: { [chromosome: string]: number }
	) {
		const chrSizes = chromosomeOverride || chromosomes

		this.settings = settings

		this.chromosomesOrder = []
		let totalSize = 0
		this.totalPadAngle = Object.keys(chrSizes).length * this.settings.padAngle
		this.totalChromosomesAngle = 2 * Math.PI - this.totalPadAngle

		for (const chr in chrSizes) {
			const key = chr.slice(0, 3) === 'chr' ? chr.slice(3) : chr
			this.chromosomesOrder.push(chr)
			this.keysArray.push(key)
			this.totalSizeArray.push(totalSize)
			this.chrSizesArray.push(chrSizes[chr])

			totalSize += chrSizes[chr]
		}

		this.totalSize = totalSize

		let lastAngle = 0

		for (let i = 0; i < this.keysArray.length; i++) {
			const chromosomeAngle = this.totalChromosomesAngle * (this.chrSizesArray[i] / totalSize)

			const startAngle = i == 0 ? this.settings.padAngle / 2 : lastAngle + this.settings.padAngle
			const endAngle =
				i == 0 ? this.settings.padAngle / 2 + chromosomeAngle : lastAngle + this.settings.padAngle + chromosomeAngle
			const chromosome: Chromosome = {
				start: this.totalSizeArray[i],
				size: this.chrSizesArray[i],
				factor: 1,
				startAngle: startAngle,
				endAngle: endAngle,
				angle: (startAngle + endAngle) / 2,
				innerRadius: this.settings.rings.chromosomeInnerRadius,
				outerRadius: this.settings.rings.chromosomeInnerRadius + this.settings.rings.chromosomeWidth,
				color: '#AAA',
				text: this.keysArray[i]
			}

			this.chromosomes.push(chromosome)

			if (chromosome.endAngle != null) {
				lastAngle = chromosome.endAngle
			}
		}
	}
}
