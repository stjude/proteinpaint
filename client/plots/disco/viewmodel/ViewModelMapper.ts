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
		const chrSizes = opts.args.genome.majorchr

		/** Remove hidden chromosomes */
		const chromosomesOverride = {}
		for (const chr of Object.keys(chrSizes)) {
			if (!this.settings.Disco.hiddenChromosomes.includes(chr)) {
				chromosomesOverride[chr] = chrSizes[chr]
			}
		}

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
