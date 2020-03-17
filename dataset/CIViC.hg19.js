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
	info2singletable: {
		civic_csq: {
			col_separator: '|',
			fields: [
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
				{ name: 'ClinVar IDs', separator: '&', appendUrl: 'https://www.ncbi.nlm.nih.gov/clinvar/variation/' },
				{ name: 'CIViC Variant Evidence Score' }
			]
		}
	},
	info2table: {
		civic_csq: {
			col_separator: '|',
			fields: [
				// each field is a column
				{ hide: true, name: 'Allele' },
				{ hide: true, name: 'Consequence' },
				{ hide: true, name: 'SYMBOL' },
				{ hide: true, name: 'Entrez Gene ID' },
				{ hide: true, name: 'Feature_type' },
				{ hide: true, name: 'Feature' },
				{ hide: true, name: 'HGVSc' },
				{ hide: true, name: 'HGVSp' },
				{ hide: true, name: 'CIViC Variant Name' },
				{ hide: true, name: 'CIViC Variant ID' },
				{ hide: true, name: 'CIViC Variant Aliases', ampersand2br: true },
				{ hide: true, name: 'CIViC HGVS', eval: true, ampersand2br: true },
				{ hide: true, name: 'Allele Registry ID' },
				{ hide: true, name: 'ClinVar IDs' },
				{ hide: true, name: 'CIViC Variant Evidence Score' },
				{ name: 'CIViC Entity Type' },
				{ name: 'CIViC Entity ID' },
				{ name: 'CIViC Entity URL', isurl: true },
				{
					name: 'CIViC Entity Source',
					urlMatchLst: {
						separator: '_',
						idIndex: 0,
						types: [
							{ type: 'pubmed', appendUrl: 'https://www.ncbi.nlm.nih.gov/pubmed/' },
							{ type: 'asco', appendUrl: 'https://meetinglibrary.asco.org/record/' }
						]
					}
				},
				{ name: 'CIViC Entity Variant Origin' },
				{ name: 'CIViC Entity Status' }
			]
		}
	}
}
