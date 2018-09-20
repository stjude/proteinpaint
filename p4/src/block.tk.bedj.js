import {scaleLinear} from 'd3-scale'
import {event as d3event, mouse as d3mouse} from 'd3-selection'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {basecolor, basecompliment} from './common'
import * as client from './client'




const tklabelxshift = -3 // just like bw




export class TKbedj {
	constructor ( temp, block ) {

		block.init_dom_tk( this )

		this.name = temp.name
		this.file = temp.file
		this.url = temp.url
		this.indexURL = temp.indexURL
		this.categories = temp.categories
		// allow file/url to be missing and treat as native track

		if(this.categories) {
			// legend
			this.legend.td1.text( this.name )
			this.legend.category_holder = this.legend.showdiv.append('div')
		} else {
			this.legend.tr.remove()
		}

		for( const view of block.views ) {
			this.fill_view_init( view )
		}

		// in case of density view
		this.leftaxis = this.gleft.append('g')
		this.axisfontsize = 12
		this.axisfunc = axisLeft()
		this.barheight = 50
		this.stackheight = temp.stackheight || 16
		this.stackspace = temp.stackspace || 1
		this.color = temp.color || '#6188FF'
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
			name: this.name,
			file: this.file,
			url: this.url,
			indexURL: this.indexURL,
			barheight: this.barheight,
			stackheight: this.stackheight,
			stackspace: this.stackspace,
			color: this.color,
			categories: this.categories,
		}

		this.block.tkcloakon( this )
		{
			const tk = this
			this.tklabel
				.text(this.name)
				.each(function(){
					tk.left_width = this.getBBox().width
				})
		}

		try {


			const data = await this.getdata( p )

			if( data.maxdepth ) {

				// using density for at least one view
				this.toppad = this.bottompad = this.axisfontsize/2
				// show axis
				this.axisfunc.scale(
					scaleLinear()
						.domain([ data.maxdepth, 0 ])
						.range([ 0, this.barheight ])
					)
					.tickValues([ 0, data.maxdepth ])
					.tickFormat( d3format('d'))
				client.neataxis(
					this.leftaxis.call( this.axisfunc ),
					this.axisfontsize
				)
				this.tklabel
					.transition()
					.attr('x', -3)
					.attr('y', this.barheight/2 + this.block.tklabelfontsize/3 )
				this.left_width += 3

			} else {
				// no axis
				this.leftaxis.selectAll('*').remove()
				this.toppad = this.bottompad = 3
				this.tklabel
					.transition()
					.attr('x', 0)
					.attr('y', this.block.tklabelfontsize )

			}

			// variable view height: one view may be stack, another may be density
			let max_viewheight = 0

			for(const view of data.views) {
				const tv = this.views[ view.id ]
				if(!tv) continue

				tv.img
					.attr('width', view.width )
					.attr('height', view.height)
					.attr('xlink:href', view.src)

				max_viewheight = Math.max( max_viewheight, view.height )

				// after updating, shift back to x=0 to conclude panning
				tv.g.attr('transform','translate(0,' + this.y +')')
				tv.g_noclip.attr('transform','translate(0,' + this.y +')')
			}

			this.block.tkcloakoff( this )
			this.tkheight = this.toppad + max_viewheight + this.bottompad

			this.mayupdatelegend( data )

		} catch(e) {
			if(e.stack) console.log(e.stack)
			this.block.tkerror( this, e.message || e)
		}

		//this.block.settle_width()
		this.block.settle_height()
	}


	getdata ( p ) {
		return client.dofetch('tkbedj',p)
		.then(data=>{
			if(data.error) throw data.error
			return data
		})
	}


	addview ( view ) {
	}

	removeview ( view ) {
	}


	mayupdatelegend ( data ) {
		if(!this.legend.tr) return

		// categories, may support other items
		if( this.categories ) {
			this.legend.category_holder.selectAll('*').remove()
			const lst = []
			for(const k in data.categories || {} ) {
				const o = data.categories[k]
				o.k = k
				lst.push( o )
			}
			lst.sort((i,j)=>j.count-i.count)

			for(const o of lst) {
				const cat = this.categories[ o.k ]
				const cell = this.legend.category_holder.append('div')
					.style('display','inline-block')
					.style('margin','3px')
					.attr('class','sja_clbbox')
					.style('padding','3px 8px')
				cell.append('span')
					.text( o.count )
					.style('padding','0px 3px')
					.style('margin-right','4px')
					.style('background', cat.color)
					.style('color','white')
					.style('font-size','.8em')
				cell.append('span')
					.text( cat.label )
					.style('color', cat.color)
			}
		}
	}


	show_configmenu () {
		this.configmenu.showunder( this.configlabel.node() )
			.d.style('left', (Number.parseInt(this.configmenu.d.style('left'))-50)+'px')
	}


	// END of  class
}
