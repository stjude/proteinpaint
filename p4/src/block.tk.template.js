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

	}



	addview ( view ) {
	}

	removeview ( view ) {
	}



	// END of  class
}
