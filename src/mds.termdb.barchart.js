import * as client from './client'
import * as common from './common'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {scaleLinear,scaleOrdinal,schemeCategory10,scaleLog} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import { stringify } from 'querystring';



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

	// console.log(arg) // for testing only

	//constant variables
	let barheight=300,
	barwidth=20,
	space=5,
	axisheight=barheight+5,
	barspace=2,
	maxlabelwidth=0,
	maxvalue=0

	const items_len = arg.items.length
	const button_row = arg.holder.append('div')
		.style('height','30px')
		.style('margin','2px 0')
	
	button_row.append('span')
		.text('Y Axis - Log Scale')
		.style('font-size','.8em')
		.style('margin','10px 0')
		.style('position', 'absolute')
		.style('right','60px')
	
	const scale_btn = button_row.append('input')
		.attr('type', 'checkbox')
		.attr('class','scale_switch')
		.style('position', 'absolute')
		.style('margin','10px 0')
		.style('right','40px')
	
	const button = button_row.append('div')
		.style('display','inline-block')
		.style('right','200px')
		.style('position', 'absolute')
		.style('margin-top','5px')
		.style('font-size','.8em')
		.attr('class','sja_menuoption')
		.text('CROSSTAB')

	const svg = arg.holder.append('svg')
	const axisg=svg.append('g')

	// set y axis min/max scale
	const [yscale_min, yscale_max] = set_yscale( arg )

	// also derive label font size
	const label_fontsize = 15

	const max_label_height = get_max_labelheight( arg, label_fontsize, svg  )

	// set y axis height

	const yaxis_width = 70

	/* plot vertical bars
	each bar has equal width
	set bar width based on number of data points to make it comfortable
	plot item labels under bar, with 45. rotation
	*/
	
	// define svg height and width
	const svg_width = items_len*(barwidth+barspace)+(space*2)+yaxis_width,
	svg_height = axisheight+max_label_height+space
	svg.attr('width', svg_width)
	.attr('height', svg_height)


	// Y axis
	axisg.attr('transform','translate('+yaxis_width+','+space+')')
		.call(axisLeft().scale(
			scaleLinear().domain([yscale_max,0]).range([0,barheight])
			)
			.tickFormat(d3format('d'))
		)
	client.axisstyle({
		axis:axisg,
		showline:true,
		fontsize:barwidth*.8,
		color:'black'
	})

	// console.log(arg)
	// Y axis scale toggle 

	scale_btn.on('click',()=>{ 
			if (d3select('.scale_switch').property('checked') == false){
				axisg.attr('transform','translate('+yaxis_width+','+space+')')
				.call(axisLeft().scale(
					scaleLinear().domain([yscale_max,0]).range([0,barheight])
					)
					.tickFormat(d3format('d'))
				)
			} else {
				axisg.attr('transform','translate('+yaxis_width+','+space+')')
				.call(axisLeft().scale(
					scaleLog().domain([yscale_max,1]).range([0,barheight])
					)
					.ticks(10, d3format('d'))
				)
			}
			client.axisstyle({
				axis:axisg,
				showline:true,
				fontsize:barwidth*.8,
				color:'black'
			})
		})

	// barplot design

	let x=yaxis_width+space
	const sf=barheight/yscale_max

	for(let i=0; i<items_len; i++) {
		const j=arg.items[i]

		// X axis
		svg.append('text')
		.text(j['label'])
		.attr("transform", "translate("+ (x+barwidth/2) +","+ (axisheight+4) +") rotate(-65)")
		.attr('text-anchor','end')
		.attr('font-size',label_fontsize)
		.attr('font-family',client.font)
		.attr('dominant-baseline','central')
		

		// bars for barplot
		svg.append('rect')
		.attr('x',x)
		.attr('y',axisheight - (sf * j['value']))
		.attr('width',barwidth)
		.attr('height',sf * j['value'])
		.attr('fill','#901739')
		x+=barwidth+barspace
	}

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
	let min = arg.items[0]['value'],
		max = min
	for( let i of arg.items ) {
		min = Math.min( min, i['value'] )
		max = Math.max( max, i['value'] )
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
			.text( i['label'] )
			.attr('font-family', client.font)
			.attr('font-size', fontsize)
			.each( function() {
				textwidth = Math.max( textwidth, this.getBBox().width )
			})
			.remove()
	}

	return textwidth
}
