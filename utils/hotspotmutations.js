if(process.argv.length!=4) {
	console.log('<infile1> <mutation count cutoff, below which is not hotspot> output to stdout');
	process.exit();
}

var infile=process.argv[2],
	cutoff=parseInt(process.argv[3])
	;

if(isNaN(cutoff) || cutoff<=1) {
	console.error('cutoff must be positive int');
	process.exit();
}

var fs=require('fs'),
	lazy=require('lazy'),
	async=require('async')
	;



async.waterfall([


function(next){
var refseq={};
new lazy(fs.createReadStream('/home/xzhou/node/gene'))
	.on('end',function(){
		next(null,refseq);
		})
	.lines
	.map(String)
	.forEach(function(line){
		var l=line.split('\t');
		refseq[l[2]]=l[1];
	})
},




function(refseq,next){
var dropped=0,
	counted=0,
	gene={};
new lazy(fs.createReadStream(infile))
.on('end',function(){
	next(null,gene);
})
.lines
.map(String)
.forEach(function(line){
	var l=line.split('\t');

	var aachange=l[34], chr='chr'+l[36], mrna=l[39], start=l[37];
	//var aachange=l[1], chr=l[3], mrna=l[0], start=l[4];

	var genesymbol=refseq[mrna];
	if(!genesymbol) return;

	var coord=parseInt(start);
	if(isNaN(coord)) return;


	if(mrna in gene) {
		if(coord in gene[mrna]) {
			var v=gene[mrna][coord];
			v.total++;
			v.names[aachange]=1;
		} else {
			gene[mrna][coord]={
				symbol:genesymbol,
				chr:chr,
				total:1,
				names:{},
				};
			gene[mrna][coord].names[aachange]=1;
		}
	} else {
		var v={};
		v[coord]={
			symbol:genesymbol,
			total:1,
			names:{},
			chr:chr,
			};
		v[coord].names[aachange]=1;
		gene[mrna]=v;
	}
	counted++;
})
},



function(gene){
	console.log('chr\tstart\tgene\trefseq\taachange\t#samples');
	for(var mrna in gene) {
		for(var coord in gene[mrna]) {
			var v=gene[mrna][coord];
			if(v.total<cutoff) continue;
			var names=[];
			for(var n in v.names) {
				names.push(n);
			}
			console.log(v.chr+'\t'+coord+'\t'+v.symbol+'\t'+mrna+'\t'+names.join('/')+'\t'+v.total);
		}
	}
}



]);
