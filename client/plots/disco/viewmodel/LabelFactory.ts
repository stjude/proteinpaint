import Label from './Label'
import Point from './Point'
import Line from './Line'
import Mutation from '#plots/disco/viewmodel/Mutation.ts'

export default class LabelFactory {
	static createLabel(
		startAngle: number,
		endAngle: number,
		innerRadius: number,
		outerRadius: number,
		value: number,
		label: string,
		mname: string,
		color: string,
		dataClass: string,
		chr: string,
		position: number,
		isCancerGene = false,
		labelsToLinesGap: number
	) {
		const angle = (startAngle + endAngle) / 2
		const ccAngle = angle - Math.PI / 2
		const transform = `rotate(${(angle * 180) / Math.PI - 90}) translate(${outerRadius})${
			angle > Math.PI ? 'rotate(180)' : ''
		}`
		const textAnchor = angle > Math.PI ? 'end' : ''
		const r0 = innerRadius
		const r1 = outerRadius - labelsToLinesGap

		const points: Array<Point> = []
		points.push(new Point(r0 * Math.cos(ccAngle), r0 * Math.sin(ccAngle)))
		points.push(new Point(r1 * Math.cos(ccAngle), r1 * Math.sin(ccAngle)))

		const line = new Line(points, color)

		return new Label(
			startAngle,
			endAngle,
			innerRadius,
			outerRadius,
			angle,
			value,
			label,
			transform,
			textAnchor,
			ccAngle,
			line,
			isCancerGene,
			[new Mutation(mname, color, dataClass, chr, position)]
		)
	}

	static createMovedLabel(element: Label, overlap: number): Label {
		const startAngle = element.startAngle + overlap
		const endAngle = element.endAngle + overlap

		const angle = (startAngle + endAngle) / 2
		const ccAngle = angle - Math.PI / 2

		const r0 = element.innerRadius
		const r1 = element.outerRadius - 2
		const dr = (r1 - r0) / 3
		const cos0 = Math.cos(element.ccAngle)
		const sin0 = Math.sin(element.ccAngle)
		const cos1 = Math.cos(element.ccAngle + overlap)
		const sin1 = Math.sin(element.ccAngle + overlap)

		const points: Array<Point> = []

		points.push(new Point(r0 * cos0, r0 * sin0))
		points.push(new Point((r0 + dr) * cos0, (r0 + dr) * sin0))
		points.push(new Point((r0 + 2 * dr) * cos1, (r0 + 2 * dr) * sin1))
		points.push(new Point((r0 + 3 * dr) * cos1, (r0 + 3 * dr) * sin1))

		const line = new Line(points, element.color)

		const transform: string =
			'rotate(' +
			((angle * 180) / Math.PI - 90) +
			')' +
			'translate(' +
			element.outerRadius +
			')' +
			(angle > Math.PI ? 'rotate(180)' : '')

		const textAnchor = angle > Math.PI ? 'end' : ''

		return new Label(
			startAngle,
			endAngle,
			element.innerRadius,
			element.outerRadius,
			angle,
			element.value,
			element.text,
			transform,
			textAnchor,
			ccAngle,
			line,
			element.isCancerGene,
			element.mutations
		)
	}
}
