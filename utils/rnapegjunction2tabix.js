if(process.argv.length!=4) {
	console.log('<input RNApeg output file (1. 1-based junction, 2. count 3. type)> <output file /path/to/basename>')
	process.exit()
}


var infile=process.argv[2],
	outfile=process.argv[3]


var fs=require('fs'),
	exec=require('child_process').execSync


var data=[]
var lines=fs.readFileSync(infile,'utf8').trim().split('\n')
var err=0
for(var i=1; i<lines.length; i++) {
	var l=lines[i].split('\t')
	const readcount=l[1]
	const type=l[2]

	var t=l[0].split(/[:,]/)
	const chr=t[0]
	const strand=t[2]
	var start=parseInt(t[1]),
		stop=parseInt(t[4])
	if(isNaN(start) || isNaN(stop)) {
		err++
		continue
	}
	data.push(
		chr+'\t'+(start-1)+'\t'+(stop-1)+'\t'+strand+'\t'+type+'\t'+readcount
	)
}

if(err) {
	console.error('%d invalid junctions in %s',err,infile)
}


fs.writeFileSync(outfile,data.join('\n'),{encoding:'utf8'})

exec('sort -k1,1 -k2,2n '+outfile+' > '+outfile+'.sort')
exec('mv '+outfile+'.sort '+outfile)
exec('bgzip '+outfile)
exec('tabix -p bed '+outfile+'.gz')
