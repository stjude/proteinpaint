/*
  `bin` smallint(5) unsigned NOT NULL,
  `chrom` varchar(255) NOT NULL,
  `chromStart` int(10) unsigned NOT NULL,
  `chromEnd` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `score` int(10) unsigned NOT NULL,
  `sourceCount` int(10) unsigned NOT NULL,
  `sourceIds` longblob NOT NULL,
  `sourceScores` longblob NOT NULL,
*/

if (process.argv.length != 3) {
	console.log('<encRegTfbsClustered.txt> output to stdout')
	process.exit()
}

const fs = require('fs')
const readline = require('readline')
const rl = readline.createInterface({ input: fs.createReadStream(process.argv[2]) })
rl.on('line', line => {
	const l = line.split('\t')
	const tf = l[4]
	const j = { name: tf + ' ' + l[6] }
	//if(tf=='CTCF') j.color = 'red'
	if (tf != 'CTCF') return
	j.name = l[6]
	console.log(l[1] + '\t' + l[2] + '\t' + l[3] + '\t' + JSON.stringify(j))
})
