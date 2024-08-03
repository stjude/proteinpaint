import { clinsig } from './clinvar.js'
import { Mds3 } from '#types'

export default {
	isMds3: true,
	dsinfo: [
		{ k: 'Source', v: '<a href=http://www.ncbi.nlm.nih.gov/clinvar/ target=_blank>NCBI ClinVar</a>' },
		{ k: 'Data type', v: 'SNV/Indel' },
		{ k: 'Gene annotation', v: 'VEP version 100' },
		{ k: 'Download date', v: 'May 2023' }
	],
	genome: 'hg38',

	viewModes: [
		{
			byInfo: 'gnomAD_AF',
			inuse: true
		},
		{
			byInfo: 'gnomAD_AF_afr'
		}
	],

	queries: {
		snvindel: {
			forTrack: true,
			byrange: {
				bcffile: 'hg38/clinvar.hg38.bcf.gz',
				// list of info fields with special configurations
				infoFields: [
					{
						name: 'Clinical significance',
						key: 'CLNSIG',
						categories: clinsig,
						separator: '|'
					},
					{
						name: 'gnomAD_AF',
						key: 'gnomAD_AF'
					},
					{
						name: 'gnomAD_AF_afr',
						key: 'gnomAD_AF_afr'
					}
				]
			},
			ssmUrl: {
				base: 'https://www.ncbi.nlm.nih.gov/clinvar/variation/',
				namekey: 'vcf_id',
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
} satisfies Mds3
