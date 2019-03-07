import * as client from './client'
import * as common from './common'
//import {axisTop} from 'd3-axis'
//import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'



/*
make bachart for data from a term

*/



export function barchart_make ( arg ) {
/*

.items[]
	server returned data
	[0] item name
	[1] count
.holder
.term{}
	.graph.barchart{}
		provides predefined chart customization, to be implemented:
		- fixed y scale
		- log scale
*/

console.log(arg) // for testing only

	const svg = arg.holder.append('svg')

	// set y axis min/max scale
	const [yscale_min, yscale_max] = set_yscale( arg )

	/* plot vertical bars
	each bar has equal width
	set bar width based on number of data points to make it comfortable
	plot item labels under bar, with 45. rotation
	*/
	// const barwidth = barchart_setbarwidth( arg )
	// also derive label font size
	const label_fontsize = 12

	const max_label_height = get_max_labelheight( arg, label_fontsize, svg  )
	console.log(max_label_height)


	// set y axis height


	const bar_space = 2

	const yaxis_width = 50


	// set svg dimention
}



function set_yscale ( arg ) {
/* determine y axis range
*/
	/* TODO if term predefines y scale, return it
	if( arg.term.graph.barchart.fixedyscale) {
		return arg.term.graph.barchart.fixedyscale
	}
	*/


	// get min/max from bar numeric values
	let min = arg.items[0][1],
		max = min
	for( let i of arg.items ) {
		min = Math.min( min, i[1] )
		max = Math.max( max, i[1] )
	}


	// if min >0, then set min to 0
	if( min >= 0 ) return [ 0, max ]

	// if max < 0, then set max to 0
	if( max <= 0 ) return [ min, 0 ]

	// remaining case should be min<0, max>0
	return [ min, max ]
}



function get_max_labelheight ( arg, fontsize, svg ) {

	let textwidth = 0

	for(const i of arg.items) {
		svg.append('text')
			.text( i[0] )
			.attr('font-family', client.font)
			.attr('font-size', fontsize)
			.each( function() {
				textwidth = Math.max( textwidth, this.getBBox().width )
			})
			.remove()
	}

	return textwidth
}
