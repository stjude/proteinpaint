import type Reference from '#plots/disco/chromosome/Reference.ts'
import type Data from '#plots/disco/data/Data.ts'
import type SnvArc from './SnvArc.ts'
import MLabel from '#plots/disco/label/MLabel.ts'
import SnvLegendElement from './SnvLegendElement.ts'

export default class SnvArcsMapper {
	snvClassMap: Map<string, SnvLegendElement> = new Map()

	private sampleName: string
	private reference: Reference

	private onePxArcAngle: number
	private bpx: number
	private svnInnerRadius: number
	private svnWidth: number

	constructor(svnInnerRadius: number, svnWidth: number, sampleName: string, reference: Reference) {
		this.svnInnerRadius = svnInnerRadius
		this.svnWidth = svnWidth
		this.sampleName = sampleName
		this.reference = reference

		// number of base pairs per pixel
		this.bpx = Math.floor(this.reference.totalSize / (this.reference.totalChromosomesAngle * svnInnerRadius))
		this.onePxArcAngle = 1 / svnInnerRadius
	}

	map(exonicSnvDataMap: Map<number, Array<Data>>): Array<SnvArc> {
		const snvArray: Array<SnvArc> = []
		for (const angle of exonicSnvDataMap.keys()) {
			const array = exonicSnvDataMap.get(angle)
			if (array) {
				const arraySize = array.length

				for (let i = 0; i < array.length; i++) {
					const data = array[i]
					const snvLegendElement = this.snvClassMap.get(data.mClass)
					if (snvLegendElement) {
						this.snvClassMap.set(data.mClass, this.createSnvLegend(data.mClass, ++snvLegendElement.count))
					} else {
						this.snvClassMap.set(data.mClass, this.createSnvLegend(data.mClass, 1))
					}

					const startAngle = angle
					const endAngle = angle + this.onePxArcAngle

					const mLabel = MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass] : undefined

					const arc: SnvArc = {
						startAngle: startAngle,
						endAngle: endAngle,
						innerRadius: this.svnInnerRadius + (i * this.svnWidth) / arraySize,
						outerRadius: this.svnInnerRadius + ((i + 1) * this.svnWidth) / arraySize,
						color: mLabel.color,
						text: data.gene,
						dataClass: mLabel.label,
						mname: data.mname,
						chr: data.chr,
						pos: data.position,
						sampleName: [data.sampleName]
					}
					snvArray.push(arc)
				}
			}
		}
		return snvArray
	}

	private createSnvLegend(dataClass: string, count: number) {
		const mClass = MLabel.getInstance().mlabel[dataClass]
		return new SnvLegendElement(mClass.label, mClass.color, count)
	}
}
