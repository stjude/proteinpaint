import Ring from './Ring'
import Label from './Label'
import LabelFactory from '#plots/disco/viewmodel/LabelFactory'
import Settings from './Settings'

export default class Labels<T extends Label> extends Ring<Label> {
	collisions?: Array<Label>
	settings: any
	elementsToDisplay: Array<Label> = []

	private hasCancerGenes: boolean
	private filteredHasCancerGenesList: Array<Label> = []
	private overlapAngle: number

	constructor(settings: Settings, elements: Array<Label>, hasCancerGenes: boolean) {
		super(
			settings.rings.labelLinesInnerRadius,
			settings.rings.labelsToLinesDistance,
			elements.sort((a, b) => {
				return a.startAngle < b.startAngle ? -1 : a.startAngle > b.startAngle ? 1 : 0
			})
		)

		this.settings = settings
		this.hasCancerGenes = hasCancerGenes

		const circumference = 2 * Math.PI * (settings.rings.labelLinesInnerRadius + settings.rings.labelsToLinesDistance)
		this.overlapAngle = (this.settings.label.overlapAngleFactor * this.settings.label.fontSize) / circumference

		this.calculateCollisions()
	}

	private calculateCollisions() {
		this.collisions = []

		let hasCancerGenesList: Array<Label> = []

		if (this.hasCancerGenes) {
			hasCancerGenesList = this.elements.filter((label) => label.isCancerGene)
			this.filteredHasCancerGenesList = this.getLabelsWithoutCancerGenes(hasCancerGenesList)

			const hasNoCancerGenes = this.elements.filter((label) => !label.isCancerGene)

			const combinedAndSortedList = hasNoCancerGenes.concat(this.filteredHasCancerGenesList).sort((a, b) => {
				return a.startAngle < b.startAngle ? -1 : a.startAngle > b.startAngle ? 1 : 0
			})

			this.elementsToDisplay = this.getAllLabels(combinedAndSortedList)
		} else {
			this.elementsToDisplay = this.getLabelsWithoutCancerGenes(this.elements)
		}
	}

	private getLabelsWithoutCancerGenes(elemenets: Array<Label>) {
		const filteredList: Array<Label> = []

		let prev = { endAngle: 0 }
		elemenets.forEach((element, index) => {
			if (index == 0) {
				filteredList.push(element)
				prev = element
			} else {
				const overlap = prev.endAngle - element.startAngle + this.overlapAngle

				if (overlap > 0 && overlap < this.settings.label.maxDeltaAngle) {
					const labelCopy = LabelFactory.createMovedLabel(element, overlap)
					filteredList?.push(labelCopy)
					prev = labelCopy
				}

				if (overlap <= 0) {
					filteredList.push(element)
					prev = element
				}
			}
		})

		return filteredList
	}

	private getAllLabels(elemenets: Array<Label>) {
		const filteredList: Array<Label> = []
		let prev = { endAngle: 0 }
		const elemenetsLength = elemenets.length
		let lastCancerGeneLabelIndex = -1

		for (let index = 0; index < elemenets.length; index++) {
			const element = elemenets[index]
			if (element.isCancerGene) {
				filteredList.push(element)
				lastCancerGeneLabelIndex = index
				prev = element
				continue
			}

			if (index == 0) {
				if (elemenetsLength > 1) {
					if (this.isElementOverlappingNextCancerGene(elemenets, lastCancerGeneLabelIndex, element, 0)) {
						continue
					}
					filteredList.push(element)
					prev = element
				}
				continue
			}

			const prevOverlap = prev.endAngle - element.startAngle + this.overlapAngle

			if (prevOverlap > 0 && prevOverlap < this.settings.label.maxDeltaAngle) {
				if (index == length - 1) {
					// last element
					filteredList.push(element)
					continue
				}

				if (this.isElementOverlappingNextCancerGene(elemenets, lastCancerGeneLabelIndex, element, prevOverlap)) {
					continue
				}

				const labelCopy = LabelFactory.createMovedLabel(element, prevOverlap)
				this.collisions?.push(labelCopy)
				filteredList.push(element)
				prev = labelCopy
			}

			if (prevOverlap <= 0) {
				if (this.isElementOverlappingNextCancerGene(elemenets, lastCancerGeneLabelIndex, element, 0)) {
					continue
				}

				filteredList.push(element)
				prev = element
			}
		}
		return filteredList
	}

	private isElementOverlappingNextCancerGene(
		elemenets: Array<Label>,
		lastCancerGeneLabelIndex: number,
		element: Label,
		prevOverlap: number
	) {
		const nextLabelWithCancerGene = this.getNextLabelWithCancerGene(elemenets, lastCancerGeneLabelIndex)
		if (nextLabelWithCancerGene) {
			const nextOverlap = element.endAngle + prevOverlap - nextLabelWithCancerGene.startAngle + this.overlapAngle
			if (nextOverlap > 0) {
				// skip element
				return true
			}
		}

		return false
	}

	private getNextLabelWithCancerGene(elemenets: Array<Label>, lastCancerGeneLabelIndex: number) {
		return elemenets.find((label, index) => label.isCancerGene && index > lastCancerGeneLabelIndex)
	}
}
