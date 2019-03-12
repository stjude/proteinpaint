import * as client from './client'
import * as common from './common'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {scaleLinear,scaleOrdinal,schemeCategory10,scaleLog,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import { stringify } from 'querystring'; // what's this?
import {init} from './mds.termdb'



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
.obj
.term{}
	.id
	.graph.barchart{}
		provides predefined chart customization, to be implemented:
		- fixed y scale
		- log scale

*/


	// initiating the plot object
	// it will be updated later by axis toggle or cross tabulate
	const plot = {
		term: arg.term,
		items: arg.items,
		barheight:300,
		barwidth:20,
		space:5,
		axisheight: 305,
		barspace:2,
		maxlabelwidth:0,
		maxvalue:0,
		label_fontsize: 15,
		yaxis_width: 70,
		label2bar: new Map(),
		// k: label of this term
		// v: <g>
	}

	const term_name = arg.term.name
	const items_len = arg.items.length

	// initiate holders

	const button_row = arg.holder.append('div')
		.style('margin','10px 0px')

	plot.legend_div = arg.holder.append('div')
		.style('margin','10px 0px')

	plot.svg = arg.holder.append('svg')



	// button - scale toggle
	
	button_row.append('span')
		.text('Y Axis - Log Scale')
	
	const scale_btn = button_row.append('input')
		.attr('type', 'checkbox')
		/*
		.on('change',()=>{
			update_axis( plot )
		})
		*/

	// button - cross tabulate
	addbutton_crosstabulate({
		term: arg.term,
		button_row: button_row,
		obj: obj,
		plot: plot
	})

	// set y axis min/max scale
	const [yscale_min, yscale_max] = set_yscale( plot )

	// define Y axis - linear and log

	plot.y_scale
	if( plot.use_logscale ) {
		plot.y_scale = scaleLog().domain([yscale_max,1]).range([0,plot.barheight])
	} else {
		plot.y_scale = scaleLinear().domain([yscale_max,0]).range([0,plot.barheight])
	}

	// initiate the plot components

	plot.axisg = plot.svg.append('g')
	for(const j of arg.items) {
		plot.label2bar.set( j.label, plot.svg.append('g') )
	}

	do_plot( plot )
}



function do_plot ( plot ) {
/*
make the bar plot based on configs in the plot object
called by showing the single-term plot at the beginning
or stacked bar plot for cross-tabulating

plot()
*/

	// also derive label font size

	const max_label_height = get_max_labelheight( plot )


	/* plot vertical bars
	each bar has equal width
	set bar width based on number of data points to make it comfortable
	plot item labels under bar, with 45. rotation
	*/
	
	// define svg height and width
	const svg_width = plot.items.length * (plot.barwidth+plot.barspace)+(plot.space*2)+plot.yaxis_width
	const svg_height = plot.axisheight+max_label_height+plot.space

	plot.svg
		.attr('width', svg_width)
		.attr('height', svg_height)

	// Y axis
	if( plot.items[0].lst ) {
		// this is a stacked bar
	} else {
	plot.axisg
		.attr('transform','translate('+plot.yaxis_width+','+plot.space+')')
		.call(
			axisLeft()
				.scale(plot.y_scale)
				.tickFormat(d3format('d'))
		)
	client.axisstyle({
		axis:plot.axisg,
		showline:true,
		fontsize:plot.barwidth*.8,
		color:'black'
	})
	}

	// if is stacked-bar, need to get color mapping for term2 values
	let term2valuecolor
	if( plot.items[0].lst ) {
		// to get all values for term2
		const term2values = new Set()
		for(const i of plot.items) {
			for(const j of i.lst) {
				term2values.add( j.label )
			}
		}
		if( term2values.size > 10 ) {
			term2valuecolor = scaleOrdinal( schemeCategory20 )
		} else {
			term2valuecolor = scaleOrdinal( schemeCategory10 )
		}
	}

	console.log(plot.items)
	// plot each bar

	let x = plot.yaxis_width+ plot.space

	for(const item of plot.items) {
		
		// bars for barplot
		const g = plot.label2bar.get( item.label )
		if(!g) {
			console.log('barplot unknown label: '+item.label)
			continue
		}

		g.attr('transform','translate('+(x+plot.barwidth/2)+','+plot.axisheight+')')

		// clear existing bars and axis
		g.selectAll('*').remove()

		if( item.lst ) {

			// X axis
			g.append('text')
			.text(item.label)
			.attr("transform", "translate(0,4) rotate(-65)")
			.attr('text-anchor','end')
			.attr('font-size',plot.label_fontsize)
			.attr('font-family',client.font)
			.attr('dominant-baseline','central')

			// this is a stacked bar
			for (const sub_item of item.lst){

				// rect for bars

				// console.log(sub_item.label, sub_item.value)
				const index = item.lst.findIndex(x => x.value==sub_item.value)
				g.append('rect')
				.attr('x', -plot.barwidth/2)
				.attr('y', plot.y_scale(sub_item.value)-plot.barheight-plot.space)
				.attr('width',plot.barwidth)
				.attr('height', plot.axisheight - plot.y_scale(sub_item.value))
				.attr('fill',term2valuecolor(index))
			}
		} else {
			// this is a single bar plot
			// X axis
			g.append('text')
				.text(item.label)
				.attr("transform", "translate(0,4) rotate(-65)")
				// .attr("transform", "translate("+ (x+plot.barwidth/2) +","+ (plot.axisheight+4) +") rotate(-65)")
				.attr('text-anchor','end')
				.attr('font-size',plot.label_fontsize)
				.attr('font-family',client.font)
				.attr('dominant-baseline','central')

			// rect for bars	
			g.append('rect')
				.attr('x', -plot.barwidth/2)
				.attr('y', plot.y_scale(item.value)-plot.barheight-plot.space)
				.attr('width',plot.barwidth)
				.attr('height', plot.axisheight - plot.y_scale(item.value))
				.attr('fill','#901739')
		}

		x+=plot.barwidth+plot.barspace
	}
}


function update_axis ( plot ) {
	// TODO

	const bar_labels = [...label2bar.keys()]
	const rects = [...label2bar.values()]
	// console.log(rects)
	// Y axis scale toggle 

	scale_btn.on('click',()=>{ 
		if (scale_btn.property('checked') == false){
			axisg.attr('transform','translate('+yaxis_width+','+space+')')
			.call(axisLeft().scale(y_linear_scale)
				.tickFormat(d3format('d'))
			)
			for(let i=0; i<items_len; i++) {
				const j=arg.items[i]
				d3select(label2bar.get(bar_labels[i])._groups[0][0]).selectAll('rect')
				.attr('y',y_linear_scale(j['value'])-barheight-space)
				.attr('height',axisheight - y_linear_scale(j['value']))
			}
		} else {
			axisg.attr('transform','translate('+yaxis_width+','+space+')')
			.call(axisLeft().scale(y_log_scale)
				.ticks(10, d3format('d'))
			)
			for(let i=0; i<items_len; i++) {
				const j=arg.items[i]
				const value = (j.value !=0 ) ? j.value : 1
				d3select(label2bar.get(bar_labels[i])._groups[0][0]).selectAll('rect')
					.attr('y',y_log_scale(value)-barheight-space)
					.attr('height',axisheight - y_log_scale(value))
			}
		}
		client.axisstyle({
			axis:axisg,
			showline:true,
			fontsize:barwidth*.8,
			color:'black'
		})
	})
}



function set_yscale ( plot ) {
/* determine y axis range
*/
	/* TODO if term predefines y scale, return it
	if( plot.term.graph.barchart.fixedyscale) {
		return plot.term.graph.barchart.fixedyscale
	}
	*/


	// get min/max from bar numeric values
	let min = plot.items[0].value,
		max = min
	for( let i of plot.items ) {
		min = Math.min( min, i.value )
		max = Math.max( max, i.value )
	}


	// if min >0, then set min to 0
	if( min >= 0 ) return [ 0, max ]

	// if max < 0, then set max to 0
	if( max <= 0 ) return [ min, 0 ]

	// remaining case should be min<0, max>0
	return [ min, max ]
}



function get_max_labelheight ( plot ) {

	let textwidth = 0

	for(const i of plot.items) {
		plot.svg.append('text')
			.text( i.label )
			.attr('font-family', client.font)
			.attr('font-size', plot.label_fontsize)
			.each( function() {
				textwidth = Math.max( textwidth, this.getBBox().width )
			})
			.remove()
	}

	return textwidth
}



function addbutton_crosstabulate ( arg ) {
/*
add button for cross-tabulating
currently defaults this to barchart-equipped terms
later may define a specific rule for enabling cross-tabulating

.term
.button_row
.obj
.plot{}

*/

	const term1 = arg.term

	if(!term1.graph || !term1.graph.barchart ) return

	const button = arg.button_row.append('div')
		.style('display','inline-block')
		.style('margin-left','20px')
		.attr('class','sja_menuoption')
		.text('CROSSTAB')

	// click button to show term tree
	// generate a temp obj for running init()

	button.on('click',()=>{

		arg.obj.tip.clear()
			.showunder( button.node() )

		const treediv = arg.obj.tip.d.append('div')
		const errdiv = arg.obj.tip.d.append('div')

		const obj2 = {
			genome: arg.obj.genome,
			mds: arg.obj.mds,
			div: treediv,
			default_rootterm: {
				// add click handler as the modifier to tree display
				modifier_click_term: (term2) => {
					// term2 is selected
					if(term2.id == term1.id) {
						window.alert('Cannot select the same term')
						return
					}
					arg.obj.tip.hide()

					crosstabulate_2terms( {
						term1: {
							id: term1.id
						},
						term2: {
							id: term2.id
						},
						obj: arg.obj
					})
					.then( data=>{

						// update the plot data using the server-returned new data
						arg.plot.items = data.lst

						do_plot( arg.plot )
					})
					.catch(e=>{
						window.alert( e.message || e)
						if(e.stack) console.log(e.stack)
					})
				}
			},
		}

		init( obj2 )
	})
}






function crosstabulate_2terms ( arg ) {
/*
.term1{}
.term2{}
.obj{}

for numeric term:
	if is based on custom binning, must return the binning scheme

return promise
*/
	const param = {
		crosstab2term: 1,
		term1:{
			id: arg.term1.id
		},
		term2:{
			id: arg.term2.id
		},
		genome: arg.obj.genome.name,
		dslabel: arg.obj.mds.label
	}
	return client.dofetch('termdb', param)
	.then(data=>{
		if(data.error) throw 'error cross-tabulating: '+data.error
		return data
	})
}

