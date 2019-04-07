import * as client from './client'
import * as common from './common'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {scaleLinear,scaleOrdinal,schemeCategory10,scaleLog,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {init} from './mds.termdb'
import {may_makebutton_crosstabulate} from './mds.termdb.crosstab'
import { platform } from 'os';



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
	// console.log(arg)
	// initiating the plot object
	// it will be updated later by axis toggle or cross tabulate
	const plot = {
		genome: arg.genome,
		dslabel: arg.dslabel,
		tip: new client.Menu({padding:'18px'}),
		term: arg.term,
		items: arg.items,
		boxplot: arg.boxplot,
		barheight:300, // total height of bar and y axis
		barwidth:20,
		toppad:20, // top padding
		axisheight: 305,
		barspace:2,
		maxlabelwidth:0,
		maxvalue:0,
		label_fontsize: 15,
		yaxis_width: 100,
		use_logscale:0,
		use_percentage: 0,
		default2showtable: 0,
		term2_boxplot: 0
	}

	// a row of buttons

	plot.button_row = arg.holder.append('div')
		.style('margin','10px 0px')

	////////////// Y Axis options

	// button - Y axis scale selection 
	plot.button_row.append('span')
		.text('Y Axis')
		.style('display','inline-block')
		.style('padding-right','3px')

	plot.yaxis_options = plot.button_row.append('select')
		.style('display','inline-block')

	plot.yaxis_options.append('option')
		.attr('value','linear')
		.text('Linear')

	plot.yaxis_option_log = plot.yaxis_options.append('option')
		.attr('value','log')
		.text('Log10')

	plot.yaxis_option_percentage = plot.yaxis_options
		.append('option')
		.attr('value','percentage')
		.text('Percentage')
		.attr('disabled',1)

	////////////// Custom Bin button	
	if( plot.term.isfloat ) {
		// bin customization button
		plot.custom_bin_button = plot.button_row
			.append('div')
			.text('Customize Bins')
			.attr('class','sja_menuoption')
			.style('display','inline-block')
			.style('margin-left','30px')
			.style('padding','3px 5px')
			.on('click',()=>{
				custom_bin(plot)
			})
	}


	////////////// term2 buttons

	plot.term2_border_div = plot.button_row
		.append('div')
		.style('display','inline-block')
		.style('padding','10px')
		.style('margin-left','10px')
		.style('border','solid 1px transparent')


	// button - cross tabulate
	plot.crosstab_button = may_makebutton_crosstabulate({
		term1: arg.term,
		button_row: plot.term2_border_div,
		obj: obj,
		callback: result=>{
			// either adding term2 for the first time or replacing term2
			plot.term2 = result.term2
			update_term2_header( plot )

			// update the plot data using the server-returned new data
			plot.items = result.items
			if (plot.term2.isfloat && plot.term2_boxplot){ 
				plot.term2_displaymode_options.node().value = 'boxplot'
				update_plot(plot)
			}else{
				plot.term2_boxplot = 0
				do_plot( plot )
			}

			//for crosstab button update table
			if(plot.default2showtable){
				make_table(plot)
			}
		}
	})

	plot.crosstab_button
		.style('font-size','1em')
		.text('Select Second Term')

	// term2 handle holder
	plot.term2_handle_div = plot.term2_border_div
		.append('div')
		.style('display','inline-block')
		.style('margin-left','10px')

	// term2 display mode select holder
	plot.term2_displaymode_div = plot.term2_border_div
		.append('div')
		.style('display','inline-block')
		.style('margin-left','10px')



	// other holders/components

	plot.svg = arg.holder.append('svg')
	plot.table_div = arg.holder.append('div')
	plot.yaxis_g = plot.svg.append('g') // for y axis
	plot.graph_g = plot.svg.append('g') // for bar and label of each data item
	if (arg.boxplot){
		plot.boxplot_div  = arg.holder.append('div') // for boxplot stats table
			.style('margin','10px 0px')
		//plot.boxplot_g = plot.svg.append('g')
	}

	plot.legend_div = arg.holder.append('div')
		.style('margin','10px 0px')

	//Exposed - not exponsed data
	plot.unannotated = (arg.unannotated) ? arg.unannotated : ''

	plot.term2 = arg.term2
	if(arg.default2showtable){
		if( !plot.term2 ) throw 'term2 is required for default2showtable'
		plot.default2showtable = 1
		update_term2_header(plot)
	}

	do_plot( plot )

}


function update_term2_header ( plot ) {
/* update term2 header for events like select / remove / change term2
	Update plot object based on term2 events
*/	
	// console.log(plot)
	// clear handle holder
	plot.term2_handle_div.selectAll('*').remove()
	plot.term2_displaymode_div.selectAll('*').remove()
	plot.table_div.selectAll('*').remove()
	plot.table_div.style('display','none')
	plot.svg.style('display','block')
	plot.legend_div.style('display','block')

	if( plot.term2 ) {
		// has term2 so enable this option
		plot.yaxis_option_percentage.attr('disabled',null)
	}

	// Change corsstab button text to 'select 2nd term'
	plot.crosstab_button
	.text('Select Second Term')

	//show term2 if selected
	if(plot.term2){

		//change crosstab button text to "Change Second term"
		plot.crosstab_button
		.text('Change Second Term')
		.style('margin-left','5px')
		
		// display border for the div 
		plot.term2_border_div
		.style('border-color','#d4d4d4')

		// display term2 
		plot.term2_handle_div.append('div')
		.attr('class','sja_menuoption')
		.style('display','inline-block')
		.style('padding','3px 5px')
		.style('background-color', '#cfe2f3ff')
		.text(plot.term2.name)
		
		// button with 'X' to remove term2
		plot.term2_handle_div.append('div')
		.attr('class','sja_menuoption')
		.style('display','inline-block')
		.style('margin-left','1px')
		.style('padding','3px 5px')
		.style('background-color', '#cfe2f3ff')
		.text('X')
		.on('click',()=>{

			delete plot.term2
			plot.yaxis_option_percentage.attr('disabled',1)
			plot.yaxis_option_log.attr('disabled',null)
			plot.use_percentage = 0
			plot.yaxis_options.node().value = 'linear'
			plot.term2_handle_div.selectAll('*').remove()
			plot.term2_displaymode_div.selectAll('*').remove()
			plot.term2_border_div.style('border-color','transparent')
			plot.legend_div.selectAll('*').remove()
			plot.crosstab_button.text('Select Second Term')
			plot.table_div.selectAll('*').remove()
			plot.svg.style('display','block')
			plot.legend_div.style('display','block')
			if (plot.boxplot_div){
				plot.boxplot_div.style('display','block')
			}
			plot.term2_boxplot = 0
			
			update_plot(plot)
		})

		// display options for crosstab data
		plot.term2_displaymode_options = plot.term2_displaymode_div.append('select')
		.style('display','inline-block')

		plot.term2_displaymode_options.append('option')
		.attr('value','stacked')
		.text('Stacked Barchart')

		plot.term2_displaymode_options.append('option')
		.attr('value','table')
		.text('Table View')

		// create boxplot option for numerical term (isfloat: true)
		if(plot.term2.isfloat){
			plot.term2_displaymode_options.append('option')
			.attr('value','boxplot')
			.text('Boxplot')
		}

		//for croasstab button show table by default
		if(plot.default2showtable){
			plot.term2_displaymode_options.node().value = 'table'
			plot.table_div.style('display','block')
			make_table(plot)
		}

		/*
		every time the 'table' option is selected, render the table
			table is made based on current plot.items[]
			which may have been updated by either term1/2 binning change
		every time the 'boxplot' option is selected, query server for boxplot data and render boxplot
			query server using current term1 bins, which may have been changed

		rerendering every time may be wasteful but guard against binning update
		*/
		plot.term2_displaymode_options
		.on('change',()=>{
			if ( plot.term2_displaymode_options.node().value == 'table'){
				plot.term2_boxplot = 0
				plot.table_div.style('display','block')
				update_plot(plot)
			}else if(plot.term2_displaymode_options.node().value == 'stacked'){
				plot.term2_boxplot = 0
				plot.yaxis_option_percentage.attr('disabled',null)
				plot.yaxis_option_log.attr('disabled',null)
				plot.table_div.style('display','none')
				plot.svg.style('display','block')
				plot.legend_div.style('display','block')
				if(plot.boxplot_div){
					plot.boxplot_div.style('display','block')
				}
				update_plot(plot)
			}
			// if 'boxplot' selected - query server for data
			else if(plot.term2_displaymode_options.node().value == 'boxplot'){
				plot.term2_boxplot = 1
				plot.table_div.style('display','none')
				plot.svg.style('display','block')
				plot.legend_div.style('display','none')
				plot.yaxis_option_percentage.attr('disabled',1)
				update_plot(plot)
			}
		})
	}
}


function do_plot ( plot ) {
/*
make the bar plot based on configs in the plot object
called by showing the single-term plot at the beginning
or stacked bar plot for cross-tabulating

plot()
*/
	console.log(plot)
	// set y axis min/max scale
	const [yscale_min, yscale_max] = set_yscale( plot )

	// define Y axis - linear and log

	if( plot.use_logscale ) {
		plot.y_scale = scaleLog().domain([yscale_max,1]).range([0,plot.barheight])
		if(plot.term2_boxplot){
			plot.y_scale = scaleLog().domain([plot.yscale_max,1]).range([0,plot.barheight])
		}
	} else if(plot.use_percentage){
		plot.y_scale = scaleLinear().domain([100,0]).range([0,plot.barheight])
	}else if(plot.term2_boxplot){
		plot.y_scale = scaleLinear().domain([plot.yscale_max,0]).range([0,plot.barheight])
	}
	else {
		plot.y_scale = scaleLinear().domain([yscale_max,0]).range([0,plot.barheight])
	}

	// derive label font size

	const max_label_height = get_max_labelheight( plot )

	// space for boxplot
	// let box_plot_space = (plot.boxplot) ?  30 : 4
	let box_plot_space = 4


	/* plot vertical bars
	each bar has equal width
	set bar width based on number of data points to make it comfortable
	plot item labels under bar, with 45. rotation
	*/
	
	// define svg height and width
	const svg_width = plot.items.length * (plot.barwidth+plot.barspace) + plot.yaxis_width
	const svg_height = plot.toppad + plot.barheight+max_label_height + box_plot_space

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
			.attr("transform", "translate(0,"+ box_plot_space +") rotate(-65)")
			.attr('text-anchor','end')
			.attr('font-size',plot.label_fontsize)
			.attr('font-family',client.font)
			.attr('dominant-baseline','central')

		let x_lab_tip = ''

		if( item.lst ) {

			// a stacked bar
			let previous_value = (plot.use_logscale) ?  1 : 0

			for (const sub_item of item.lst){

				// if y-scale percentage selected, calculate fraction for each sub_item
				const sub_item_value = (plot.use_percentage) ? (sub_item.value*100/item.value) : sub_item.value 
				let previous_y = plot.y_scale( previous_value ) - plot.barheight
				previous_value += sub_item_value
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
		} else if(item.boxplot){
			//this is for boxplot for 2nd numerical term 
			g.append("line")
				.attr("x1", 0)
				.attr("y1", plot.y_scale(item.boxplot.w1)-plot.barheight)
				.attr("x2", 0)
				.attr("y2", plot.y_scale(item.boxplot.w2)-plot.barheight)
				.attr("stroke-width", 2)
				.attr("stroke", "black")

			if(plot.use_logscale){
				g.append("rect")
				.attr('x', -plot.barwidth/2)
				.attr('y', plot.y_scale(item.boxplot.p75)-plot.barheight)
				.attr('width', plot.barwidth)
				.attr('height', plot.barheight - plot.y_scale(item.boxplot.p75 / item.boxplot.p25))
				.attr('fill','#901739')
			}else{
				g.append("rect")
				.attr('x', -plot.barwidth/2)
				.attr('y', plot.y_scale(item.boxplot.p75)-plot.barheight)
				.attr('width', plot.barwidth)
				.attr('height', plot.barheight - plot.y_scale(item.boxplot.p75-item.boxplot.p25))
				.attr('fill','#901739')
			}

			g.append("line")
				.attr("x1", -plot.barwidth/2.2)
				.attr("y1", plot.y_scale(item.boxplot.w1)-plot.barheight)
				.attr("x2", plot.barwidth/2.2)
				.attr("y2",plot.y_scale(item.boxplot.w1)-plot.barheight)
				.attr("stroke-width", 2)
				.attr("stroke", "black")
	
			g.append("line")
				.attr("x1", -plot.barwidth/2.2)
				.attr("y1", plot.y_scale(item.boxplot.p50)-plot.barheight)
				.attr("x2", plot.barwidth/2.2)
				.attr("y2",plot.y_scale(item.boxplot.p50)-plot.barheight)
				.attr("stroke-width", 1.5)
				.attr("stroke", "white")
			
			g.append("line")
				.attr("x1", -plot.barwidth/2.2)
				.attr("y1", plot.y_scale(item.boxplot.w2)-plot.barheight)
				.attr("x2", plot.barwidth/2.2)
				.attr("y2",plot.y_scale(item.boxplot.w2)-plot.barheight)
				.attr("stroke-width", 2)
				.attr("stroke", "black")

			for(const outlier of item.boxplot.out){
				g.append("circle")
					.attr('cx', 0)
					.attr('cy', plot.y_scale(outlier.value)-plot.barheight)
					.attr('r', 2)
					.attr('fill','#901739')
			}	
		}else{
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
	plot.yaxis_options.on('change',()=>{
		if ( plot.yaxis_options.node().value == 'log'){
			plot.use_logscale = 1
			plot.use_percentage = 0
		}
		else if(plot.yaxis_options.node().value == 'percentage'){ 
			plot.use_percentage = 1
			plot.use_logscale = 0
		}
		else{
			plot.use_logscale = 0
			plot.use_percentage = 0
		}
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

	// for continous catagory, will create stat table and boxplot
	if (plot.boxplot){

		// table for statistical summary
		plot.boxplot_div
		.attr('transform','translate('+x+','+(plot.toppad + plot.barheight + max_label_height)+')')
		.selectAll('*')
		.remove()

		let exposed_data = ''

		if(plot.unannotated){
			exposed_data = '<tr><td colspan="2">Among All Patients</td></tr>'
			+ '<tr><td>'+ plot.unannotated.label_annotated +'</td><td>'+ plot.unannotated.value_annotated +'</td></tr>'
			+ '<tr><td>'+ plot.unannotated.label +'</td><td>'+ plot.unannotated.value +'</td></tr>'
			+ '<tr><td colspan="2">Among Patients treated</td></tr>'
		}

		const boxplot_table = plot.boxplot_div
			.html(
				'<table><tr><th></th><th>Value</th></tr>'
				+ exposed_data
				+ '<tr><td>Mean (SD)</td><td>'+ plot.boxplot.mean.toFixed(2) + ' (' + plot.boxplot.sd.toFixed(2) +') </td></tr>'
				+ '<tr><td>Median (IQR)</td><td>'+ plot.boxplot.p50.toFixed(2) + ' (' + plot.boxplot.iqr.toFixed(2) +') </td></tr>'
				+ '<tr><td>5th Percentile</td><td>'+ plot.boxplot.p05.toFixed(2) +'</td></tr>'
				+ '<tr><td>25th Percentile</td><td>'+ plot.boxplot.p25.toFixed(2) +'</td></tr>'
				+ '<tr><td>75th Percentile</td><td>'+ plot.boxplot.p75.toFixed(2) +'</td></tr>'
				+ '<tr><td>95th Percentile</td><td>'+ plot.boxplot.p95.toFixed(2) +'</td></tr>'
				+ '</table>'
			)

		boxplot_table.selectAll('td, th, table')
			.style('border', '1px solid black')
			.style('padding', '0')
			.style('border-collapse', 'collapse')

		boxplot_table.selectAll('th, td')
			.style('padding', '2px 10px')

		// Boxplot
		/*
		plot.boxplot_g
			.attr('transform','translate(' + (plot.yaxis_width + plot.barspace) + ',' + (plot.toppad + plot.barheight)+')')
			.selectAll('*')
			.remove()

		plot.boxplot_g.append("line")
			.attr("x1", plot.boxplot.w1)
			.attr("y1", 15)
			.attr("x2", (((plot.barwidth + plot.barspace) * plot.boxplot.w2)))
			.attr("y2",15)
			.attr("stroke-width", 2)
			.attr("stroke", "black")

		plot.boxplot_g.append("rect")
			.attr('x', (plot.boxplot.p25 * (plot.barwidth + plot.barspace)))
			.attr('y', 5)
			.attr('width', (plot.boxplot.p75-plot.boxplot.p25) * (plot.barwidth + plot.barspace))
			.attr('height', 20)
			.attr('fill','#901739')
		
		plot.boxplot_g.append("line")
			.attr("x1", plot.boxplot.w1 * (plot.barwidth + plot.barspace))
			.attr("y1", 5)
			.attr("x2", plot.boxplot.w1 * (plot.barwidth + plot.barspace))
			.attr("y2",25)
			.attr("stroke-width", 2)
			.attr("stroke", "black")

		plot.boxplot_g.append("line")
			.attr("x1", plot.boxplot.p50 * (plot.barwidth + plot.barspace))
			.attr("y1", 5)
			.attr("x2", plot.boxplot.p50 * (plot.barwidth + plot.barspace))
			.attr("y2",25)
			.attr("stroke-width", 2)
			.attr("stroke", "white")
		
		plot.boxplot_g.append("line")
			.attr("x1", plot.boxplot.w2 * (plot.barwidth + plot.barspace))
			.attr("y1", 5)
			.attr("x2", plot.boxplot.w2 * (plot.barwidth + plot.barspace))
			.attr("y2",25)
			.attr("stroke-width", 2)
			.attr("stroke", "black")

		for(const outlier of plot.boxplot.out){
			plot.boxplot_g.append("circle")
			.attr('cx', (outlier.value * (plot.barwidth + plot.barspace)))
			.attr('cy', 15)
			.attr('r', 4)
			.attr('fill','#901739')
		}	
		*/
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


function update_plot (plot) {
	
	const arg = {
		genome: plot.genome,
		dslabel: plot.dslabel
	}

	if(plot.term2){
		arg.crosstab2term = 1
		arg.term1 = { id : plot.term.id }
		arg.term2 = { id : plot.term2.id}
		if(plot.term2_boxplot){
			arg.boxplot = 1
		}
	}else{
		arg.barchart = { id : plot.term.id }
	}

	client.dofetch( 'termdb', arg )
	.then(data=>{
		if(data.error) throw data.error
		if(!data.lst) throw 'no data for barchart'

		plot.items =  data.lst
		if (data.binmax){ 
			plot.yscale_max = data.binmax
			plot.legend_div.style('display','none')
		}

		if(plot.term2_displaymode_options.node().value != 'table'){
			do_plot( plot )
		}else{
			make_table(plot)
		}
	})
}


function make_table (plot) {
	// hide svg
	plot.svg.style('display','none')
	plot.legend_div.style('display','none')
	if(plot.boxplot_div){
		plot.boxplot_div.style('display','none')
	}

	plot.table_div.selectAll('*').remove()

	let column_keys = []
	if( plot.term2.graph.barchart.order ) {

		column_keys = plot.term2.graph.barchart.order

	} else {

		// no predefined order, get unique values from data
		const term2values = new Set()
		for(const t1v of plot.items) {
			for(const j of t1v.lst) {
				term2values.add( j.label )
			}
		}
		for(const s of term2values) {
			column_keys.push( s )
		}
	}

	// show table
	const table = plot.table_div.append('table')
	.style('margin-top','20px')
	.style('border-spacing','3px')
	.style('border-collapse','collapse')
	.style('border', '1px solid black')

	// header
	const tr = table.append('tr')
	tr.append('td') // column 1
	// print term2 values as rest of columns
	for(const i of column_keys) {
		tr.append('th')
			.text( i )
			.style('border', '1px solid black')
	}

	// rows are term1 values
	let rows = []
	// order of rows maybe predefined
	if( plot.term.graph && plot.term.graph.barchart && plot.term.graph.barchart.order ) {
		for(const v of plot.term.graph.barchart.order ) {
			const i = plot.items.find( i=> i.label == v )
			if( i ) {
				rows.push( i )
			}
		}
	} else {
		rows = plot.items
	}
	
	for(const t1v of rows) {
		const tr = table.append('tr')

		// column 1
		tr.append('th')
			.text( t1v.label )
			.style('border', '1px solid black')

		// other columns
		for(const t2label of column_keys) {
			const td = tr.append('td')
				.style('border', '1px solid black')
			const v = t1v.lst.find( i=> i.label == t2label )
			if( v ) {
				td.text( v.value )
			}
		}
	}
}

function custom_bin(plot){
	plot.tip.clear()
			.showunder( plot.custom_bin_button.node() )

	const custom_bin_div = plot.tip.d.append('div')
		.style('margin','10px 0px')
		.style('align-items','flex-start')
		.style('display','flex')

	// Bin Size
	const bin_size_div = custom_bin_div.append('div')
		.style('display','inline-block')
		.style('margin-left','10px')

	
	bin_size_div.append('div')
		.text('Bin Size')
		.style('padding-right','3px')
		.style('text-align','center')

	plot.custom_bin_size = bin_size_div.append('input')
		.style('margin-top','42px')
		.attr('size','8')
		.style('text-align','center')

	// First Bin
	const first_bin_div = custom_bin_div.append('div')
		.style('display','inline-block')
		.style('margin-left','25px')

	first_bin_div.append('div')
		.text('First Bin')
		.style('padding-right','3px')
		.style('text-align','center')

	plot.first_bin_options = first_bin_div.append('select')
		.style('margin-top','10px')

	plot.first_bin_options.append('option')
		.attr('value','auto')
		.text('Automatic')

	plot.first_bin_options.append('option')
		.attr('value','value')
		.text('Value')

	plot.first_bin_options.append('option')
		.attr('value','percentile')
		.text('Percentile')

	let first_bin_input_div = first_bin_div.append('div')
		.style('margin-top','10px')
		.style('display','block')
	
	first_bin_input_div.append('span')
		.style('display','inline-block')
		.text('<=')

	plot.first_bin_size = first_bin_input_div.append('input')
		.style('display','inline-block')
		.style('margin-left','5px')
		.attr('size','8')

	// Last Bin
	const last_bin_div = custom_bin_div.append('div')
		.style('display','inline-block')
		.style('margin-left','25px')
		.style('margin-right','10px')

	last_bin_div.append('div')
		.text('Last Bin')
		.style('padding-right','3px')
		.style('text-align','center')

	plot.last_bin_options = last_bin_div.append('select')
		.style('margin-top','10px')

	plot.last_bin_options.append('option')
		.attr('value','auto')
		.text('Automatic')

	plot.last_bin_options.append('option')
		.attr('value','value')
		.text('Value')

	plot.last_bin_options.append('option')
		.attr('value','percentile')
		.text('Percentile')

	let last_bin_input_div = last_bin_div.append('div')
		.style('margin-top','10px')
		.style('display','block')
	
	last_bin_input_div.append('span')
		.style('display','inline-block')
		.text('>=')

	plot.last_bin_size = last_bin_input_div.append('input')
		.style('display','inline-block')
		.style('margin-left','5px')
		.attr('size','8')
}
