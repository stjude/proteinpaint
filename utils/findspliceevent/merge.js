if(process.argv.length!=4) {
	console.log('<original mdsjunction text file> <findspliceevent output.gz> output updated mdsjunction data to STDOUT')
	process.exit()
}

const oldfile=process.argv[2]
const tabixfile=process.argv[3]



const fs=require('fs')
const readline=require('readline')
const exec=require('child_process').execSync

const rl=readline.createInterface({
	input:fs.createReadStream(oldfile)
})


rl.on('line',line=>{

	if(line[0]=='#') {
		console.log(line)
		return
	}

	const l=line.split('\t')
	const chr=l[0]
	const start=l[1]
	const stop=l[2]
	
	const tmp=exec('tabix '+tabixfile+' '+chr+':'+start+'-'+stop,{encoding:'ascii',maxBuffer:1024000000}).trim().split('\n')
	for(const line2 of tmp) {
		const l2=line2.split('\t')
		if(l2[1]==start && l2[2]==stop) {
			console.log(line2)
			return
		}
	}
	console.log(line)

})
