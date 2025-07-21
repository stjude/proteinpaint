import type ViewModel from '#plots/disco/viewmodel/ViewModel.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import type Settings from '#plots/disco/Settings.ts'
import ViewModelProvider from './ViewModelProvider.ts'
import type { DiscoInteractions } from '../interactions/DiscoInteractions.ts'

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
		const radius = this.settings.Disco.radius
		if (!radius) return

		const scale = radius / this.settings.rings.labelLinesInnerRadius

		this.settings.rings.labelLinesInnerRadius *= scale
		this.settings.rings.labelsToLinesDistance *= scale
		this.settings.rings.chromosomeInnerRadius *= scale
		this.settings.rings.chromosomeWidth *= scale
		this.settings.rings.nonExonicRingWidth *= scale
		this.settings.rings.snvRingWidth *= scale
		this.settings.rings.lohRingWidth *= scale
		this.settings.rings.cnvRingWidth *= scale
		this.settings.label.fontSize *= scale
		this.settings.legend.fontSize *= scale
	}

	map(opts: any): ViewModel {
		let selectedChromosomes = opts.args.chromosomes

		const chrSizes = opts.args.genome.majorchr
		let excludedChromosomes: string[] = []

		// Determine which chromosomes should be visualized. When
		// `selectedChromosomes` is not provided as an argument, fall back
		// to `settings.Disco.selectedChromosomes` and construct a mapping
		// of valid chromosomes. Any chromosomes omitted from that list are
		// considered excluded. If `selectedChromosomes` is given, compute
		// the excluded set by comparing it to the full list of reference
		// chromosomes.

		if (
			!selectedChromosomes &&
			Array.isArray(this.settings.Disco.selectedChromosomes) &&
			this.settings.Disco.selectedChromosomes.length
		) {
			selectedChromosomes = {}
			for (const chr of this.settings.Disco.selectedChromosomes) {
				if (chrSizes[chr]) selectedChromosomes[chr] = chrSizes[chr]
			}
			excludedChromosomes = Object.keys(chrSizes).filter(c => !this.settings.Disco.selectedChromosomes!.includes(c))
		} else if (selectedChromosomes) {
			excludedChromosomes = Object.keys(chrSizes).filter(c => !(c in selectedChromosomes))
		}

		const sampleName = opts.args.sampleName

		const genome = opts.args.genome

		const prioritizedGenes = genome?.geneset?.[0] ? genome.geneset[0].lst : []

		const genesetName = genome?.geneset?.[0] ? genome.geneset[0].name : ''

		const data: Array<any> = opts.args.data

		this.applyRadius()

		const reference = new Reference(this.settings, chrSizes, selectedChromosomes)

		const dataMapper = new DataMapper(this.settings, reference, sampleName, prioritizedGenes, excludedChromosomes)

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
