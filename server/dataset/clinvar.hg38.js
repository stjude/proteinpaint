const clinvar_clinsig = require('../genome/clinvar.clinsig')
const clinvar_AF = require('./clinvar.AF')
module.exports = {
	color: '#545454',
	dsinfo: [
		{ k: 'Source', v: '<a href=http://www.ncbi.nlm.nih.gov/clinvar/ target=_blank>NCBI ClinVar</a>' },
		{ k: 'Data type', v: 'SNV/Indel' },
		{ k: 'Gene annotation', v: 'VEP version 102' },
		{ k: 'Download date', v: 'June 2021' }
	],
	genome: 'hg38',
	queries: [
		{
			name: 'clinvar',
			vcffile: 'hg38/clinvar.hg38.vcf.gz',
			hlinfo: {}
		}
	],
	vcfinfofilter: {
		setidx4mclass: 0,
		setidx4numeric: 1,
		lst: [
			{
				name: 'Clinical significance',
				locusinfo: {
					key: 'CLNSIG'
				},
				categories: clinvar_clinsig
			},
			clinvar_AF.AF_EXAC,
			clinvar_AF.AF_ESP,
			clinvar_AF.AF_TGP
		]
	},

	url4variant: [
		{
			makelabel: m => 'ClinVar Variation ' + m.vcf_ID,
			makeurl: m => {
				return 'https://www.ncbi.nlm.nih.gov/clinvar/variation/' + m.vcf_ID
			}
		}
	]
}
