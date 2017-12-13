module.exports = {
	color:'#545454',
	dsinfo:[
		{k:'Version',v:'0.3.1'},
		{k:'Download date',v:'July 1, 2016'},
		{k:'Data type',v:'Point mutation'},
		{k:'Source',v:'<a href=http://exac.broadinstitute.org/ target=_blank>http://exac.broadinstitute.org/</a><br><a href=http://biorxiv.org/content/early/2015/10/30/030338 target=_blank>Link to publication</a>'},
		{k:'RefSeq gene annotation',v:'By Annovar (in-house), preferred isoforms only'},
		{k:'Ensembl gene annotation',v:'By VEP (July 2016), all isoforms'}
	],
	genome:'hg19',
	queries:[
		{
			name:'exac',
			vcffile:'hg19/ExAC.r0.3.1.sites.vep.vcf.gz',
		}
	],
	vcfinfofilter:{lst:[
		{
		name:'Population frequency filter',
		altalleleinfo:{ key:'AF' },
		numericfilter:[ 0.00001, 0.0001, 0.001, .01]
		}
	],setidx4numeric:0
	},
	itemlabelname:'variant',
}
