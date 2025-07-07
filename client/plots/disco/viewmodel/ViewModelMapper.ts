import type ViewModel from '#plots/disco/viewmodel/ViewModel.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import type Settings from '#plots/disco/Settings.ts'
import ViewModelProvider from './ViewModelProvider.ts'
import type { DiscoInteractions } from '../interactions/DiscoInteractions.ts'

const DEFAULT_LABEL_RADIUS = 210
const DEFAULT_CHROMOSOME_INNER_RADIUS = 190
const DEFAULT_CHROMOSOME_WIDTH = 20
const DEFAULT_NONEXONIC_RING_WIDTH = 20
const DEFAULT_SNV_RING_WIDTH = 20
const DEFAULT_LOH_RING_WIDTH = 20
const DEFAULT_CNV_RING_WIDTH = 30
const DEFAULT_LABELS_TO_LINES_DISTANCE = 30
const DEFAULT_LABEL_FONT_SIZE = 12
const DEFAULT_LEGEND_FONT_SIZE = 12

export class ViewModelMapper {
	static snvClassLayer = {
		M: 'exonic',
		E: 'exonic',
		F: 'exonic',
		N: 'exonic',
		S: 'exonic',
		D: 'exonic',
		I: 'exonic',
		P: 'exonic',
		L: 'exonic',
		Utr3: 'exonic',
		Utr5: 'exonic',
		ProteinAltering: 'exonic',
		mnv: 'non-exonic',
		ITD: 'non-exonic',
		insertion: 'non-exonic',
		deletion: 'non-exonic',
		Intron: 'non-exonic',
		X: 'non-exonic',
		noncoding: 'non-exonic'
	}

	private settings: Settings
	private discoInteractions: DiscoInteractions

	constructor(settings: Settings, discoInteractions: DiscoInteractions) {
		// the settings object retrieved is frozen. created
		// a mutable copy so ring dimensions can be adjusted at runtime
		this.settings = JSON.parse(JSON.stringify(settings))
		this.discoInteractions = discoInteractions
    }

	private applyRadius() {
		const radius = this.settings.Disco.radius ?? DEFAULT_LABEL_RADIUS
		const scale = radius / DEFAULT_LABEL_RADIUS

		this.settings.rings.labelLinesInnerRadius = DEFAULT_LABEL_RADIUS * scale
		this.settings.rings.labelsToLinesDistance = DEFAULT_LABELS_TO_LINES_DISTANCE * scale
		this.settings.rings.chromosomeInnerRadius = DEFAULT_CHROMOSOME_INNER_RADIUS * scale
		this.settings.rings.chromosomeWidth = DEFAULT_CHROMOSOME_WIDTH * scale
		this.settings.rings.nonExonicRingWidth = DEFAULT_NONEXONIC_RING_WIDTH * scale
		this.settings.rings.snvRingWidth = DEFAULT_SNV_RING_WIDTH * scale
		this.settings.rings.lohRingWidth = DEFAULT_LOH_RING_WIDTH * scale
		this.settings.rings.cnvRingWidth = DEFAULT_CNV_RING_WIDTH * scale
		this.settings.label.fontSize = DEFAULT_LABEL_FONT_SIZE * scale
		this.settings.legend.fontSize = DEFAULT_LEGEND_FONT_SIZE * scale
	}

    map(opts: any): ViewModel {
		const chromosomesOverride = opts.args.chromosomes

		const chrSizes = opts.args.genome.majorchr

		const sampleName = opts.args.sampleName

		const genome = opts.args.genome

		const prioritizedGenes = genome?.geneset?.[0] ? genome.geneset[0].lst : []

		const genesetName = genome?.geneset?.[0] ? genome.geneset[0].name : ''

		const data: Array<any> = opts.args.data

		this.applyRadius()

		const reference = new Reference(this.settings, chrSizes, chromosomesOverride)

		const dataMapper = new DataMapper(this.settings, reference, sampleName, prioritizedGenes)

		return new ViewModelProvider(
			this.settings,
			dataMapper,
			reference,
			sampleName,
			genesetName,
			this.discoInteractions
		).map(data)
	}
}
