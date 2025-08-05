import type Data from './Data.ts'
import type Reference from '#plots/disco/chromosome/Reference.ts'
import DataObjectMapper from './DataObjectMapper.ts'
import type Settings from '#plots/disco/Settings.ts'
import { ViewModelMapper } from '#plots/disco/viewmodel/ViewModelMapper.ts'
import type { DataHolder } from '#plots/disco/data/DataHolder.ts'
import { dtsnvindel, dtfusionrna, dtsv, dtcnv, dtloh } from '#shared/common.js'
import { PercentileMapper } from '#plots/disco/data/PercentileMapper.ts'

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

	private invalidEntries: { dataType: string; reason: string }[] = []

	private cnvLossMaxValue = 0
	private cnvGainMaxValue = 0
	private gainCapped: number
	private lossCapped: number
	private cappedCnvMaxAbsValue?: number
	private percentilePositive = 0
	private percentileNegative = 0
	private cnvMaxPercentileAbs = 0

	private lohMaxValue?: number = undefined
	private lohMinValue?: number = undefined

	private settings: Settings
	private reference: Reference
	private sample: string

	private nonExonicFilter: (data: Data) => boolean
	private snvRingFilter: (data: Data) => boolean
	private dataObjectMapper: DataObjectMapper
	private lastInnerRadious: number
	private excludedChromosomes: string[]

	private snvFilter = (data: Data) => data.dt == dtsnvindel
	private fusionFilter = (data: Data) => data.dt == dtfusionrna || data.dt == dtsv

	private cnvFilter = (data: Data) => data.dt == dtcnv
	private lohFilter = (data: Data) => data.dt == dtloh

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
		this.excludedChromosomes = this.settings.Disco.hiddenChromosomes
		this.lastInnerRadious = this.settings.rings.chromosomeInnerRadius

		this.gainCapped = this.settings.Disco.cnvCapping
		this.lossCapped = -1 * this.settings.Disco.cnvCapping

		this.nonExonicFilter = (data: Data) => {
			if (prioritizedGenes.length > 0 && this.settings.Disco.prioritizeGeneLabelsByGeneSets) {
				return (
					prioritizedGenes.includes(data.gene) &&
					settings.rings.nonExonicFilterValues.includes(ViewModelMapper.snvClassLayer[data.mClass])
				)
			} else {
				return settings.rings.nonExonicFilterValues.includes(ViewModelMapper.snvClassLayer[data.mClass])
			}
		}

		this.snvRingFilter = (data: Data) => {
			if (prioritizedGenes.length > 0 && this.settings.Disco.prioritizeGeneLabelsByGeneSets) {
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

			if (dObject.dt == dtsnvindel) {
				if (index != -1 && this.snvData.length < this.settings.snv.maxMutationCount) {
					const pos = dObject.pos ?? dObject.position
					const chrSize = this.reference.chromosomes[index].size
					// ensure position is numeric and within chromosome range
					if (Number.isFinite(pos) && pos >= 0 && pos <= chrSize) {
						this.addData(dObject, dataArray)
					} else {
						this.invalidEntries.push({ dataType: 'SNV', reason: `Position ${pos} outside of ${dObject.chr}` })
					}
				} else if (index == -1) {
					if (!this.excludedChromosomes.includes(dObject.chr)) {
						this.invalidEntries.push({ dataType: 'SNV', reason: `Unknown chr ${dObject.chr}` })
					}
				}
			} else if (dObject.dt == dtfusionrna || dObject.dt == dtsv) {
				if (indexA != -1 && indexB != -1) {
					// show sv/fusion event with valid A/B breakpoints.
					const posA = dObject.posA
					const posB = dObject.posB
					const chrSizeA = this.reference.chromosomes[indexA].size
					const chrSizeB = this.reference.chromosomes[indexB].size
					// verify that both breakpoints are numeric and within chromosome ranges
					if (
						Number.isFinite(posA) &&
						Number.isFinite(posB) &&
						posA >= 0 &&
						posA <= chrSizeA &&
						posB >= 0 &&
						posB <= chrSizeB
					) {
						this.addData(dObject, dataArray)
					} else {
						const reasonParts: string[] = []
						if (!(Number.isFinite(posA) && posA >= 0 && posA <= chrSizeA))
							reasonParts.push(`Position ${posA} outside of ${dObject.chrA}`)
						if (!(Number.isFinite(posB) && posB >= 0 && posB <= chrSizeB))
							reasonParts.push(`Position ${posB} outside of ${dObject.chrB}`)
						this.invalidEntries.push({ dataType: 'Fusion', reason: reasonParts.join('; ') })
					}
				} else {
					const missing: string[] = []
					if (indexA == -1 && !this.excludedChromosomes.includes(dObject.chrA)) missing.push(dObject.chrA)
					if (indexB == -1 && !this.excludedChromosomes.includes(dObject.chrB)) missing.push(dObject.chrB)
					if (missing.length) this.invalidEntries.push({ dataType: 'Fusion', reason: 'Unknown chr in fusion' })
				}
			} else if ([dtcnv, dtloh].includes(Number(dObject.dt))) {
				const idx = this.reference.chromosomesOrder.indexOf(dObject.chr)
				if (dObject.chr && idx != -1) {
					const chrSize = this.reference.chromosomes[idx].size
					const start = dObject.start
					const stop = dObject.stop
					// validate CNV/LOH segment boundaries are numeric and fall within chromosome range
					if (Number.isFinite(start) && Number.isFinite(stop) && start >= 0 && stop <= chrSize && start <= stop) {
						this.addData(dObject, dataArray)
					} else {
						this.invalidEntries.push({
							dataType: dObject.dt == dtcnv ? 'CNV' : 'LOH',
							reason: `Position ${start}-${stop} outside of ${dObject.chr}`
						})
					}
				} else {
					if (!this.excludedChromosomes.includes(dObject.chr)) {
						this.invalidEntries.push({
							dataType: dObject.dt == dtcnv ? 'CNV' : 'LOH',
							reason: `Unknown chr ${dObject.chr}`
						})
					}
				}
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

			this.cappedCnvMaxAbsValue = Math.min(
				this.settings.Disco.cnvCapping,
				Math.max(
					Math.abs(DataMapper.capMaxValue(this.cnvLossMaxValue, this.gainCapped, this.lossCapped)),
					Math.abs(DataMapper.capMaxValue(this.cnvGainMaxValue, this.gainCapped, this.lossCapped))
				)
			)

			const percentilePair = new PercentileMapper().map(
				this.cnvData.map(data => data.value),
				this.settings.Disco.cnvPercentile
			)
			this.percentilePositive = DataMapper.capMaxValue(percentilePair.positive, this.gainCapped, this.lossCapped)
			this.percentileNegative = DataMapper.capMaxValue(percentilePair.negative, this.gainCapped, this.lossCapped)

			this.cnvMaxPercentileAbs = Math.min(
				this.settings.Disco.cnvCapping,
				Math.max(this.percentilePositive, Math.abs(this.percentileNegative))
			)
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

			cnvGainMaxValue: this.cnvGainMaxValue,
			cnvLossMaxValue: this.cnvLossMaxValue,
			cappedCnvMaxAbsValue: this.cappedCnvMaxAbsValue,
			percentilePositive: this.percentilePositive,
			percentileNegative: this.percentileNegative,
			cnvMaxPercentileAbs: this.cnvMaxPercentileAbs,

			lohMaxValue: this.lohMaxValue,
			lohMinValue: this.lohMinValue,
			invalidDataInfo: {
				entries: this.invalidEntries,
				errorMsg: `Entries listed above were skipped due to invalid or unsupported chromosome information.`
			}
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
					// TODO verify place of bpx calculation
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
			if (!data.chr || this.reference.chromosomesOrder.indexOf(data.chr) == -1) {
				// when chr is unknown or not in reference chromosomes (chr1-22, X, Y), do not render arc
				return
			}

			if (this.cnvGainMaxValue == undefined || this.cnvGainMaxValue < data.value) {
				this.cnvGainMaxValue = data.value
			}

			if (this.cnvLossMaxValue == undefined || this.cnvLossMaxValue > data.value) {
				this.cnvLossMaxValue = data.value
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

	static capMaxValue(value: number, gainCapped: number, lossCapped: number) {
		if (value && Math.sign(value) == 1) {
			return value > gainCapped ? gainCapped : value
		}

		if (Math.sign(value) == -1) {
			return value < lossCapped ? lossCapped : value
		}

		return 0
	}

	static capMinValue(value: number, capMinValue = 1) {
		if (Math.sign(value) == 1) {
			return value > capMinValue ? value : capMinValue
		}

		if (Math.sign(value) == -1) {
			return value < -1 * capMinValue ? value : -1 * capMinValue
		}

		return 1
	}
}
