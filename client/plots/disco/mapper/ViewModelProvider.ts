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
import Label from '#plots/disco/viewmodel/Label.ts'

export default class ViewModelProvider {
	private settings: Settings
	private reference: Reference
	private sampleName: string
	private dataMapper: DataMapper

	constructor(settings: Settings, dataMapper: DataMapper, reference: Reference, sampleName: string) {
		this.settings = settings
		this.dataMapper = dataMapper
		this.reference = reference
		this.sampleName = sampleName
	}

	map(data: Array<Data>) {
		const order = this.settings.rings.order

		this.dataMapper.map(data)

		const labelsMapper = new LabelsMapper(this.settings, this.sampleName, this.reference)

		const labelsData = labelsMapper.map(this.dataMapper.filteredSnvData)

		const labelsRing = new Labels(this.settings, labelsData, this.dataMapper.hasCancerGenes)

		const chromosomesRing = new Ring(
			this.settings.rings.chromosomeInnerRadius,
			this.settings.rings.chromosomeWidth,
			this.reference.chromosomes
		)

		const arcsMapper = new NonExonicSnvArcsMapper(this.settings, this.sampleName, this.reference)

		const nonExonicArcRing: Ring<SnvArc> = new Ring(
			this.settings.rings.nonExonicInnerRadius,
			this.settings.rings.nonExonicWidht,
			arcsMapper.map(this.dataMapper.nonExonicSnvData)
		)

		const snvArcsMapper = new SnvArcsMapper(this.settings, this.sampleName, this.reference)

		const snvArcRing: Ring<SnvArc> = new Ring(
			this.settings.rings.svnInnerRadius,
			this.settings.rings.svnWidth,
			snvArcsMapper.map(this.dataMapper.snvRingDataMap)
		)

		const lohMapper = new LohArcMapper(this.settings, this.sampleName, this.reference)

		const lohArcRing: Ring<LohArc> = new Ring(
			this.settings.rings.lohInnerRadius,
			this.settings.rings.lohWidth,
			lohMapper.map(this.dataMapper.lohData)
		)

		const cnvArcsMapper = new CnvArcsMapper(
			this.settings,
			this.sampleName,
			this.reference,
			this.dataMapper.cnvMaxValue,
			this.dataMapper.cnvMinValue,
			this.settings.cnv.unit
		)

		const cnvArcRing: Ring<CnvArc> = new Ring(
			this.settings.rings.cnvInnerRadius,
			this.settings.rings.cnvWidth,
			cnvArcsMapper.map(this.dataMapper.cnvData)
		)

		const fusionMapper = new FusionMapper(this.settings, this.sampleName, this.reference)

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
			snvArcsMapper.snvClassMap,
			cnvArcsMapper.cnvClassMap,
			fusions.length > 0,
			lohLegend
		)

		const rings = new Rings(labelsRing, chromosomesRing, nonExonicArcRing, snvArcRing, cnvArcRing, lohArcRing)

		return new ViewModel(this.settings, rings, legend, fusions)
	}
}
