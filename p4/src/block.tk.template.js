import {event as d3event, mouse as d3mouse} from 'd3-selection'
import {axisTop} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {basecolor, basecompliment} from './common'
import * as client from './client'


// JUST A TEMPLATE






export class TKwhat {
	constructor ( block ) {

		block.init_dom_tk( this )

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
		this.block.busy = true

		for(const view of this.block.views) {
			const tv = this.views[ view.id ]
			if(!tv) continue


			// shift back to x=0 after panning
			tv.g.attr('transform','translate(0,' + this.y +')')
			tv.g_noclip.attr('transform','translate(0,' + this.y +')')
		}
		this.block.settle_height()
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
