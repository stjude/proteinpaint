const fs = require('fs')
const path = require('path')
const spawn = require('child_process').spawn
const utils = require('./utils')
const createCanvas = require('canvas').createCanvas



/*
********************** EXPORTED
load
********************** INTERNAL
*/





const connheight = 50



export async function load ( _tk, q, genome, ds, result ) {
/*
_tk:{}
	.name
	also has customization parameters
result:{}
	.__mposset
*/
	const tk = ds.track.ld.tracks.find( i=> i.name == _tk.name )
	if(!tk) throw 'ld track not found by name: '+_tk.name

	if(!q.rglst) throw 'rglst missing'

	result.connheight = connheight
	result.ld[ tk.name ] = { rglst:[] }

	for(const r of q.rglst) {

		const r2 = {
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			reverse: r.reverse,
			xoff: r.xoff,
		}

		const pairs = []
		const coordset = new Set()

		// query for this variant
		const coord = (tk.nochr ? r.chr.replace('chr','') : r.chr)+':'+r.start+'-'+r.stop
		await utils.get_lines_tabix( [ tk.file, coord ], tk.dir, line=>{
			const l = line.split('\t')
			const start = Number.parseInt(l[1])
			if( start < r.start ) return
			const stop = Number.parseInt(l[2])
			if( stop > r.stop ) return
			if( result.__mposset ) {
				if( !result.__mposset.has( start )) return
				if( !result.__mposset.has( stop  )) return
			}
			const r2 = Number.parseFloat(l[3])
			pairs.push({start,stop,r2})
			coordset.add(start)
			coordset.add(stop)
		})

		r2.img = plot_img( r, pairs, coordset )

		result.ld[ tk.name ].rglst.push( r2 )
	}
}






function plot_img ( r, pairs, coordset ) {
/*
x1 ------------
x2 ------------
*/

	const [ binsize, coord2x2 ] = get_coord2x2( r, coordset )

	const coord2x1 = new Map()
	{
		const sf = (r.stop-r.start)/r.width
		for(const c of coordset) {
			if( r.reverse ) {
				coord2x1.set( c, (r.stop-c)/sf )
			} else {
				coord2x1.set( c, (c-r.start)/sf )
			}
		}
	}

	const canvasheight = connheight + r.width/2

	const canvas = createCanvas( r.width, canvasheight )
	const ctx = canvas.getContext('2d')
	ctx.strokeStyle = 'black'
	for(const c of coordset) {
		ctx.beginPath()
		ctx.moveTo( coord2x1.get( c ), 0 )
		ctx.lineTo( coord2x2.get( c ), connheight )
		ctx.closePath()
		ctx.stroke()
	}

	for(const pair of pairs) {
		const xstart = coord2x2.get(pair.start)
		const xstop = coord2x2.get(pair.stop)
		const xmid = (xstart+xstop)/2
		const y = connheight + Math.abs(xstop-xstart)/2

		const v = Math.floor(255*(1-pair.r2))
		ctx.fillStyle = 'rgb(255,'+v+','+v+')'
		ctx.beginPath()
		ctx.moveTo(xmid, y-binsize/2)
		ctx.lineTo(xmid-binsize/2, y)
		ctx.lineTo(xmid, y+binsize/2)
		ctx.lineTo(xmid+binsize/2, y)
		ctx.lineTo(xmid, y-binsize/2)
		ctx.closePath()
		ctx.fill()
	}

	return {
		height: canvasheight,
		src: canvas.toDataURL()
	}
}


function get_coord2x2 ( r, coordset ) {
	const binsize = r.width / coordset.size
	const coord2x2 = new Map()
	const lst = r.reverse ? [...coordset].sort((a,b)=>b-a) : [...coordset].sort((a,b)=>a-b)
	let x=0
	for(const a of lst) {
		coord2x2.set( a, x+binsize/2 )
		x+=binsize
	}
	return [ binsize, coord2x2 ]
}
