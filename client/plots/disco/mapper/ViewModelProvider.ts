import Rings from '#plots/disco/viewmodel/Rings.ts'
import LabelsMapper from '#plots/disco/mapper/LabelsMapper.ts'
import Ring from '#plots/disco/viewmodel/Ring.ts'
import Labels from '#plots/disco/viewmodel/Labels.ts'
import NonExonicSnvArcsMapper from '#plots/disco/mapper/NonExonicSnvArcsMapper.ts'
import SnvArc from '#plots/disco/viewmodel/SnvArc.ts'
import SnvArcsMapper from '#plots/disco/mapper/SnvArcsMapper.ts'
import LohArcMapper from '#plots/disco/mapper/LohArcMapper.ts'
import LohArc from '#plots/disco/viewmodel/LohArc.ts'
import CnvArcsMapper from '#plots/disco/mapper/CnvArcsMapper.ts'
import CnvArc from '#plots/disco/viewmodel/CnvArc.ts'
import DataMapper from '#plots/disco/mapper/DataMapper.ts'
import Settings from '#plots/disco/viewmodel/Settings.ts'
import Reference from '#plots/disco/mapper/Reference.ts'
import Legend from '#plots/disco/viewmodel/Legend.ts'
import FusionMapper from '#plots/disco/mapper/FusionMapper.ts'
import LohLegend from '#plots/disco/viewmodel/LohLegend.ts'
import Data from '#plots/disco/mapper/Data.ts'
import ViewModel from '#plots/disco/viewmodel/ViewModel.ts'

export default class ViewModelProvider {
	private settings: Settings
	private reference: Reference
	private sampleName: string
	private dataMapper: DataMapper

	private nonExonicArcRing?: Ring<SnvArc> = undefined
	private snvArcsMapper?: SnvArcsMapper
	private snvArcRing?: Ring<SnvArc>
	private lohArcRing?: Ring<LohArc>
	private cnvArcsMapper?: CnvArcsMapper
	private cnvArcRing?: Ring<CnvArc>

	constructor(settings: Settings, dataMapper: DataMapper, reference: Reference, sampleName: string) {
		this.settings = settings
		this.dataMapper = dataMapper
		this.reference = reference
		this.sampleName = sampleName
	}

	map(data: Array<Data>) {
		this.dataMapper.map(data)

		const labelsMapper = new LabelsMapper(this.settings, this.sampleName, this.reference)

		const labelsData = labelsMapper.map(this.dataMapper.filteredSnvData)

		const labelsRing = new Labels(this.settings, labelsData, this.dataMapper.hasCancerGenes)

		const chromosomesRing = new Ring(
			this.settings.rings.chromosomeInnerRadius,
			this.settings.rings.chromosomeWidth,
			this.reference.chromosomes
		)

		const nonExonicSnvArcsMapper = new NonExonicSnvArcsMapper(
			this.dataMapper.nonExonicInnerRadius,
			this.settings.rings.ringWidth,
			this.sampleName,
			this.reference
		)

		const nonExonicData = nonExonicSnvArcsMapper.map(this.dataMapper.nonExonicSnvData)

		if (nonExonicData.length > 0) {
			this.nonExonicArcRing = new Ring(
				this.dataMapper.nonExonicInnerRadius,
				this.settings.rings.ringWidth,
				nonExonicData
			)
		}

		this.snvArcsMapper = new SnvArcsMapper(
			this.dataMapper.snvInnerRadius,
			this.settings.rings.ringWidth,
			this.sampleName,
			this.reference
		)
		const snvData = this.snvArcsMapper.map(this.dataMapper.snvRingDataMap)
		if (snvData.length > 0) {
			this.snvArcRing = new Ring(this.dataMapper.snvInnerRadius, this.settings.rings.ringWidth, snvData)
		}

		const lohMapper = new LohArcMapper(
			this.dataMapper.lohInnerRadius,
			this.settings.rings.ringWidth,
			this.sampleName,
			this.reference
		)
		const lohData = lohMapper.map(this.dataMapper.lohData)
		if (lohData.length > 0) {
			this.lohArcRing = new Ring(this.dataMapper.lohInnerRadius, this.settings.rings.ringWidth, lohData)
		}

		this.cnvArcsMapper = new CnvArcsMapper(
			this.dataMapper.cnvInnerRadius,
			this.settings.rings.ringWidth,
			this.settings,
			this.sampleName,
			this.reference,
			this.dataMapper.cnvMaxValue,
			this.dataMapper.cnvMinValue,
			this.settings.cnv.unit
		)

		const cnvData = this.cnvArcsMapper.map(this.dataMapper.cnvData)
		if (cnvData.length > 0) {
			this.cnvArcRing = new Ring(this.dataMapper.cnvInnerRadius, this.settings.rings.ringWidth, cnvData)
		}

		const fusionMapper = new FusionMapper(this.dataMapper.fusionRadius, this.sampleName, this.reference)

		const fusions = fusionMapper.map(this.dataMapper.fusionData)

		let lohLegend: LohLegend | undefined

		if (this.settings.legend.lohLegendEnabled && this.dataMapper.lohMinValue && this.dataMapper.lohMaxValue) {
			lohLegend = new LohLegend(this.dataMapper.lohMinValue, this.dataMapper.lohMaxValue)
		}

		const legend = new Legend(
			this.settings.legend.snvTitle,
			this.settings.legend.cnvTitle,
			this.settings.legend.lohTitle,
			this.settings.legend.fusionTitle,
			this.snvArcsMapper ? this.snvArcsMapper.snvClassMap : new Map(),
			this.cnvArcsMapper ? this.cnvArcsMapper.cnvClassMap : new Map(),
			fusions.length > 0,
			lohLegend
		)

		const rings = new Rings(
			labelsRing,
			chromosomesRing,
			this.nonExonicArcRing,
			this.snvArcRing,
			this.cnvArcRing,
			this.lohArcRing
		)

		return new ViewModel(this.settings, rings, legend, fusions)
	}
}
