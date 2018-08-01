const abort = m => {
	console.error('Error:',m)
	process.exit()
}


const infile = process.argv[2]
if(!infile) abort('<gap.txt from ucsc> output to stdout')

const fs=require('fs')

for(const line of fs.readFileSync(infile,{encoding:'utf8'}).trim().split('\n')) {
	const l = line.split('\t')

	/*
	`bin` smallint(6) NOT NULL default '0',
	`chrom` varchar(255) NOT NULL default '',
	`chromStart` int(10) unsigned NOT NULL default '0',
	`chromEnd` int(10) unsigned NOT NULL default '0',
	`ix` int(11) NOT NULL default '0',
	`n` char(1) NOT NULL default '',
	`size` int(10) unsigned NOT NULL default '0',
	`type` varchar(255) NOT NULL default '',
	`bridge` varchar(255) NOT NULL default '',
	*/

	const chr = l[1]
	const start = Number.parseInt(l[2])
	const stop = Number.parseInt(l[3])

	if(Number.isNaN(start) || Number.isNaN(stop)) abort('invalid start/stop')

	const j = {name:l[7]+', '+l[6]+' bp'}

	console.log(chr+'\t'+start+'\t'+stop+'\t'+JSON.stringify(j))
}
