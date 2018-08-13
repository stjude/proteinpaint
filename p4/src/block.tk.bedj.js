import {scaleLinear} from 'd3-scale'
import {event as d3event, mouse as d3mouse} from 'd3-selection'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {basecolor, basecompliment} from './common'
import * as client from './client'








export class TKbedj {
	constructor ( temp, block ) {

		block.init_dom_tk( this )

		this.name = temp.name
		this.file = temp.file
		this.url = temp.url
		this.indexURL = temp.indexURL
		this.issnp = temp.issnp
		if( this.issnp ) {
			// snp track to be validated on server side
		} else {
			if(!this.file && !this.url) throw 'no file or url given'
		}

		this.tklabel.text(this.name)

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
			issnp: this.issnp,
			file: this.file,
			url: this.url,
			indexURL: this.indexURL,
			barheight: this.barheight,
			stackheight: this.stackheight,
			stackspace: this.stackspace,
			color: this.color,
		}

		this.block.tkcloakon( this )

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


	show_configmenu () {
		this.configmenu.showunder( this.configlabel.node() )
			.d.style('left', (Number.parseInt(this.configmenu.d.style('left'))-50)+'px')
	}


	// END of  class
}
