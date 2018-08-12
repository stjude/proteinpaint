import {scaleLinear} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import * as client from './client'





const tklabelxshift = -3 // shift label to left away from axis



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
				.attr('x', tklabelxshift)
				.text(this.name)
				.each(function(){
					tk.left_width = this.getBBox().width - tklabelxshift
				})
		}

		this.leftaxis = this.gleft.append('g')
		this.axisfontsize = 12
		this.toppad = this.bottompad = this.axisfontsize/2

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

			this.block.tkcloakoff(this)
			this.tkheight = this.toppad+this.barheight+this.bottompad
			this.tklabel.transition().attr('y', this.barheight/2 + this.block.tklabelfontsize/3 )

			for(const id in data.view2img) {
				const imgv = data.view2img[ id ]
				const tv = this.views[ id ]
				tv.img
					.attr('width', imgv.width)
					.attr('height', this.barheight)
					.attr('xlink:href', imgv.src)
				tv.g.attr('transform','translate(0,'+this.y+')')
				tv.g_noclip.attr('transform','translate(0,'+this.y+')')
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
		this.block.settle_height()
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



	show_configmenu () {
		this.configmenu.clear()
		{
			const row = this.configmenu.d.append('div')
				.style('margin-bottom','5px')
			row.append('span')
				.html('Height&nbsp;&nbsp;')
			row.append('input')
				.attr('type','number')
				.style('width', '70px')
				.property('value', this.barheight)
				.on('keyup',()=>{
					if(d3event.key != 'Enter') return
					const h = Number.parseInt(d3event.target.value)
					if(Number.isNaN(h)) return
					if(h <= 1) return
					if(h == this.barheight) return
					this.barheight = h
					this.update()
				})
		}
		this.configmenu.showunder( this.configlabel.node() )
			.d.style('left', (Number.parseInt(this.configmenu.d.style('left'))-50)+'px')
	}



	// END of  class
}
