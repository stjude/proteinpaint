import ViewModel from '#plots/disco/viewmodel/ViewModel'
import Reference from '#plots/disco/chromosome/Reference'
import DataMapper from '#plots/disco/data/DataMapper'
import Settings from '#plots/disco/Settings'
import ViewModelProvider from './ViewModelProvider'

export class ViewModelMapper {
	static dtNums = [2, 5, 4, 10, 1, 'exonic', 'non-exonic']

	static dtAlias = {
		1: 'snv', //
		2: 'sv', //'fusionrna',
		3: 'geneexpression',
		4: 'cnv',
		5: 'sv',
		6: 'snv', //'itd',
		7: 'snv', //'del',
		8: 'snv', //'nloss',
		9: 'snv', //'closs',
		10: 'loh'
	}

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
		mnv: 'non-exonic',
		ITD: 'non-exonic',
		insertion: 'non-exonic',
		deletion: 'non-exonic',
		Intron: 'non-exonic',
		X: 'non-exonic',
		noncoding: 'non-exonic'
	}

	private settings: Settings

	constructor(settings: Settings) {
		this.settings = settings
	}

	map(opts: any): ViewModel {
		const chromosomesOverride = opts.args.chromosomes

		const chrSizes = opts.args.genome.majorchr

		const sampleName = opts.args.sampleName

		const cancerGenes = opts.args.cancerGenes ? opts.args.cancerGenes : []

		const data: Array<any> = opts.args.data

		const reference = new Reference(this.settings, chrSizes, chromosomesOverride)

		const dataMapper = new DataMapper(this.settings, reference, sampleName, cancerGenes)

		return new ViewModelProvider(this.settings, dataMapper, reference, sampleName).map(data)
	}
}
