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

			let mclass = 'SNV' 
			if (datum.type === 'CNV_amp') mclass = 'CNV_amp'
			else if (datum.type === 'CNV_loss') mclass = 'CNV_loss'
			
			let color = '#4d4d4d' 
			if (mclass === 'CNV_amp') color = '#FF4136' 
			else if (mclass === 'CNV_loss') color = '#0074D9' 

			const existing = points.find(p => 
				p.chr === datum.chr &&
				p.position === datum.position &&
				(p.class === 'CNV_amp' || p.class === 'CNV_loss')
			)

			if (existing) {
				existing.samples = [...(existing.samples ?? []), ...(datum.sample ? [datum.sample] : [])]
				continue 
			}



			points.push({
			startAngle: angle,
			endAngle: angle,
			innerRadius: radius,
			outerRadius: radius,
			text: chromosome.text,
			color: color,      
			class: mclass,     
			chr: datum.chr,
			position: datum.position,
			logDistance: datum.logDistance,
			ringInnerRadius: this.innerRadius,
			ringWidth: this.ringWidth,
			rangeMin: min,
			rangeMax: max,
			samples: datum.samples ?? (datum.sample ? [datum.sample] : [])
			})

		}

		return points
	}
}
