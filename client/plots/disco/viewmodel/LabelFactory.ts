import Label from './Label'
import Point from './Point'
import Line from './Line'
import MutationTooltip from '#plots/disco/viewmodel/MutationTooltip.ts'
import { arc } from 'd3'
import FusionTooltip from '#plots/disco/viewmodel/FusionTooltip.ts'

export default class LabelFactory {
	static createLabel(
		startAngle: number,
		endAngle: number,
		innerRadius: number,
		outerRadius: number,
		value: number,
		gene: string,
		color: string,
		dataClass: string,
		chr: string,
		position: number,
		isPrioritized = false,
		labelsToLinesGap: number,
		mutationTooltip?: MutationTooltip,
		fusionTooltip?: FusionTooltip
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

		const label: Label = {
			startAngle: startAngle,
			endAngle: endAngle,
			innerRadius: innerRadius,
			outerRadius: outerRadius,
			angle: angle,
			value: value,
			text: gene,
			color: color,
			transform: transform,
			textAnchor: textAnchor,
			ccAngle: ccAngle,
			line: line,
			isPrioritized,
			mutationsTooltip: mutationTooltip ? [mutationTooltip] : undefined,
			fusionTooltip: fusionTooltip ? [fusionTooltip] : undefined
		}

		return label
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

		const color = element.mutationsTooltip
			? element.mutationsTooltip[0].color
			: element.fusionTooltip
			? element.fusionTooltip[0].color
			: undefined

		const label: Label = {
			startAngle: startAngle,
			endAngle: endAngle,
			innerRadius: element.innerRadius,
			outerRadius: element.outerRadius,
			angle: angle,
			value: element.value,
			text: element.text,
			transform: transform,
			textAnchor: textAnchor,
			ccAngle: ccAngle,
			color: color,
			line: line,
			isPrioritized: element.isPrioritized,
			mutationsTooltip: element.mutationsTooltip,
			fusionTooltip: element.fusionTooltip
		}

		return label
	}
}
