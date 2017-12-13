module.exports = {
	color:'#545454',
	dsinfo:[
		{k:'Version',v:'2.0.1'},
		{k:'Download date',v:'July 1, 2016'},
		{k:'Data type',v:'Point mutation'},
		{k:'Source',v:'<a href=http://gnomad.broadinstitute.org/ target=_blank>http://gnomad.broadinstitute.org/</a>'},
		{k:'RefSeq gene annotation',v:'By Annovar (in-house), preferred isoforms only'},
		{k:'Ensembl gene annotation',v:'By VEP (July 2016), all isoforms'}
	],
	genome:'hg19',
	queries:[
		{
			name:'gnomad',
			vcffile:'hg19/gnomad.genomes.r2.0.1.sites.autosomes.X.vcf.gz',
		}
	],

	vcfinfofilter:{lst:[
		{
		name:'Population frequency filter',
		altalleleinfo:{ key:'AF' },
		numericfilter:[ 0.00002, .00005, .00008, 0.0001, 0.001, .01]
		}
	],setidx4numeric:0
	},

	itemlabelname:'variant',
}
