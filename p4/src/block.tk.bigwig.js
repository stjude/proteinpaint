import {event as d3event, mouse as d3mouse} from 'd3-selection'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import * as client from './client'








export class TKbigwig {
	constructor ( temp, block ) {

		block.init_dom_tk( this )

		this.name = temp.name
		this.file = temp.file
		this.url = temp.url
		if(!this.file && !this.url) throw 'no file or url given'

		{
			const tk=this
			this.tklabel
				.text(this.name)
				.each(function(){
					tk.left_width = this.getBBox().width
				})
		}

		this.leftaxis = this.gleft.append('g')
		this.axisfontsize = 12

		this.scale = {}
		if(temp.scale) {
			for(const k in temp.scale) this.scale[k]=temp.scale[k]
		} else {
			this.scale.auto=1
		}
		this.axisfunc = axisLeft()

		if(this.normalize) {
		} else {
			// disable by default
			this.normalize = {
				dividefactor:1,
				disable:1
			}
		}
		this.barheight = temp.height || 50
		this.tkheight = this.toppad+this.barheight+this.bottompad
		if(!this.ncolor) this.ncolor='#BD005E'
		if(!this.ncolor2) this.ncolor2='#5E00BD'
		if(!this.pcolor) this.pcolor='#005EBD'
		if(!this.pcolor2) this.pcolor2='#FA7D00'

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
		tv.img = tv.g.append('image')
	}


	async update ( ) {
		const p = {
			genome: this.block.genome.name,
			views: this.block.param_viewrange(),
			file: this.file,
			url: this.url,
			barheight: this.barheight,
			scale: this.scale,
			pcolor: this.pcolor,
			pcolor2: this.pcolor2,
			ncolor: this.ncolor,
			ncolor2: this.ncolor2,
		}
		if(!this.normalize.disable) {
			p.dividefactor = this.normalize.dividefactor
		}

		this.block.tkcloakon(this)

		try {
			const data = await this.getdata( p )
			if(data.nodata) throw 'no data in view range'

			this.block.tkcloakoff(this)
			this.tkheight = this.toppad+this.barheight+this.bottompad
			this.tklabel.transition().attr('y', this.tkheight/2 )

			for(const id in data.views) {
				const imgv = data.views[id]
				const tv = this.views[id]
				tv.img
					.attr('width', imgv.width)
					.attr('height', tk.barheight)
					.attr('xlink:href', imgv.src)
			}

			if(this.scale.auto) {
				this.scale.min = data.min
				this.scale.max = data.max
			}
			this.axisfunc.scale(
				scaleLinear()
					.domain([this.scale.max, this.scale.min])
					.range([0, this.barheight])
				).tickValues([ this.scale.max, this.scale.min ])
			client.neataxis(
				this.leftaxis.call( this.axisfunc ),
				this.axisfontsize
			)

		} catch(e) {
			if(e.stack) console.log(e.stack)
			this.block.tkerror( this, e.message||e )
			for(const id in this.views) {
				this.views[id].img.attr('width',1).attr('height',1)
			}
		}
	}


	getdata ( p ) {
		return client.dofetch( 'bigwig', p )
		.then(data=>{
			if(data.error) throw data.error
			return data
		})
	}



	addview ( view ) {
	}

	removeview ( view ) {
	}



	// END of  class
}
