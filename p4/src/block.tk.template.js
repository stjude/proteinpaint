import {event as d3event, mouse as d3mouse} from 'd3-selection'
import {axisTop} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {basecolor, basecompliment} from './common'
import * as client from './client'


// JUST A TEMPLATE






export class TKwhat {
	constructor ( temp, block ) {

		block.init_dom_tk( this )
		this.name = temp.name
		this.file = temp.file
		this.url = temp.url
		this.indexURL = temp.indexURL
		this.tklabel.text( this.name )

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
	}


	async update ( ) {
		const p = {
			genome: this.block.genome.name,
			views: this.block.param_viewrange(),
			file: this.file,
			url: this.url,
		}

		this.block.tkcloakon( this )

		try {
			const data = await this.getdata( p )

			this.block.tkcloakoff( this )
			//this.tkheight = this.toppad + data.height + this.bottompad

			for(const view of this.block.views) {
				const tv = this.views[ view.id ]
				if(!tv) continue


				// after updating, shift back to x=0 to conclude panning
				tv.g.attr('transform','translate(0,' + this.y +')')
				tv.g_noclip.attr('transform','translate(0,' + this.y +')')
			}
		} catch(e) {
			if(e.stack) console.log(e.stack)
			this.block.tkerror( this, e.message || e)
		}

		//this.block.settle_width()
		this.block.settle_height()
	}



	getdata ( p ) {
		return client.dofetch('bedj',p)
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
