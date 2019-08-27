
if(process.argv.length!=3) {
	console.log('<phewas result folder> output dotbed to stdout')
	process.exit()
}


const filedir = process.argv[2]
const glob = require('glob')
const fs = require('fs')
const path = require('path')
const readline=require('readline')





main()





///////////////////// helpers

async function main() {
	for(const file of glob.sync(path.join(filedir,'*'))) {
		await load_phewas_file( file )
	}
}






function load_phewas_file ( file ) {
	return new Promise((resolve,reject)=>{
		const rl = readline.createInterface({input: fs.createReadStream( file )})

		let first=true
		let thispos=null
		let thislogplst = []
		let thischr

		rl.on('line',line=>{
			if(first) {
				first=false
				return
			}
			const [snv4,snp,groupname,termid,casename,ctrlname,pstr] = line.split('\t')
			if(pstr=='1') return
			if(groupname=='Demographics') return
			const pvalue = Number(pstr)
			if(pvalue>=0.05) return

			const logpvalue = Math.ceil(-Math.log10(pvalue))
			const [chr,posstr] = snv4.split('.')
			const coordinate = Number( posstr )

			if( thispos == coordinate ) {
			} else if(thispos==null) {
				thispos = coordinate
				thischr = chr
			} else {
				console.log(chr+'\t'+(thispos-1)+'\t'+thispos+'\t'+thislogplst.join(','))
				thispos = coordinate
				thislogplst = []
			}

			thislogplst.push(logpvalue)
		})
		rl.on('close',()=>{
			console.log( thischr +'\t'+(thispos-1)+'\t'+thispos+'\t'+thislogplst.join(','))
			resolve()
		})
	})
}
