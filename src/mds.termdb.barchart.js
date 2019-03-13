import * as client from './client'
import * as common from './common'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {scaleLinear,scaleOrdinal,schemeCategory10,scaleLog,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {init} from './mds.termdb'



/*
	Purpose: make bachart for data from a term, select 2nd term to create stacked barchart
	Workflow: 
	1.	When BARCHART button clicked, div for button was created with CROSSTAB (with addbutton_crosstabulate()) and Y Axis checkbox. 
		and svg element appended to 'div .sja_pane' ('arg' holder). 
	2. 	Plot object was created which has been used by do_plot(), set_yscale() and get_max_labelheight().
		plot = {
			tip: new client.Menu({padding:'18px'}), //tip from clinent.Menu for tooltip while hoverover bar or x-axis label
			term: arg.term,   // 1st term 
			items: arg.items, // with all items in the term with item.label and item.value
			barheight:300,    // total height of bar and y axis
			barwidth:20, 
			toppad:20,        // top padding
			axisheight: 305,  //yaxis height
			barspace:2,       //space between 2 bars
			maxlabelwidth:0,  //will be calculated by 
			maxvalue:0,
			label_fontsize: 15,
			yaxis_width: 70, 
			use_logscale:0   // flag for y-axis scale type, 0=linear, 1=log
			y_scale,         // depending upon scale_btn status, it changes between scaleLiner() and scaleLog()
			scale_btn,       // y-axis toggle checkbox for log-scale
			svg,
			yaxis_g,         // for y axis
			graph_g,         // for bar and label of each data item
			legend_div,      // div for legends
		}
	3. 	For single term, do_plot() creates barplot for all terms. 
		First Y-axis added then X-axis labels created. 
		Depending upon single or 2 terms data check, bars create for each item. 
		If scale_btn clicked, plot.y_scale changed to log scale and do_plot() called again with use_logscale:1.
	4. 	If CROSSTAB clicked and 2nd term selected, plot object updated with crosstabulate_2terms().   
		plot = {
			items: Array(items1_n)			// array with term1 total items
			0 :  
				label: item1_label
				value: item2_value
				lst: Array(item2_n)			// array with items1 divided into term2 catagories 
				0:
					label: item2_label
					value: item2_value 
				1:
					label: item2_label
					value: item2_value 
			term2: term2.name
		}
	5. 	do_plot() called again with updated plot object. Y-axis stays same, X-axis updated. 
		Bars recreted with individual rect added for each term2 as stacked bar for single item1.
	6.	Tooltip added to individual bar and X-axis label with patient #. 
		If 2nd term selected, tooltip added to each rect of term2 items and for X-axis labels, it will display total patient and individual patient # for term2 items. 
	7. 	Legend added to plot if 2nd term selected.  
*/



export function barchart_make ( arg ) {
/*

.items[]
	server returned data
	for single-term sample count:
	.label
	.value

	for cross-tabulate with 2nd term:
	.label
	.value
	.lst[ {} ]
		.label
		.value

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
		tip: new client.Menu({padding:'18px'}),
		term: arg.term,
		items: arg.items,
		barheight:300, // total height of bar and y axis
		barwidth:20,
		toppad:20, // top padding
		axisheight: 305,
		barspace:2,
		maxlabelwidth:0,
		maxvalue:0,
		label_fontsize: 15,
		yaxis_width: 70,
		use_logscale:0
	}

	// a row of buttons

	const button_row = arg.holder.append('div')
		.style('margin','10px 0px')

	// button - scale toggle
	button_row.append('span')
		.text('Y Axis - Log Scale')
	
	plot.scale_btn = button_row.append('input')
		.attr('type', 'checkbox')

	// button - cross tabulate
	addbutton_crosstabulate({
		term: arg.term,
		button_row: button_row,
		obj: obj,
		plot: plot
	})

	// other holders/components

	plot.svg = arg.holder.append('svg')
	plot.yaxis_g = plot.svg.append('g') // for y axis
	plot.graph_g = plot.svg.append('g') // for bar and label of each data item

	plot.legend_div = arg.holder.append('div')
		.style('margin','10px 0px')

	do_plot( plot )
}




function do_plot ( plot ) {
/*
make the bar plot based on configs in the plot object
called by showing the single-term plot at the beginning
or stacked bar plot for cross-tabulating

plot()
*/

	// set y axis min/max scale
	const [yscale_min, yscale_max] = set_yscale( plot )

	// define Y axis - linear and log

	if( plot.use_logscale ) {
		plot.y_scale = scaleLog().domain([yscale_max,1]).range([0,plot.barheight])
	} else {
		plot.y_scale = scaleLinear().domain([yscale_max,0]).range([0,plot.barheight])
	}

	// derive label font size

	const max_label_height = get_max_labelheight( plot )


	/* plot vertical bars
	each bar has equal width
	set bar width based on number of data points to make it comfortable
	plot item labels under bar, with 45. rotation
	*/
	
	// define svg height and width
	const svg_width = plot.items.length * (plot.barwidth+plot.barspace) + plot.yaxis_width
	const svg_height = plot.toppad + plot.barheight+max_label_height

	plot.svg
		.transition()
		.attr('width', svg_width)
		.attr('height', svg_height)

	// Y axis
	plot.yaxis_g
		.attr('transform','translate('+(plot.yaxis_width-2)+','+plot.toppad+')')
		.transition()
		.call(
			axisLeft()
				.scale(plot.y_scale)
				// .tickFormat(d3format('d'))
				.ticks(10, d3format('d'))
		)

	client.axisstyle({
		axis:plot.yaxis_g,
		showline:true,
		fontsize:plot.barwidth*.8,
		color:'black'
	})

	// if is stacked-bar, need to get color mapping for term2 values
	let term2valuecolor
	if( plot.items[0].lst ) {
		// may need a better way of deciding if it is two-term crosstabulate
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

	// plot each bar
	let x = plot.yaxis_width+ plot.barspace + plot.barwidth/2

	// in case of stacked bar, collect uniq set of term2 labels for showing in legend
	// this does not allow ordering the labels by certain way, may update later
	const term2_labels = new Set()

	plot.graph_g
		.attr('transform','translate('+x+','+(plot.toppad + plot.barheight)+')')
		.selectAll('*')
		.remove()


	for(const [ itemidx, item] of plot.items.entries()) {

		const g = plot.graph_g.append('g')
			.attr('transform','translate('+(itemidx*(plot.barwidth+plot.barspace))+',0)')

		// X axis labels	
		const xlabel = g.append('text')
			.text(item.label)
			.attr("transform", "translate(0,4) rotate(-65)")
			.attr('text-anchor','end')
			.attr('font-size',plot.label_fontsize)
			.attr('font-family',client.font)
			.attr('dominant-baseline','central')

		let x_lab_tip = ''

		if( item.lst ) {

			// a stacked bar
			let previous_value = (plot.use_logscale) ?  1 : 0

			for (const sub_item of item.lst){

				const previous_y = plot.y_scale( previous_value ) - plot.barheight
				previous_value += sub_item.value
				const this_y = plot.y_scale( previous_value ) - plot.barheight

				g.append('rect')
					.attr('x', -plot.barwidth/2)
					.attr('y', this_y )
					.attr('width',plot.barwidth)
					.attr('height', previous_y - this_y )
					.attr('fill',term2valuecolor( sub_item.label ))
					.on('mouseover',()=>{
						plot.tip.clear()
							.show(d3event.clientX,d3event.clientY)
							.d
							.append('div')
							.html(
								plot.term.name+': '+ item.label+'<br>'
								+plot.term2.name+': '+ sub_item.label+'<span style="height: 15px; width: 15px; position: absolute; margin:0 2px; background-color:'+ term2valuecolor( sub_item.label ) +';"></span><br>'
								+'# patients: '+sub_item.value
								)
					})
					.on('mouseout',()=>{
						plot.tip.hide()
					})

				term2_labels.add(sub_item.label)
				x_lab_tip += '<span style="height: 15px; width: 15px; position: absolute; margin:0 2px; background-color:'+ term2valuecolor( sub_item.label ) +';"></span><span style="margin-left:20px">'+sub_item.label+' ('+ sub_item.value+')</span><br>'
			}
		} else {
			// this is a single bar plot
			let value = (plot.use_logscale && item.value <= 1) ?  1.3 : item.value
			g.append('rect')
				.attr('x', -plot.barwidth/2)
				.attr('y', plot.y_scale(value)-plot.barheight)
				.attr('width',plot.barwidth)
				.attr('height', plot.barheight - plot.y_scale(value))
				.attr('fill','#901739')
				.on('mouseover',()=>{
					plot.tip.clear()
						.show(d3event.clientX,d3event.clientY)
						.d
						.append('div')
						.html(
							plot.term.name+': '+ item.label+'<br>'
							+'# patients: '+item.value
							)
				})
				.on('mouseout',()=>{
					plot.tip.hide()
				})
		}
		// x-label tooltip
		if( item.lst ){
			xlabel.on('mouseover',()=>{
				plot.tip.clear()
					.show(d3event.clientX,d3event.clientY)
					.d
					.append('div')
					.html(
						plot.term.name+': ' + item.label + '<br>'
						+ '# patients: '+ item.value + '<br>'
						+ x_lab_tip
						)
			})
			.on('mouseout',()=>{
				plot.tip.hide()
			})
		}else{	
			xlabel.on('mouseover',()=>{
				plot.tip.clear()
					.show(d3event.clientX,d3event.clientY)
					.d
					.append('div')
					.html(
						plot.term.name+': '+ item.label+'<br>'
						+'# patients: '+item.value
						)
			})
			.on('mouseout',()=>{
				plot.tip.hide()
			})
		}
	}

	// Y-axis toggle for log vs. linear
	plot.scale_btn.on('click',()=>{
		if ( plot.use_logscale){plot.use_logscale = 0}
		else { plot.use_logscale = 1 }
		do_plot(plot)
	})
	
	// legend for 2nd term selection
	if( plot.items[0].lst ) {

		plot.legend_div.selectAll('*').remove()

		// legend title - term2
		plot.legend_div.append('span')
			.text('Legend for ' + plot.term2.name)
			.attr('font-size',plot.label_fontsize )
				.attr('font-family',client.font)


		for (const i of term2_labels){

			// div for each label
			const lenged_span = plot
				.legend_div.append('div')
				.style('width', '100%')
				.style('margin', '2px')
			
			// square color for the label	
			lenged_span.append('div')
				.style('display','inline-block')
				.style('height', '15px')
				.style('width', '15px')
				.style('background-color',term2valuecolor( i ))
				.style('margin-right', '5px')

			//label text
			lenged_span.append('span')
				.text(i)
				.attr('font-size',plot.label_fontsize)
				.attr('font-family',client.font)
		}
	}
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
						arg.plot.term2 = term2

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
