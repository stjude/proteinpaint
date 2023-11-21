import Data from './Data.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import DataObjectMapper from './DataObjectMapper.ts'
import Settings from '#plots/disco/Settings.ts'
import { ViewModelMapper } from '#plots/disco/viewmodel/ViewModelMapper.ts'
import { DataHolder } from '#plots/disco/data/DataHolder.ts'
import { MutationTypes } from '#plots/disco/data/MutationTypes.ts'

export default class DataMapper {
	// remove fields and extract filters to seperate classes

	private labelData: Array<Data> = []

	private nonExonicSnvData: Array<Data> = []
	private nonExonicInnerRadius = 0

	private snvRingDataMap: Map<number, Array<Data>> = new Map()
	private snvInnerRadius = 0

	private snvData: Array<Data> = []
	private bpx = 0
	private onePxArcAngle = 0
	private filteredSnvData: Array<Data> = []

	private lohData: Array<Data> = []
	private lohInnerRadius = 0

	private cnvData: Array<Data> = []
	private cnvInnerRadius = 0

	private fusionData: Array<Data> = []
	private fusionRadius = 0

	private hasPrioritizedGenes = false

	private cnvMaxValue?: number = undefined
	private cnvMinValue?: number = undefined

	private lohMaxValue?: number = undefined
	private lohMinValue?: number = undefined

	private settings: Settings
	private reference: Reference
	private sample: string

	private nonExonicFilter: (data: Data) => boolean
	private snvRingFilter: (data: Data) => boolean
	private dataObjectMapper: DataObjectMapper
	private lastInnerRadious: number

	private snvFilter = (data: Data) => data.dt == MutationTypes.SNV
	private fusionFilter = (data: Data) => data.dt == MutationTypes.FUSION || data.dt == MutationTypes.SV

	private cnvFilter = (data: Data) => data.dt == MutationTypes.CNV
	private lohFilter = (data: Data) => data.dt == MutationTypes.LOH

	private compareData = (a, b) => {
		const chrDiff = this.reference.chromosomesOrder.indexOf(a.chr) - this.reference.chromosomesOrder.indexOf(b.chr)
		if (chrDiff != 0) {
			return chrDiff
		}

		const aPos = a.pos ? a.pos : a.start

		const bPos = b.pos ? b.pos : b.start

		return aPos - bPos
	}

	constructor(settings: Settings, reference: Reference, sample: string, prioritizedGenes: Array<string> = []) {
		this.settings = settings
		this.reference = reference
		this.sample = sample
		this.lastInnerRadious = this.settings.rings.chromosomeInnerRadius

		this.nonExonicFilter = (data: Data) =>
			settings.rings.nonExonicFilterValues.includes(ViewModelMapper.snvClassLayer[data.mClass])

		this.snvRingFilter = (data: Data) => {
			if (prioritizedGenes.length > 0 && this.settings.label.prioritizeGeneLabelsByGeneSets) {
				return (
					prioritizedGenes.includes(data.gene) &&
					settings.rings.snvRingFilters.includes(ViewModelMapper.snvClassLayer[data.mClass])
				)
			} else {
				return settings.rings.snvRingFilters.includes(ViewModelMapper.snvClassLayer[data.mClass])
			}
		}

		this.dataObjectMapper = new DataObjectMapper(sample, prioritizedGenes)
	}

	map(data: any) {
		const dataArray: Array<Data> = []

		data.forEach(dObject => {
			const index = this.reference.chromosomesOrder.indexOf(dObject.chr)
			const indexA = this.reference.chromosomesOrder.indexOf(dObject.chrA)
			const indexB = this.reference.chromosomesOrder.indexOf(dObject.chrB)

			if (dObject.dt == MutationTypes.SNV) {
				if (index != -1 && this.snvData.length < this.settings.snv.maxMutationCount) {
					this.addData(dObject, dataArray)
				}
			} else if (dObject.dt == MutationTypes.FUSION || dObject.dt == MutationTypes.SV) {
				if (indexA != -1 && indexB != -1) {
					this.addData(dObject, dataArray)
				}
			} else if ([MutationTypes.CNV, MutationTypes.LOH].includes(Number(dObject.dt))) {
				this.addData(dObject, dataArray)
			} else {
				throw Error('Unknown mutation type!')
			}
		})

		const sortedData = dataArray.sort(this.compareData)

		if (this.settings.rings.nonExonicRingEnabled) {
			sortedData.forEach(data => {
				this.filterNonExonicSnvData(data)
			})
		}

		if (this.nonExonicSnvData.length > 0) {
			this.nonExonicInnerRadius = this.lastInnerRadious - this.settings.rings.nonExonicRingWidth
			this.lastInnerRadious = this.nonExonicInnerRadius
		}

		sortedData.forEach(data => {
			this.filterSnvs(data)
		})

		sortedData.forEach(data => {
			this.filterLohs(data)
		})

		if (this.lohData.length > 0) {
			this.lohInnerRadius = this.lastInnerRadious - this.settings.rings.lohRingWidth
			this.lastInnerRadious = this.lohInnerRadius
		}

		sortedData.forEach(data => {
			this.filterCnvs(data)
		})

		if (this.cnvData.length > 0) {
			this.cnvInnerRadius = this.lastInnerRadious - this.settings.rings.cnvRingWidth
			this.lastInnerRadious = this.cnvInnerRadius
		}

		sortedData.forEach(data => {
			this.filterFusion(data)
		})

		if (this.fusionData.length > 0) {
			this.fusionRadius = this.lastInnerRadious
		}

		const dataHolder: DataHolder = {
			labelData: this.labelData,
			nonExonicSnvData: this.nonExonicSnvData,
			nonExonicInnerRadius: this.nonExonicInnerRadius,
			snvRingDataMap: this.snvRingDataMap,
			snvInnerRadius: this.snvInnerRadius,

			snvData: this.snvData,
			bpx: this.bpx,
			onePxArcAngle: this.onePxArcAngle,
			filteredSnvData: this.filteredSnvData,

			lohData: this.lohData,
			lohInnerRadius: this.lohInnerRadius,

			cnvData: this.cnvData,
			cnvInnerRadius: this.cnvInnerRadius,

			fusionData: this.fusionData,
			fusionRadius: this.fusionRadius,

			hasPrioritizedGenes: this.hasPrioritizedGenes,

			cnvMaxValue: this.cnvMaxValue,
			cnvMinValue: this.cnvMinValue,

			lohMaxValue: this.lohMaxValue,
			lohMinValue: this.lohMinValue
		}

		return dataHolder
	}

	private addData(dObject, dataArray: Array<Data>) {
		const instance = this.dataObjectMapper.map(dObject)

		if (instance.isPrioritized) {
			this.hasPrioritizedGenes = true
		}

		dataArray.push(instance)
	}

	private filterNonExonicSnvData(data: Data) {
		if (this.snvFilter(data)) {
			if (this.settings.rings.nonExonicRingEnabled && this.nonExonicFilter(data)) {
				this.nonExonicSnvData.push(data)
			}
		}
	}

	private filterSnvs(data: Data) {
		if (this.snvFilter(data)) {
			this.snvData.push(data)

			if (this.snvRingFilter(data)) {
				if (this.snvInnerRadius == 0) {
					this.snvInnerRadius = this.lastInnerRadious - this.settings.rings.snvRingWidth
					this.lastInnerRadious = this.snvInnerRadius

					// number of base pairs per pixel
					this.bpx = Math.floor(this.reference.totalSize / (this.reference.totalChromosomesAngle * this.snvInnerRadius))
					this.onePxArcAngle = 1 / this.snvInnerRadius
				}

				this.filteredSnvData.push(data)
				this.labelData.push(data)

				const arcAngle = this.calculateArcAngle(data)
				let dataArray = this.snvRingDataMap.get(arcAngle)
				if (!dataArray) {
					dataArray = new Array<Data>()
				}
				dataArray.push(data)
				this.snvRingDataMap.set(arcAngle, dataArray)
			}
		}
	}

	private filterFusion(data: Data) {
		if (this.fusionFilter(data)) {
			data.isPrioritized = true
			this.fusionData.push(data)
			this.labelData.push(data)
		}
	}

	private filterLohs(data: Data) {
		if (this.lohFilter(data)) {
			if (this.lohMaxValue == undefined || this.lohMaxValue < data.value) {
				this.lohMaxValue = data.segmean
			}

			if (this.lohMinValue == undefined || this.lohMinValue > data.value) {
				this.lohMinValue = data.segmean
			}

			this.lohData.push(data)
		}
	}

	private filterCnvs(data: Data) {
		if (this.cnvFilter(data)) {
			if (this.cnvMaxValue == undefined || this.cnvMaxValue < data.value) {
				this.cnvMaxValue = data.value
			}

			if (this.cnvMinValue == undefined || this.cnvMinValue > data.value) {
				this.cnvMinValue = data.value
			}

			this.cnvData.push(data)
		}
	}

	private calculateArcAngle(data: Data) {
		const currentChromosome =
			this.reference.chromosomes[
				this.reference.chromosomesOrder.findIndex(chromosomeOrder => data.chr == chromosomeOrder)
			]

		const dataAnglePos = Math.floor(data.position / this.bpx)

		return currentChromosome.startAngle + dataAnglePos * this.onePxArcAngle
	}
}
