import Ring from '#plots/disco/ring/Ring.ts'
import type Label from './Label.ts'
import LabelFactory from './LabelFactory.ts'
import type Settings from '#plots/disco/Settings.ts'

export default class Labels extends Ring<Label> {
	collisions?: Array<Label>
	settings: any
	elementsToDisplay: Array<Label> = []

	private hasPrioritizedGenes: boolean
	private overlapAngle: number

	constructor(settings: Settings, elements: Array<Label>, hasPrioritizedGenes: boolean) {
		super(
			settings.rings.labelLinesInnerRadius,
			settings.rings.labelsToLinesDistance,
			elements.sort((a, b) => {
				return a.startAngle < b.startAngle ? -1 : a.startAngle > b.startAngle ? 1 : 0
			})
		)

		this.settings = settings
		this.hasPrioritizedGenes = hasPrioritizedGenes

		const circumference = 2 * Math.PI * (settings.rings.labelLinesInnerRadius + settings.rings.labelsToLinesDistance)
		this.overlapAngle = (this.settings.label.overlapAngleFactor * this.settings.label.fontSize) / circumference

		this.calculateCollisions()
	}

	private calculateCollisions() {
		this.collisions = []

		let hasPrioritizedGenesList: Array<Label> = []
		hasPrioritizedGenesList = this.elements.filter(label => label.isPrioritized)

		if (this.settings.label.prioritizeGeneLabelsByGeneSets) {
			this.elementsToDisplay = this.getLabelsWithPrioritizedGenes(hasPrioritizedGenesList)
		} else if (this.hasPrioritizedGenes) {
			const prioritizedGenesList = this.elements.filter(label => label.isPrioritized)
			const filteredPrioritizedGenesList = this.getLabelsWithPrioritizedGenes(prioritizedGenesList)

			const withoutPrioritizedGenesList = this.elements.filter(label => !label.isPrioritized)

			const combinedAndSortedList = [...withoutPrioritizedGenesList, ...filteredPrioritizedGenesList].sort(
				(a, b) => a.startAngle - b.startAngle
			)

			this.elementsToDisplay = this.getAllLabels(combinedAndSortedList)
		} else {
			this.elementsToDisplay = this.getLabelsWithPrioritizedGenes(this.elements)
		}
	}

	private getLabelsWithPrioritizedGenes(elemenets: Array<Label>) {
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
			if (element.isPrioritized) {
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
		return elemenets.find((label, index) => label.isPrioritized && index > lastCancerGeneLabelIndex)
	}
}
