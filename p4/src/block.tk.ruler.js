//import {scaleLinear} from 'd3-scale'
//import {select as d3select,selectAll as d3selectAll,event as d3event,mouse as d3mouse} from 'd3-selection'
//import {transition} from 'd3-transition'
//import {format as d3format} from 'd3-format'
import {axisTop} from 'd3-axis'
import {basecolor, basecompliment} from './common'
import * as client from './client'



const basecolorunknown = '#858585'




export class TKruler {
	constructor ( block ) {

		this.ticksize = 4
		this.fontsize = 15
		this.tickpad = 3
		this.ntheight = 15

		block.init_dom_tk( this )

		this.tklabel
			.attr('font-weight','normal')

		for( const view of block.views ) {
			this.fill_view_init( view )
		}

		this.update()
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
	}


	async update ( ) {

		const row1height = this.fontsize + this.tickpad + this.ticksize

		this.height = row1height + ( this.block.views.find( i => i.bpperpx <= 1 )  ? this.ntheight : 0 )

		for(const view of this.block.views) {
			const tv = this.views[ view.id ]
			if(!tv) continue

			const atbplevel = view.bpperpx <= 1

			let xshift = 0
			if( atbplevel ) {
				// shift gaxis to make ruler appears to be 1-based
				xshift = ( view.reverse ? 1 : -1 ) / (2*view.bpperpx)
			}

			tv.gaxis
				.attr('transform', 'translate(' + xshift + ',' + row1height +')')
				.call( tv.axisfunc )


			tv.gaxis.selectAll('text')
				.attr('font-family',client.font)
				.attr('font-size', this.fontsize)


			tv.cover
				.attr('width', view.width)
				.attr('height', this.height)

			tv.gnt
				.attr('transform', 'translate(0,' + row1height +')')
				.selectAll('*').remove()

			if( atbplevel ) {
				this.loadnt_view( tv, view )
			}

			// shift back to x=0 after panning
			tv.g.attr('transform','translate(0,' + this.y +')')
		}
		const tk = this
		this.tklabel
			.attr('y', row1height )
			.text( this.block.genome.name+' '+this.block.views[0].regions[0].chr )
			.each( function(){
				tk.left_width = this.getBBox().width
			})
	}


	async loadnt_view ( tv, view ) {
		// load nt for portions of regions in viewport
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
							.attr('y', 2) // shift down??
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


	// END of  class
}




function nt4view ( seq, i, view ) {
	const nt = seq[ view.reverse ? seq.length-1-i : i ]
	if( view.reverse ) return basecompliment(nt)
	return nt
}
