import Settings from '../Settings'
import Reference from '../chromosome/Reference'
import Legend from '../legend/Legend'
import FusionMapper from '../fusion/FusionMapper'
import LohLegend from '../loh/LohLegend'
import ViewModel from './ViewModel'
import DataMapper from '#plots/disco/data/DataMapper'
import Ring from '#plots/disco/ring/Ring'
import SnvArcsMapper from '#plots/disco/snv/SnvArcsMapper'
import SnvArc from '#plots/disco/snv/SnvArc'
import LohArc from '#plots/disco/loh/LohArc'
import CnvArcsMapper from '#plots/disco/cnv/CnvArcsMapper'
import CnvArc from '#plots/disco/cnv/CnvArc'
import LabelsMapper from '#plots/disco/label/LabelsMapper'
import Labels from '#plots/disco/label/Labels'
import NonExonicSnvArcsMapper from '#plots/disco/snv/NonExonicSnvArcsMapper'
import LohArcMapper from '#plots/disco/loh/LohArcMapper'
import Rings from '#plots/disco/ring/Rings'

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

	map(data: Array<any>) {
		const dataHolder = this.dataMapper.map(data)

		const labelsMapper = new LabelsMapper(this.settings, this.sampleName, this.reference)

		const labelsData = labelsMapper.map(dataHolder.labelData)

		const labelsRing = new Labels(this.settings, labelsData, dataHolder.hasCancerGenes)

		const chromosomesRing = new Ring(
			this.settings.rings.chromosomeInnerRadius,
			this.settings.rings.chromosomeWidth,
			this.reference.chromosomes
		)

		const nonExonicSnvArcsMapper = new NonExonicSnvArcsMapper(
			dataHolder.nonExonicInnerRadius,
			this.settings.rings.nonExonicRingWidth,
			this.sampleName,
			this.reference
		)

		const nonExonicData = nonExonicSnvArcsMapper.map(dataHolder.nonExonicSnvData)

		if (nonExonicData.length > 0) {
			this.nonExonicArcRing = new Ring(
				dataHolder.nonExonicInnerRadius,
				this.settings.rings.nonExonicRingWidth,
				nonExonicData
			)
		}

		this.snvArcsMapper = new SnvArcsMapper(
			dataHolder.snvInnerRadius,
			this.settings.rings.snvRingWidth,
			this.sampleName,
			this.reference
		)
		const snvData = this.snvArcsMapper.map(dataHolder.snvRingDataMap)
		if (snvData.length > 0) {
			this.snvArcRing = new Ring(dataHolder.snvInnerRadius, this.settings.rings.snvRingWidth, snvData)
		}

		const lohMapper = new LohArcMapper(
			dataHolder.lohInnerRadius,
			this.settings.rings.lohRingWidth,
			this.sampleName,
			this.reference
		)
		const lohData = lohMapper.map(dataHolder.lohData)
		if (lohData.length > 0) {
			this.lohArcRing = new Ring(dataHolder.lohInnerRadius, this.settings.rings.lohRingWidth, lohData)
		}

		this.cnvArcsMapper = new CnvArcsMapper(
			dataHolder.cnvInnerRadius,
			this.settings.rings.cnvRingWidth,
			this.settings,
			this.sampleName,
			this.reference,
			dataHolder.cnvMaxValue,
			dataHolder.cnvMinValue,
			this.settings.cnv.unit
		)

		const cnvData = this.cnvArcsMapper.map(dataHolder.cnvData)
		if (cnvData.length > 0) {
			this.cnvArcRing = new Ring(dataHolder.cnvInnerRadius, this.settings.rings.cnvRingWidth, cnvData)
		}

		const fusionMapper = new FusionMapper(dataHolder.fusionRadius, this.sampleName, this.reference)

		const fusions = fusionMapper.map(dataHolder.fusionData)

		let lohLegend: LohLegend | undefined

		if (this.settings.legend.lohLegendEnabled && dataHolder.lohMinValue && dataHolder.lohMaxValue) {
			lohLegend = new LohLegend(dataHolder.lohMinValue, dataHolder.lohMaxValue)
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
