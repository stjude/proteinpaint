const fs=require('fs')
const readline=require('readline')
const zlib=require('zlib')


const infile = process.argv[2]


if(!infile) {
	console.log('<input .gz fasta file> output text file to stdout')
	process.exit()
}



const rl = readline.createInterface({
	input: fs.createReadStream( infile ).pipe(zlib.createGunzip())
})



rl.on('line',line=>{
	if(line[0]=='>') {
		console.log('>'+line.substr(4))
		return
	}
	console.log(line)
})
