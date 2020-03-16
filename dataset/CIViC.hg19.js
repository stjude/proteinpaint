module.exports = {
	color: '#545454',
	dsinfo: [
		{ k: 'Source', v: '<a href=https://civicdb.org>CIViC</a>' },
		{ k: 'Data type', v: 'SNV/Indel' },
		{ k: 'Gene annotation', v: 'VEP version 99' },
		{ k: 'Download date', v: 'March 2020' }
	],
	genome: 'hg19',
	queries: [
		{
			name: 'CIViC',
			vcffile: 'hg19/CIViC.hg19.vcf.gz',
			hlinfo: {}
		}
	],
	/*
	vcfinfofilter:{
		lst:[
			{
				name: 'CIViC Entity Status',
				locusinfo:{
					key:'ST',
				},
				categories:{
					'accepted':{color:'#43ac6a',label:'Editor Approved',textcolor:'white'},
					'submitted':{color:'#f04124',label:'Pending for Editor Review',textcolor:'white'}
				}
			}
		]
	},
	*/
	info2table: {
		civic_csq: {
			col_separator: '|',
			fields: [
				// each field is a column
				{ name: 'Allele' },
				{ name: 'Consequence' },
				{ name: 'SYMBOL' },
				{ name: 'Entrez Gene ID' },
				{ name: 'Feature_type' },
				{ name: 'Feature' },
				{ name: 'HGVSc' },
				{ name: 'HGVSp' },
				{ name: 'CIViC Variant Name' },
				{ name: 'CIViC Variant ID' },
				{ name: 'CIViC Variant Aliases', ampersand2br: true },
				{ name: 'CIViC HGVS', eval: true, ampersand2br: true },
				{ name: 'Allele Registry ID' },
				{ name: 'ClinVar IDs' },
				{ name: 'CIViC Variant Evidence Score' },
				{ name: 'CIViC Entity Type' },
				{ name: 'CIViC Entity ID' },
				{ name: 'CIViC Entity URL', isurl: true },
				{ name: 'CIViC Entity Source' },
				{ name: 'CIViC Entity Variant Origin' },
				{ name: 'CIViC Entity Status' }
			]
		}
	}
}
