import Data from './Data'
import Reference from './Reference'
import DataObjectMapper from './DataObjectMapper'
import Settings from '#plots/disco/Settings.ts'
import { ViewModelMapper } from '#plots/disco/mapper/ViewModelMapper'

export default class DataMapper {
	nonExonicSnvData: Array<Data> = []
	nonExonicInnerRadius = 0

	snvRingDataMap: Map<number, Array<Data>> = new Map()
	snvInnerRadius = 0

	snvData: Array<Data> = []
	bpx = 0
	onePxArcAngle = 0
	filteredSnvData: Array<Data> = []

	lohData: Array<Data> = []
	lohInnerRadius = 0

	cnvData: Array<Data> = []
	cnvInnerRadius = 0

	fusionData: Array<Data> = []
	fusionRadius = 0

	hasCancerGenes = false

	cnvMaxValue?: number = undefined
	cnvMinValue?: number = undefined

	lohMaxValue?: number = undefined
	lohMinValue?: number = undefined

	private settings: Settings
	private reference: Reference
	private sample: string
	private snvFilter: (data: Data) => boolean
	private fusionFilter: (data: Data) => boolean
	private cnvFilter: (data: Data) => boolean
	private lohFilter: (data: Data) => boolean
	private nonExonicFilter: (data: Data) => boolean
	private snvRingFilter: (data: Data) => boolean
	private dataObjectMapper: DataObjectMapper
	private lastInnerRadious: number

	private compareData = (a, b) => {
		const chrDiff = this.reference.chromosomesOrder.indexOf(a.chr) - this.reference.chromosomesOrder.indexOf(b.chr)
		if (chrDiff != 0) {
			return chrDiff
		}

		const aPos = a.pos ? a.pos : a.start

		const bPos = b.pos ? b.pos : b.start

		return aPos - bPos
	}

	constructor(settings: Settings, reference: Reference, sample: string, cancerGenes: Array<string>) {
		this.settings = settings
		this.reference = reference
		this.sample = sample
		this.lastInnerRadious = this.settings.rings.chromosomeInnerRadius

		this.snvFilter = (data: Data) => data.dt == settings.rings.snvFilterValue
		this.fusionFilter = (data: Data) => data.dt == settings.rings.fusionFilterValue
		this.cnvFilter = (data: Data) => data.dt == settings.rings.cnvFilterValue
		this.lohFilter = (data: Data) => data.dt == settings.rings.lohFilterValue
		this.nonExonicFilter = (data: Data) =>
			settings.rings.nonExonicFilterValues.includes(ViewModelMapper.snvClassLayer[data.mClass])
		this.snvRingFilter = (data: Data) =>
			settings.rings.snvRingFilters.includes(ViewModelMapper.snvClassLayer[data.mClass])
		this.dataObjectMapper = new DataObjectMapper(sample, cancerGenes)
	}

	map(data) {
		const dataArray: Array<Data> = []

		data.forEach((dObject) => {
			const instance = this.dataObjectMapper.map(dObject)

			if (instance.isCancerGene) {
				this.hasCancerGenes = true
			}

			dataArray.push(instance)
		})

		const sortedData = dataArray.sort(this.compareData)

		console.log('this.settings.rings.nonExonicRingEnabled', this.settings.rings.nonExonicRingEnabled)

		if (this.settings.rings.nonExonicRingEnabled) {
			sortedData.forEach((data) => {
				this.filterNonExonicSnvData(data)
			})
		}

		if (this.nonExonicSnvData.length > 0) {
			this.nonExonicInnerRadius = this.lastInnerRadious - this.settings.rings.ringWidth
			this.lastInnerRadious = this.nonExonicInnerRadius
		}

		sortedData.forEach((data) => {
			this.filterSnvs(data)
		})

		sortedData.forEach((data) => {
			this.filterLohs(data)
		})

		if (this.lohData.length > 0) {
			this.lohInnerRadius = this.lastInnerRadious - this.settings.rings.ringWidth
			this.lastInnerRadious = this.lohInnerRadius
		}

		sortedData.forEach((data) => {
			this.filterCnvs(data)
		})

		if (this.cnvData.length > 0) {
			this.cnvInnerRadius = this.lastInnerRadious - this.settings.rings.ringWidth
			this.lastInnerRadious = this.cnvInnerRadius
		}

		sortedData.forEach((data) => {
			this.filterFusion(data)
		})

		if (this.fusionData.length > 0) {
			this.fusionRadius = this.lastInnerRadious
		}
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
					this.snvInnerRadius = this.lastInnerRadious - this.settings.rings.ringWidth
					this.lastInnerRadious = this.snvInnerRadius

					// number of base pairs per pixel
					this.bpx = Math.floor(this.reference.totalSize / (this.reference.totalChromosomesAngle * this.snvInnerRadius))
					this.onePxArcAngle = 1 / this.snvInnerRadius
				}

				this.filteredSnvData.push(data)

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
			this.fusionData.push(data)
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
				this.reference.chromosomesOrder.findIndex((chromosomeOrder) => data.chr == chromosomeOrder)
			]

		const dataAnglePos = Math.floor(data.pos / this.bpx)

		return currentChromosome.startAngle + dataAnglePos * this.onePxArcAngle
	}
}
