module.exports = {
	color:'#545454',
	dsinfo:[
		{k:'Source',v:'<a href=https://civicdb.org>CIViC</a>'},
		{k:'Data type',v:'SNV/Indel'},
		{k:'Gene annotation',v:'VEP version 99'},
		{k:'Download date',v:'March 2020'},
	],
	genome:'hg19',
	queries:[
		{
			name:'CIViC',
			vcffile:'hg19/CIViC.hg19.vcf.gz',
			hlinfo:{
			},
		}
	],
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
	}
}
