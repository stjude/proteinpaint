if(process.argv.length!=3) {
	console.log(process.argv[1]+' <default isoform file, symbol on 1st, refseq on 3rd> output stout');
	process.exit();
}

var fs=require('fs'),
	csv=require('csv-streamify');

var genes={};

var fin=fs.createReadStream(process.argv[2]);
var parser=csv({delimiter:'\t',objectMode:true});
parser.on('readable',function(){
	var l=parser.read();
	if(!(l[0] in genes)) {
		genes[l[0]]=1;
		console.log(l[0]+'\t'+l[2]);
	}
});
parser.on('end',function(){
	fin.close();
	console.error(
	'create table defaultIsoform (',
		'symbol varchar(255) not null,',
		'refseq varchar(255) not null',
	');',
	'create index symbol_defaultisoform on defaultIsoform(symbol);'
	);
});
fin.pipe(parser);



