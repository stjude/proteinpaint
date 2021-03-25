if(process.argv.length!=5) {
	console.log(process.argv[1]+' <wgEncodeGencodeCompV?.txt> <wgEncodeGencodeAttrsV?.txt> <output file basename (gencode.hg19)>')
	process.exit()
}

var gencode=process.argv[2],
	attrfile=process.argv[3],
	outfile=process.argv[4]

var fs=require('fs'),
	exec=require('child_process').execSync

var attr={}
var categories={
	coding:{color:'#004D99',label:'Coding gene'},
	nonCoding:{color:'#009933',label:'Noncoding gene'},
	problem:{color:'#FF3300',label:'Problem'},
	pseudo:{color:'#FF00CC',label:'Pseudogene'}
}


for(const line of fs.readFileSync(attrfile,'utf8').trim().split('\n')) {
	var l=line.split('\t')
	var isoform=l[4].split('.')[0]
	var cls=l[12]
	if(!categories[cls]) {
		console.error('unknown class: '+cls)
		process.exit()
	}
	attr[isoform]={
		gene_type:l[2],
		transcript_type:l[6],
		transcript_class:cls
	}
}

var out=[]

fs.readFileSync(gencode,'utf8').trim().split('\n').forEach(function(line){
	var l=line.split('\t')
	var strand=l[3]
	var thickstart=parseInt(l[6]),
		thickstop=parseInt(l[7]),
		forward=strand=='+',
		thin3=[],
		thin5=[],
		thick=[],
		intron=[],
		exon=[],
		startstr=l[9].split(','),
		stopstr=l[10].split(','),
		paststop=null,
		rnalen=0,
		cdslen=0
	for(var i=0; i<startstr.length-1; i++) {
		var a=parseInt(startstr[i]),
			b=parseInt(stopstr[i])
		if(forward) {
			exon.push([a,b])
		} else {
			exon.unshift([a,b])
		}
		rnalen+=b-a
		if(i>0 && i<startstr.length-1) {
			if(forward) {
				intron.push([paststop,a])
			} else {
				intron.unshift([paststop,a])
			}
		}
		paststop=b
		if(a<thickstart) {
			if(b<thickstart) {
				if(forward) {
					thin5.push([a,b])
				} else {
					thin3.unshift([a,b])
				}
			} else {
				if(forward) {
					thin5.push([a,thickstart])
				} else {
					thin3.unshift([a,thickstart])
				}
				if(b>thickstop) {
					if(thickstart<thickstop) {
						if(forward) {
							thick.push([thickstart,thickstop])
						} else {
							thick.unshift([thickstart,thickstop])
						}
						cdslen+=thickstop-thickstart
					}
					if(forward) {
						thin3.push([thickstop,b])
					} else {
						thin5.unshift([thickstop,b])
					}
				} else {
					if(thickstart<b) {
						if(forward) {
							thick.push([thickstart,b])
						} else {
							thick.unshift([thickstart,b])
						}
						cdslen+=b-thickstart
					}
				}
			}
		} else if(a<thickstop) {
			if(b<=thickstop) {
				if(a<b) {
					if(forward) {
						thick.push([a,b])
					} else {
						thick.unshift([a,b])
					}
					cdslen+=b-a
				}
			} else {
				if(a<thickstop) {
					if(forward) {
						thick.push([a,thickstop])
					} else {
						thick.unshift([a,thickstop])
					}
					cdslen+=thickstop-a
				}
				if(forward) {
					thin3.push([thickstop,b])
				} else {
					thin5.unshift([thickstop,b])
				}
			}
		} else {
			if(forward) {
				thin3.push([a,b])
			} else {
				thin5.unshift([a,b])
			}
		}
	}
	var isoform=l[1].split('.')[0]
	var obj={
		name:l[12],
		isoform:isoform,
		strand:strand,
		exon:exon,
		rnalen:rnalen,
	}
	if(isoform in attr) {
		obj.attr=attr[isoform]
		obj.category=obj.attr.transcript_class
	}
	if(intron.length>0) {
		obj.intron=intron
	}
	if(thickstart==thickstop) {
		// noncoding
	} else {
		obj.cdslen=cdslen
		obj.codingstart=thickstart
		obj.codingstop=thickstop
		obj.coding=thick
		if(thin5.length) obj.utr5=thin5
		if(thin3.length) obj.utr3=thin3
	}
	out.push(l[2]+'\t'+l[4]+'\t'+l[5]+'\t'+JSON.stringify(obj))
})

console.log(JSON.stringify(categories))

fs.writeFileSync(outfile,out.join('\n'))
exec('sort -k1,1 -k2,2n '+outfile+' > '+outfile+'.sort')
exec('mv '+outfile+'.sort '+outfile)
exec('bgzip '+outfile)
exec('tabix -p bed '+outfile+'.gz')
