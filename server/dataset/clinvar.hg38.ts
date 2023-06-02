import { clinsig } from './clinvar.js'
import { Mds3 } from '../shared/types'

export default <Mds3> {
	isMds3: true,
	dsinfo: [
		{ k: 'Source', v: '<a href=http://www.ncbi.nlm.nih.gov/clinvar/ target=_blank>NCBI ClinVar</a>' },
		{ k: 'Data type', v: 'SNV/Indel' },
		{ k: 'Gene annotation', v: 'VEP version 107' },
		{ k: 'Download date', v: 'July 2022' }
	],
	genome: 'hg38',
	queries: {
		snvindel: {
			forTrack: true,
			byrange: {
				bcffile: 'hg38/clinvar.hg38.hgvs_short.vep.bcf.gz',
				// list of info fields with special configurations
				infoFields: [
					{
						name: 'Clinical significance',
						key: 'CLNSIG',
						categories: clinsig,
						separator: '|'
					}
				]
			},
			variantUrl: {
				base: 'https://www.ncbi.nlm.nih.gov/clinvar/variation/',
				key: 'vcf_id',
				linkText: 'ClinVar',
				shownSeparately: true
			},
			infoUrl: [
				{
					base: 'https://www.ncbi.nlm.nih.gov/snp/rs',
					key: 'RS'
				}
			]
		}
	}
	/*
	vcfinfofilter: {
		setidx4mclass: 0,
		setidx4numeric: 1,
		lst: [
			{
				name: 'Clinical significance',
				locusinfo: {
					key: 'CLNSIG'
				},
				categories: clinvar.clinsig
			},
			clinvar.AF.AF_EXAC,
			clinvar.AF.AF_ESP,
			clinvar.AF.AF_TGP
		]
	}
	*/
}