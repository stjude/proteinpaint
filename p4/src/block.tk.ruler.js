import {select as d3select,event as d3event, mouse as d3mouse} from 'd3-selection'
import {axisTop} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {basecolor, basecompliment} from './common'
import * as client from './client'
import {bplen} from './common'



const basecolorunknown = '#858585'
const color_dragbar_inactive = '#aaa'
const color_dragbar_active = '#FCA051'



export class TKruler {
	constructor ( block ) {

		this.ticksize = 4
		this.fontsize = 15
		this.tickpad = 3
		this.ntheight = 15

		block.init_dom_tk( this )
		this.gcloak.remove()

		this.tklabel
			.attr('font-weight','normal')

		for( const view of block.views ) {
			this.fill_view_init( view )
		}
	}


	fill_view_init ( view ) {
		/*
		call when initiating track or adding new views
		*/
		const tv = this.views[ view.id ]
		if(!tv) return

		// one axis across all regions of this view
		tv.axisfunc = axisTop( view.rulerscale )
			.tickSize( this.ticksize )
			.tickPadding( this.tickpad )

		tv.gaxis = tv.g.append('g')
		tv.gnt = tv.g.append('g')

		tv.cover = tv.g.append('rect')
			.attr('fill','white')
			.attr('fill-opacity',0)
			.on('mousemove',()=>{
				if(this.dragging) return
				this.hovertip( tv, view )
			})
			.on('mouseout',()=>{
				this.tip.hide()
			})
			.on('mousedown',()=>{
				if(this.block.ifbusy()) return
				this.dragging = true
				this.tip.hide()
				d3event.stopPropagation()
				d3event.preventDefault()

				const x0 = d3mouse( view.g.node() )[0] // within the view
				const h = this.block.tklst.reduce((i,j)=>i+j.tkheight, 0)

				const g = this.block.svg.drag

				g.g.attr('transform','translate('+(this.block.leftcolumnwidth+this.block.leftpad+view.x+x0)+',0) scale(1)')
				g.bar
					.attr('width',2)
					.attr('height',h)
					.attr('fill', color_dragbar_inactive)
				g.text
					.attr('x',0)
					.attr('y', h/2)
				const body = d3select( document.body )

				let x // current x
				body.on('mousemove',()=>{

					x = d3mouse( view.g.node() )[0]
					if(x < 0) x = 0
					else if(x > view.width) x = view.width

					if( x < x0 ){
						g.g.attr('transform','translate('+(this.block.leftcolumnwidth+this.block.leftpad+view.x+x)+',0)')
					}
					const w = Math.abs(x-x0)
					const bpw = Math.ceil( view.bpperpx * w )
					g.bar
						.attr('width', w)
						.attr('fill', (view.width/this.block.ntpxwidth) > bpw ? color_dragbar_inactive : color_dragbar_active )
					g.text
						.attr('x', w/2)
						.text( bplen( bpw ))
				})

				body.on('mouseup',()=>{
					this.dragging = false
					body.on('mousemove',null)
						.on('mouseup',null)
					g.g.attr('transform','scale(0)')
					const w = Math.abs(x-x0)
					const bpw = Math.ceil( view.bpperpx * w )
					if( bpw < view.width / this.block.ntpxwidth ) return
					this.block.zoom2px( view, Math.min(x,x0), Math.max(x,x0) )
				})
			})
	}


	async update ( ) {
		this.busy=true

		const row1height = this.fontsize + this.tickpad + this.ticksize

		this.tkheight = row1height
			+ ( this.block.views.find( i => i.bpperpx <= 1 )  ? this.ntheight + 2 : 0 ) // 2 for pad necessary
			+ this.toppad + this.bottompad

		for(const view of this.block.views) {
			const tv = this.views[ view.id ]
			if(!tv) continue

			const atbplevel = view.bpperpx <= 1

			let xshift = 0
			if( atbplevel ) {
				// shift gaxis to make ruler appears to be 1-based
				xshift = ( view.reverse ? 1 : -1 ) / (2*view.bpperpx)
			}


			client.neataxis(
				tv.gaxis
					.attr('transform', 'translate(' + xshift + ',' + row1height +')')
					.call( 
						tv.axisfunc.ticks( this.maxticknumber( view, tv ) )
					),
				this.fontsize
			)

			tv.cover
				.attr('width', view.width)
				.attr('height', this.tkheight)

			tv.gnt
				.attr('transform', 'translate(0,' + (row1height + 2) +')')  // 2 for pad necessary
				.selectAll('*').remove()

			if( atbplevel ) {
				await this.loadnt_view( tv, view )
			}

			// shift back to x=0 after panning
			tv.g.attr('transform','translate(0,' + this.y +')')
			tv.g_noclip.attr('transform','translate(0,' + this.y +')')
		}
		const tk = this
		this.tklabel
			.attr('y', row1height )
			.text( this.block.genome.name+' '+this.block.views[0].regions[0].chr )
			.each( function(){
				tk.left_width = this.getBBox().width
			})
		this.busy=false
		this.block.settle_height()
	}



	maxticknumber ( view, tv ) {
		const r1 = view.regions[ view.startidx ]
		const r2 = view.regions[ view.stopidx ]
		const pos = Math.max(
			r1.start,
			r1.stop,
			r2.start,
			r2.stop
		)
		const posstr = d3format(',.2r')(pos)
		let labelw
		tv.g.append('text')
			.text( posstr )
			.attr('font-size', this.fontsize)
			.attr('font-family', client.font)
			.each(function(){
				labelw = this.getBBox().width
			})
			.remove()
		return Math.floor( view.width / (labelw+60) )
	}



	async loadnt_view ( tv, view ) {
		/*
		load nt for portions of regions in viewport
		*/
		const basewidth = 1 / view.bpperpx

		// tentative base font size
		let _fs = Math.min( this.ntheight, basewidth / client.textlensf)
		if(_fs > 6 ) {
			// will print letters
		} else {
			// only draw bars
			_fs = 0
		}

		let x = 0
		for(let ri = view.startidx; ri<=view.stopidx; ri++) {

			const r = view.regions[ ri ]
			const regionwidth = (r.stop - r.start) / view.bpperpx

			// if to adjust start/stop when reverse??

			try {
				const seq = await this.loadnt( r.chr, r.start, r.stop )

				r.seq = seq

				if(_fs>0) {
					// show nt
					for(let i=0; i<seq.length; i++) {
						tv.gnt
							.append('text')
							.text( nt4view( seq, i, view ) )
							.attr('font-family','Courier')
							.attr('font-size', _fs )
							.attr('dominant-baseline','hanging')
							.attr('x', basewidth * i + basewidth/2 )
							.attr('y', 1) // shift necessary
							.attr('text-anchor','middle')
					}
				}
				for(let i=0; i<seq.length; i++) {
					const nt = nt4view( seq, i, view )
					tv.gnt
						.append('rect')
						.attr('x', i * basewidth )
						.attr('y', Math.min( this.ntheight - 2, _fs ) )
						.attr('width', basewidth )
						.attr('height', Math.max( 2, this.ntheight - _fs ) )
						.attr('fill', basecolor[ nt.toUpperCase() ] || basecolorunknown )
				}
			} catch(e) {
				tv.gnt.append('text')
					.attr('y', this.fontsize)
					.attr('x', x + regionwidth/2 )
					.attr('text-anchor','middle')
					.attr('fill', 'red')
					.text('Error getting sequence!')
				if(e.stack) console.log(e.stack)
			}

			x += regionwidth + view.regionspace
		}
	}



	loadnt ( chr,start,stop ) {
		const p = {
			genome: this.block.genome.name,
			chr: chr,
			start: start,
			stop: stop
		}
		return client.dofetch('ntseq',p)
		.then(data=>{
			if(data.error) throw data.error
			return data.seq
		})
	}


	addview ( view ) {
	}

	removeview ( view ) {
	}


	hovertip ( tv, view ) {
		this.tip.clear()
		const p = d3mouse( view.g.node() )
		const [ ridx, floatcoord ] = this.block.pxoff2region( view, p[0] )

		const coord = Math.ceil(floatcoord)
		this.tip.d
			.append('div')
			.text( view.regions[0].chr + ' : '+ coord )

		if(view.bpperpx <= 1) {
			// in bp mode
			const r = view.regions[ridx]
			if( r.seq ) {
				const nt = r.seq[ Math.floor(floatcoord)-r.start ]
				if( nt ) {
					if( view.reverse ) {
						const nt2 = basecompliment( nt )
						this.tip.d
							.append('div')
							.html( nt2
								+ ' <span style="background:'+(basecolor[nt2.toUpperCase()] || basecolorunknown)+'">&nbsp;&nbsp;</span>'
								+ ' <span style="font-size:.7em;opacity:.7">REVERSE</span>'
								)
					} else {
						this.tip.d
							.append('div')
							.html( nt
								+ ' <span style="background:'+(basecolor[nt.toUpperCase()] || basecolorunknown)+'">&nbsp;&nbsp;</span>'
								+ ' <span style="font-size:.7em;opacity:.7">FORWARD</span>'
								)
					}
				} else {
					// somehow it can be out of range
				}
			} else {
				// could be that sequence has not been loaded!
			}
		}
		this.tip.show( d3event.clientX, d3event.clientY )
	}


	show_configmenu () {
		this.configmenu.showunder( this.configlabel.node() )
			.d.style('left', (Number.parseInt(this.configmenu.d.style('left'))-50)+'px')
	}

	// END of  class
}




function nt4view ( seq, i, view ) {
	const nt = seq[ view.reverse ? seq.length-1-i : i ]
	if( view.reverse ) return basecompliment(nt)
	return nt
}
