if(process.argv.length!=5) {
	console.log('<chromosome length> <phewas result folder> <image file name>')
	process.exit()
}


const chrlen = Number( process.argv[2])
const infile_dir = process.argv[3]
const outfile_png = process.argv[4]

const glob = require('glob')
const fs = require('fs')
const path = require('path')
const readline=require('readline')
const Canvas = require('canvas')
const exec = require('child_process').exec
const d3axis = require('d3-axis')
const d3scale = require('d3-scale')
const d3format = require('d3-format').format


const plotwidth = 1500
const plotheight = 500
const ymax = 100 // hardcoded max of -log10(pvalue), may be a parameter

const leftpad = 100,
	rightpad = 100,
	toppad = 100,
	bottompad = 100,
	borderpad = 10,
	ticksize = 10


const imgwidth = leftpad+plotwidth+rightpad
const imgheight = toppad+plotheight+bottompad
const canvas = Canvas.createCanvas( imgwidth, imgheight )
const ctx = canvas.getContext('2d')
ctx.strokeStyle = 'black'
ctx.font = '14pt Arial'
ctx.textAlign='center'
ctx.textBaseline='top'


// image border
ctx.strokeRect( leftpad-borderpad, toppad-borderpad, plotwidth+borderpad*2, plotheight+borderpad*2 )

const xscale = d3scale.scaleLinear().domain([0,chrlen]).range([0,plotwidth])
const xvalues = d3axis.axisTop().scale(xscale).ticks(15).scale().ticks()
for(const v of xvalues) {
	const x = xscale(v) + leftpad
	ctx.beginPath()
	ctx.moveTo(x,toppad+plotheight+borderpad)
	ctx.lineTo(x,toppad+plotheight+borderpad+ticksize)
	ctx.closePath()
	ctx.stroke()
	ctx.fillText( d3format('.2s')(v), x, toppad+plotheight+borderpad+ticksize+5)
}

const yscale = d3scale.scaleLinear().domain([ ymax, 0 ]).range([0, plotheight])
const yvalues = d3axis.axisTop().scale(yscale).ticks(10).scale().ticks()
ctx.textBaseline = 'middle'
ctx.textAlign='right'
for(const v of yvalues) {
	const y = yscale(v) + toppad
	ctx.beginPath()
	ctx.moveTo(leftpad-borderpad-ticksize, y)
	ctx.lineTo(leftpad-borderpad, y)
	ctx.closePath()
	ctx.stroke()
	ctx.fillText( v, leftpad-borderpad-ticksize-5, y )
}


main()


///////////////////// helpers

async function main() {

	const lst = []
	for(const file of glob.sync( path.join(infile_dir,'*') ) ) {
		lst.push( submit( file ) )
	}

	const pngfiles = await Promise.all( lst )

	for(const pngfile of pngfiles) {
		const data = await Canvas.loadImage( pngfile )
		ctx.drawImage( data, 0,0, imgwidth, imgheight )
		fs.unlink( pngfile, ()=>{})
	}

	const outstream = fs.createWriteStream( outfile_png )
	canvas.createPNGStream().pipe( outstream )
	//.on('finish',()=>{ })
	// done
}



function submit ( file ) {
	return new Promise((resolve,reject)=>{
		const pngfile = file+'.pngtmp'
		exec('node plot.phewas.onefile.js '+chrlen+' '+file+' '+pngfile, ()=>{
			resolve( pngfile )
		})
	})
}
