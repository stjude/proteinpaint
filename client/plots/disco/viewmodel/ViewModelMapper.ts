import ViewModel from '#plots/disco/viewmodel/ViewModel.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import Settings from '#plots/disco/Settings.ts'
import ViewModelProvider from './ViewModelProvider.ts'
import { DiscoInteractions } from '../interactions/DiscoInteractions.ts'

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
		this.settings = settings
		this.discoInteractions = discoInteractions
	}

	map(opts: any): ViewModel {
		const chromosomesOverride = opts.args.chromosomes

		const chrSizes = opts.args.genome.majorchr

		const sampleName = opts.args.sampleName

		const genome = opts.args.genome

		const prioritizedGenes = genome?.geneset?.[0] ? genome.geneset[0].lst : []

		const genesetName = genome?.geneset?.[0] ? genome.geneset[0].name : ''

		const data: Array<any> = opts.args.data

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
