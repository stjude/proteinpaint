
if(process.argv.length!=5) {
	console.log('<chromosome length> <phewas result folder> <image file name>')
	process.exit()
}


const chrlen = Number( process.argv[2])
const infile = process.argv[3]
const outfile_png = process.argv[4]

const fs = require('fs')
const path = require('path')
const readline=require('readline')
const createCanvas = require('canvas').createCanvas



const plotwidth = 1500
const plotheight = 500
const ymax = 100 // hardcoded max of -log10(pvalue), may be a parameter

const leftpad = 100,
	rightpad = 100,
	toppad = 100,
	bottompad = 100


const canvas = createCanvas( leftpad+plotwidth+rightpad, toppad+plotheight+bottompad )
const ctx = canvas.getContext('2d')



ctx.fillStyle = 'rgba(0,0,255,0.5)'



main()





///////////////////// helpers

async function main() {

	await load_phewas_file( infile )

	const outstream = fs.createWriteStream( outfile_png )
	canvas.createPNGStream().pipe( outstream )
	.on('finish',()=>{
	})
	// done
}






function load_phewas_file ( file ) {
	return new Promise((resolve,reject)=>{
		const rl = readline.createInterface({input: fs.createReadStream( file )})
		let first=true
		rl.on('line',line=>{
			if(first) {
				first=false
				return
			}
			const [snv4,snp,groupname,termid,casename,ctrlname,pstr] = line.split('\t')
			if(pstr=='1') return
			if(groupname=='Demographics') return
			const coordinate = Number( snv4.split('.')[1] )
			const logpvalue = -Math.log10(Number(pstr))
			ctx.fillRect(
				leftpad + (coordinate * plotwidth / chrlen),
				toppad  + ( (logpvalue >= ymax) ? 0 : (ymax-logpvalue)*plotheight/ymax ),
				2,
				2
			)
		})
		rl.on('close',()=>{
			resolve()
		})
	})
}
