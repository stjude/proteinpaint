import type Reference from '#plots/disco/chromosome/Reference.ts'
import type MutationWaterfallPoint from './MutationWaterfallPoint.ts'
import type { MutationWaterfallDatum, MutationWaterfallLogRange } from './MutationWaterfallDatum.ts'

export default class MutationWaterfallMapper {
	private innerRadius: number
	private ringWidth: number
	private reference: Reference
	private logRange?: MutationWaterfallLogRange

	constructor(innerRadius: number, ringWidth: number, reference: Reference, logRange?: MutationWaterfallLogRange) {
		this.innerRadius = innerRadius
		this.ringWidth = ringWidth
		this.reference = reference
		this.logRange = logRange
	}

	map(data: Array<MutationWaterfallDatum> = []): Array<MutationWaterfallPoint> {
		if (!data.length) return []

		const min = this.logRange?.min ?? 0
		const max = this.logRange?.max ?? min + 1
		const span = max - min || 1

		const points: MutationWaterfallPoint[] = []
		for (const datum of data) {
			const chrIndex = this.reference.chromosomesOrder.indexOf(datum.chr)
			if (chrIndex === -1) continue

			const chromosome = this.reference.chromosomes[chrIndex]
			const chrAngleSpan = chromosome.endAngle - chromosome.startAngle
			const relPos = chromosome.size > 0 ? datum.position / chromosome.size : 0
			const angle = chromosome.startAngle + chrAngleSpan * relPos

			const normalized = Math.max(0, Math.min(1, (datum.logDistance - min) / span))
			const radius = this.innerRadius + this.ringWidth * normalized

			points.push({
				startAngle: angle,
				endAngle: angle,
				innerRadius: radius,
				outerRadius: radius,
				text: chromosome.text,
				color: '#4d4d4d',
				chr: datum.chr,
				position: datum.position,
				logDistance: datum.logDistance,
				ringInnerRadius: this.innerRadius,
				ringWidth: this.ringWidth,
				rangeMin: min,
				rangeMax: max
			})
		}

		return points
	}
}
