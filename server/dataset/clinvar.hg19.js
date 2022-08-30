const clinvar = require('./clinvar')
module.exports = {
	isMds3: true,
	color: '#545454',
	dsinfo: [
		{ k: 'Source', v: '<a href=http://www.ncbi.nlm.nih.gov/clinvar/ target=_blank>NCBI ClinVar</a>' },
		{ k: 'Data type', v: 'SNV/Indel' },
		{ k: 'Gene annotation', v: 'VEP version 107' },
		{ k: 'Download date', v: 'July 2022' }
	],
	genome: 'hg19',
	queries: {
		snvindel: {
			forTrack: true,
			byrange: { bcffile: 'hg19/clinvar.hg19.hgvs_short.vep.bcf.gz',
		infoFields:[
			{
				name: 'Clinical Significance',
				key: 'CLINSIG',
				categories: clinvar.clinsig
			}
		] },
		url:{
			base:'https://www.ncbi.nlm.nih.gov/clinvar/variation/',
			key:'id'
		}
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
	},

	url4variant: [
		{
			makelabel: m => 'ClinVar Variation ' + m.vcf_ID,
			makeurl: m => {
				return 'https://www.ncbi.nlm.nih.gov/clinvar/variation/' + m.vcf_ID
			}
		}
	]
*/
}
