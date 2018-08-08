import {scaleLinear} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event,mouse as d3mouse} from 'd3-selection'
import {transition} from 'd3-transition'
import {format as d3format} from 'd3-format'
import {axisTop, axisLeft} from 'd3-axis'
import * as coord from './coord'
import * as common from './common'
import * as client from './client'
import {validate_parameter_init} from './block.init'







export class Block {


async init ( arg ) {
	/* initiate new block with async steps
	*/
	try {
		validate_parameter_init( arg, this )
	} catch(e) {
		if(e.stack) console.log(e.stack)
		const m = 'Error: '+(e.message || e)
		if(this.holder) {
			client.sayerror( this.holder, m )
		} else {
			alert( m )
		}
		return
	}


	arg.tklst.unshift({type:common.tkt.ruler})

	for(const t of arg.tklst) {
		try {
			await this.addtk_bytype( t )
		} catch(e) {
			if(e.stack) console.log(e.stack)
			client.sayerror( this.holder, 'Error creating '+t.type+' track "'+t.name+'": ' + (e.message||e) )
			return
		}
	}

	// upon init, must provide valid view width for track updating
	this.setwidth_views()

	await this.update_tracks()
}



static async create ( arg ) {
	const block = new Block()
	await block.init( arg )
	return block
}




async update_tracks ( lst ) {
	/*
	given list or all

	for each track, update all views, even if it is triggered by just one view
	*/

	const dolst = lst || this.tklst
	for(const tk of dolst) {
		await tk.update()
	}
	this.settle_height()
	this.setwidth_svg()
	this.busy = false
}



setwidth_views () {
	/*
	call after changing width of anything in the middle
	do not shift any dom
	*/

	let x = 0
	for(const v of this.views) {

		v.x = x
		v.g.attr('transform','translate('+x+',0)')

		if(v.regions) {
			// set view width by portions of regions in view range
			v.width = ( v.stopidx - v.startidx ) * v.regionspace
			for(let i=v.startidx; i<=v.stopidx; i++) {
				const r = v.regions[ i ]
				v.width += ( r.stop - r.start ) / v.bpperpx
			}
			v.cliprect.attr('width', v.width+1 )
		} else {
			// something else
			v.width=100
		}
		x += v.width + v.rightpad
	}
}




setwidth_svg () {
	// only call after updating tracks

	this.leftcolumnwidth = 100
	for(const tk of this.tklst) {
		this.leftcolumnwidth = Math.max( this.leftcolumnwidth, tk.left_width )
	}

	this.width = this.leftcolumnwidth + this.leftpad
		+ this.views.reduce( (i,j) => i+j.width+j.rightpad, 0 )
		- this.views[this.views.length-1].rightpad
		+ this.rightpad + this.rightcolumnwidth

	this.svg.svg
		.transition()
		.attr('width', this.width)
	this.svg.gleft
		.transition()
		.attr('transform','translate('+this.leftcolumnwidth+',0)')
	this.svg.gmiddle
		.transition()
		.attr('transform','translate('+(this.leftcolumnwidth+this.leftpad)+')')
	this.svg.gright
		.transition()
		.attr('transform','translate('+(this.width-this.rightcolumnwidth)+',0)')
}



settle_height () {
	/*
	call after updating any track
	*/
	let yoff = 0
	for(const tk of this.tklst) {
		yoff += tk.toppad
		tk.y = yoff
		tk.gleft.transition().attr('transform','translate(0,'+yoff+')')
		tk.gright.transition().attr('transform','translate(0,'+yoff+')')
		for(const id in tk.views) {
			const tv = tk.views[id]
			tv.g.transition().attr('transform','translate(0,'+yoff+')')
			tv.g_noclip.transition().attr('transform','translate(0,'+yoff+')')
		}
		yoff += tk.tkheight + tk.bottompad
	}
	this.height = yoff

	// update cliprect height
	for(const v of this.views) {
		v.cliprect.attr('height', this.height)
	}
	this.svg.svg
		.transition()
		.attr('height', this.height)
}








////////////////////////////////// __tk


init_dom_tk ( tk ) {
	/*
	call for a newly created tk
	initialize common things
	*/

	tk.tkid = Math.random().toString()
	tk.block = this
	tk.left_width = tk.right_width = 100
	tk.y = 0 // shift by
	tk.toppad = 3
	tk.bottompad = 3
	tk.tkheight = 30

	tk.tip = new client.Menu({padding:'5px'})

	tk.gleft = this.svg.gleft.append('g') // y shift
	tk.tklabel = tk.gleft
		.append('text')
		.attr('fill','black')
		.attr('font-family',client.font)
		.attr('font-size', this.tklabelfontsize)
		.attr('font-weight','bold')
		.attr('text-anchor','end')
		.attr('y', this.tklabelfontsize)
		.on('mousedown',()=>{
			// TODO
		})

	tk.gright = this.svg.gright.append('g') // y shift
	tk.configlabel = tk.gright
		.append('text')
		.text('CONFIG')
		.attr('fill','#ccc')
		.attr('font-family',client.font)
		.attr('font-size', this.tklabelfontsize)
		.attr('y', this.tklabelfontsize)
		.on('click',()=>{
			// TODO
		})

	tk.views = {}
	for( const view of this.views ) {
		this.add_view_2tk( tk, view )
	}

	// not attached to views
	tk.gcloak = tk.gleft.append('g')
	tk.cloakbox = tk.gcloak.append('rect')
		.attr('fill','white')
	tk.cloaktext = tk.gcloak.append('text')
		.text('Loading ...')
		.attr('fill','black')
		.attr('fill-opacity',.5)
		.attr('font-size','1.5em')
		.attr('font-weight','bold')
		.attr('font-family',client.font)
		.attr('text-align','center')
		.attr('dominant-baseline','central')
	tk.gerror = tk.gleft.append('g')
	tk.errortext = tk.gerror.append('text')
		.attr('fill','black')
		.attr('font-weight','bold')
		.attr('font-family',client.font)
		.attr('font-size', this.tklabelfontsize)
		.attr('text-align','center')
		.attr('dominant-baseline','central')
}


tkcloakon ( tk ) {
	tk.gerror.attr('transform','scale(0)') // clear error
	tk.gcloak
		.attr('transform','scale(1)')
		.attr('fill-opacity',0)
		.transition()
		.attr('fill-opacity',.5)
	const w = this.width - this.leftcolumnwidth - this.leftpad - this.rightpad - this.rightcolumnwidth
	tk.cloakbox
		.attr('width', w)
		.attr('height', tk.tkheight )
	tk.cloaktext
		.attr('x', w/2)
		.attr('y', tk.tkheight/2)
}

tkcloakoff ( tk ) {
	tk.gcloak.attr('transform','scale(0)')
}

tkerror ( tk, m ) {
	tk.gcloak.attr('transform','scale(0)') // hide cloak
	tk.gerror.attr('transform','scale(1)')
	const w = this.width - this.leftcolumnwidth - this.leftpad - this.rightpad - this.rightcolumnwidth
	tk.errortext
		.attr('x', w/2)
		.attr('y', tk.tkheight/2)
		.text( 'Error: '+m )
}


add_view_2tk ( tk, view ) {
	/* addings things about a view to a tk
	do not update
	*/
	const tv = {
		g: view.gscroll.append('g'), // y shift
		g_noclip: view.gscroll_noclip.append('g'), // y shift
		viewheight: 30
	}

	tk.views[ view.id ] = tv
}


////////////////////////////////// __tk ends





////////////////////////////////// __coord and view range



view_updaterulerscale ( view ) {
	/*
	call after updating view port and resolution
	do:
		print coord
		update ruler scale 
		toggle zoom buttons
	*/
	if(!view.regions) return

	if( this.views.find(i=>i.regions).id == view.id ) {
		// this view is the first in the list
		if( this.dom.coord && this.dom.coord.input ) {
			const r1 = view.regions[view.startidx]
			const r2 = view.regions[view.stopidx]
			const start = Math.min(r1.start,r1.stop, r2.start,r2.stop)
			const stop = Math.max(r1.start,r1.stop, r2.start,r2.stop)
			this.dom.coord.input.property( 'value', r1.chr+':'+start+'-'+stop )
			this.dom.coord.says.text( common.bplen(stop-start))
		}

		if(this.dom.zoom) {
			this.dom.zoom.in2.attr('disabled',null)
			this.dom.zoom.out2.attr('disabled',null)
			this.dom.zoom.out10.attr('disabled',null)
			this.dom.zoom.out50.attr('disabled',null)

			if( 1/view.bpperpx >= this.ntpxwidth ) {
				this.dom.zoom.in2.attr('disabled',1)
			} else {
				if(view.startidx==0 && view.stopidx==view.regions.length-1) {
					let atmax=false
					const r1 = view.regions[view.startidx]
					const r2 = view.regions[view.stopidx]
					if(view.reverse) {
						atmax = r1.stop >= r1.bstop && r2.start <= r2.bstart
					} else {
						atmax = r1.start <= r1.bstart && r2.stop >= r2.bstop
					}
					if(atmax) {
						this.dom.zoom.out2.attr('disabled',1)
						this.dom.zoom.out10.attr('disabled',1)
						this.dom.zoom.out50.attr('disabled',1)
					}
				}
			}
		}
	}

	const domains = []
	const ranges = []

	let x = 0

	for(let i=view.startidx; i<=view.stopidx; i++) {
		const r = view.regions[ i ]
		domains.push( view.reverse ? r.stop : r.start )
		domains.push( view.reverse ? r.start : r.stop )

		ranges.push( x )
		x += (r.stop - r.start)/ view.bpperpx
		ranges.push( x )
		x += view.regionspace
	}

	view.rulerscale.domain( domains ).range( ranges )
}




pannedby ( view, xoff ) {
	/*
	is async!!!!

	call after panning by a distance
	*/
	if( xoff == 0 ) return

	let nope = false
	if(xoff < 0) {
		// test right
		if( view.stopidx == view.regions.length-1 ) {
			const r = view.regions[ view.stopidx ]
			if( view.reverse ) {
				if( r.start <= r.bstart ) nope =true
			} else {
				if( r.stop >= r.bstop ) nope=true
			}
		}
	} else {
		// test left
		if( view.startidx == 0 ) {
			const r = view.regions[ 0 ]
			if( view.reverse ) {
				if( r.stop >= r.bstop ) nope=true
			} else {
				if( r.start <= r.bstart ) nope=true
			}
		}
	}
	if(nope) {
		view.gscroll.transition().attr('transform','translate(0,0)')
		view.gscroll_noclip.transition().attr('transform','translate(0,0)')
		return
	}

	view.gscroll.attr('transform','translate(0,0)')
	view.gscroll_noclip.attr('transform','translate(0,0)')

	// before track actually udpates, keep shifted
	for(const tk of this.tklst) {
		const tv = tk.views[ view.id ]
		if(!tv) continue
		tv.g.attr( 'transform', 'translate(' + xoff + ',' + tk.y + ')' )
	}

	this.zoom2px( view, -xoff, view.width-xoff )
}



async zoom2px ( view, px1, px2 ) {
	/*
	for pan and zoom
	*/
	if(!view.regions) return

	this.busy = true

	const pxstart = Math.min( px1, px2 )
	const pxstop  = Math.max( px1, px2 )
	// update viewport
	const [ ridx1, float1 ] = this.pxoff2region( view, pxstart )
	const [ ridx2, float2 ] = this.pxoff2region( view, pxstop  )

	let pos1, pos2 // integer
	if( view.reverse ) {
		pos1 = Math.floor(float2)
		pos2 = Math.ceil(float1)
	} else {
		pos1 = Math.floor(float1)
		pos2 = Math.ceil(float2)
	}

	view.startidx = ridx1
	view.stopidx  = ridx2

	let totalbpinviewport = 0

	if( ridx1 == ridx2 ) {

		const r = view.regions[ ridx1 ]
		r.start = pos1
		r.stop  = pos2
		totalbpinviewport = pos2 - pos1

	} else {

		const r1 = view.regions[ ridx1 ]
		const r2 = view.regions[ ridx2 ]
		/*
		     -----------
		>>>>>|>>>  >>>>|>>>>>
		<<<<<|<<<  <<<<|<<<<<
		     -----------
		*/
		if( view.reverse ) {
			r1.start = r1.bstart
			r1.stop = pos1
			r2.start = pos2
			r2.stop = r2.bstop
		} else {
			r1.start = pos1
			r1.stop = r1.bstop
			r2.start = r2.bstart
			r2.stop = pos2
		}

		totalbpinviewport = r1.stop-r1.start + r2.stop-r2.start
		for(let i=ridx1+1; i<ridx2; i++) {
			const r = view.regions[ i ]
			totalbpinviewport += r.bstop - r.bstart
		}
	}

	// view px width stays same despite coord change
	view.bpperpx = totalbpinviewport / ( view.width - (ridx2-ridx1) * view.regionspace )

	this.view_updaterulerscale( view )

	await this.update_tracks()
}




pxoff2region ( view, px ) {
	if(!view.regions) return
	let coord = view.rulerscale.invert( px )
	let regionidx
	if(px > 0) {
		// to right
		for(regionidx = view.startidx; regionidx<view.regions.length; regionidx++) {
			const r = view.regions[ regionidx ]
			let remainbp // remaining bp from this region
			if( regionidx == view.startidx ) {
				if( view.reverse ) {
					remainbp = r.stop - r.bstart
				} else {
					remainbp = r.bstop - r.start
				}
			} else {
				remainbp = r.bstop - r.bstart
			}
			const remainpx = remainbp / view.bpperpx
			if( remainpx >= px ) {
				break
			}
			px -= remainpx + view.regionspace
		}

		if( regionidx >= view.regions.length ) {
			// out of bound, use rightmost point
			regionidx = view.regions.length-1
			const r = view.regions[regionidx]
			return [ regionidx, view.reverse ? r.bstart : r.bstop ]
		}

	} else {
		// to left
		px *= -1
		for(regionidx = view.startidx; regionidx >=0; regionidx--) {
			const r = view.regions[ regionidx ]
			let remainbp
			if( regionidx == view.startidx ) {
				if( view.reverse ) {
					remainbp = r.bstop - r.stop
				} else {
					remainbp = r.start - r.bstart
				}
			} else {
				remainbp = r.bstop - r.bstart
			}
			const remainpx = remainbp / view.bpperpx
			if( remainpx >= px ) {
				break
			}
			px -= remainpx + view.regionspace
		}

		if(regionidx < 0) {
			// out of bound, use leftmost
			const r = view.regions[0]
			return [0, view.reverse ? r.bstop : r.bstart ]
		}
	}
	return [ regionidx, coord ]
}



async zoomin_default ( fold ) {
	/*
	default only act on the first view
	*/
	await this.zoomin( fold, this.views.find( i=> i.regions) )
}


async zoomout_default ( fold ) {
	await this.zoomout( fold, this.views.find( i=> i.regions) )
}

async zoomin ( fold, view ) {
	if(fold<2) return alert('invalid zoomin fold '+fold)
	const dist = Math.floor(view.width / (fold*2) )
	await this.zoom2px( view, dist, view.width-dist )
}

async zoomout ( fold, view ) {
	if(fold<2) return alert('invalid zoom out fold '+fold)
	const dist = Math.floor( (view.width * (fold-1))/2 )
	await this.zoom2px( view, -dist, view.width+dist )
}


param_viewrange () {
	const lst = []
	for(const view of this.views) {
		if(!view.regions) continue
		const v2 = {
			reverse: view.reverse,
			regions:[],
			regionspace: view.regionspace,
		}
		for(let i=view.startidx; i<=view.stopidx; i++) {
			const r = view.regions[i]
			v2.regions.push[ {
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: Math.ceil( (r.stop-r.start) / view.bpperpx )
			}]
		}
		lst.push(v2)
	}
	return lst
}


/////////////////////////////////// end of __coord and view range


addtk_bytype( t ) {
	if(t.type == common.tkt.bigwig) {
		return import('./block.tk.bigwig').then(_=>this.tklst.push( new _.TKbigwig( t, this) ) )
	}
	if(t.type == common.tkt.ruler) {
		return import('./block.tk.ruler').then(_=> this.tklst.push( new _.TKruler( this ) ) )
	}
}



// END of block
}




