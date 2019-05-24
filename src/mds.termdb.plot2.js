import * as client from './client'
import * as common from './common'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {scaleLinear,scaleOrdinal,schemeCategory10,scaleLog,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {init} from './mds.termdb'
import {may_make_barchart, custom_table_data} from './mds.termdb.barchart2'
import {may_makebutton_crosstabulate} from './mds.termdb.crosstab'
import {controls} from './mds.termdb.controls'
import { platform } from 'os';



/*
  Purpose: make bachart for data from a term, select 2nd term to create stacked barchart
  Workflow: 
  1.  When BARCHART button clicked, div for button was created with CROSSTAB (with addbutton_crosstabulate()) and Y Axis checkbox. 
    and svg element appended to 'div .sja_pane' ('arg' holder). 
  2.  Plot object was created which has been used by do_plot(), set_yscale() and get_max_labelheight().
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
      legend_div,      // div for legends,
    }
  3.  For single term, do_plot() creates barplot for all terms. 
    First Y-axis added then X-axis labels created. 
    Depending upon single or 2 terms data check, bars create for each item. 
    If scale_btn clicked, plot.y_scale changed to log scale and do_plot() called again with use_logscale:1.
  4.  If CROSSTAB clicked and 2nd term selected, plot object updated with crosstabulate_2terms().   
    plot = {
      items: Array(items1_n)      // array with term1 total items
      0 :  
        label: item1_label
        value: item2_value
        lst: Array(item2_n)     // array with items1 divided into term2 catagories 
        0:
          label: item2_label
          value: item2_value 
        1:
          label: item2_label
          value: item2_value 
      term2: term2.name
    }
  5.  do_plot() called again with updated plot object. Y-axis stays same, X-axis updated. 
    Bars recreted with individual rect added for each term2 as stacked bar for single item1.
  6.  Tooltip added to individual bar and X-axis label with patient #. 
    If 2nd term selected, tooltip added to each rect of term2 items and for X-axis labels, it will display total patient and individual patient # for term2 items. 
  7.  Legend added to plot if 2nd term selected.  
*/



export function render ( arg, obj ) {
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
    term2_displaymode: "stacked",
    term2_boxplot: 0,
    obj,
    custom_bins: {},
    bin_controls: {1:{}, 2:{}},
    bar_settings: {
      orientation: 'horizontal',
      unit: 'abs'
    }
  }

  // set configuration controls
  controls(arg, plot, do_plot, update_plot)

  // other holders/components
  plot.bar_div = arg.holder.append('div')
  plot.legend_div = arg.holder.append('div')
    .style('margin','10px 0px')
  plot.svg = arg.holder.append('svg')
  plot.table_div = arg.holder.append('div')
  plot.yaxis_g = plot.svg.append('g') // for y axis
  plot.graph_g = plot.svg.append('g') // for bar and label of each data item
  if (arg.boxplot){
    plot.boxplot_div  = arg.holder.append('div') // for boxplot stats table
      .style('margin','10px 0px')
    //plot.boxplot_g = plot.svg.append('g')
  }

  //Exposed - not exponsed data
  plot.unannotated = (arg.unannotated) ? arg.unannotated : ''

  plot.term2 = arg.term2
  if(arg.term2_displaymode == "table"){
    if( !plot.term2 ) throw 'term2 is required for table view'
    plot.term2_displaymode = "table"
    update_term2_header(plot)
  }
  else {
    do_plot( plot )
  }
}



function update_term2_header ( plot ) {
/* update term2 header for events like select / remove / change term2
  Update plot object based on term2 events
*/  
  // console.log(plot)
  // clear handle holder
  plot.table_div.selectAll('*').remove()
  plot.table_div.style('display','none')
  plot.svg.style('display','block')
  plot.legend_div.style('display','block')

  //for croasstab button show table by default
  if(plot.term2_displaymode == "table"){
    plot.bar_settings.overlay = "tree"
    may_make_table(plot)
  }
}


function do_plot ( plot ) {
/*
make a barchart, boxplot, or stat table based on configs 
in the plot object called by showing the single-term plot 
at the beginning or stacked bar plot for cross-tabulating
*/ 
  // console.log(plot)
  may_make_barchart(plot)
  may_make_boxplot(plot)
  may_make_stat(plot)
  may_make_table(plot)
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
    dslabel: plot.dslabel,
    obj: plot.obj
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
    do_plot( plot )
  })
}


function may_make_table (plot) {
  if (plot.term2_displaymode != 'table') {
    plot.table_div.style('display','none')
    return
  } 

  // hide svg
  plot.bar_div.style('display','none')
  plot.svg.style('display','none')
  plot.legend_div.style('display','none')
  plot.table_div.style('display','block')
  if(plot.boxplot_div){
    plot.boxplot_div.style('display','none')
  }

  plot.table_div.selectAll('*').remove()
  const table_data = plot.custom_bins["1"] || plot.custom_bins["2"]
    ? custom_table_data
    : default_table_data

  table_data(plot)
  .then(data => {
    const {column_keys, rows} = data
    
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
  })
}

function default_table_data(plot) {
  let column_keys = []
  if(plot.term2 && plot.term2.graph.barchart.order ) {
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

  return Promise.resolve({column_keys, rows})
}

function may_make_boxplot(plot) {
  if (plot.term2_displaymode != "boxplot") {
    plot.svg.style('display','none')
    return
  }
  plot.svg.style('display','block')
  if (plot.use_logscale) {
    plot.y_scale = scaleLog().domain([plot.yscale_max,1]).range([0,plot.barheight])
  } else if (plot.use_percentage) {
    plot.y_scale = scaleLinear().domain([100,0]).range([0,plot.barheight])
  } else {
    plot.y_scale = scaleLinear().domain([plot.yscale_max,0]).range([0,plot.barheight])
  }

  const max_label_height = get_max_labelheight( plot )

  // space for boxplot
  // let box_plot_space = (plot.boxplot) ?  30 : 4
  let box_plot_space = 4

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

    //this is for boxplot for 2nd numerical term 
    //if (isNaN(plot.y_scale(item.boxplot.w1))) console.log(item.boxplot)
    
    if ('w1' in item.boxplot) {
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
        .attr("y2", plot.y_scale(item.boxplot.w1)-plot.barheight)
        .attr("stroke-width", 2)
        .attr("stroke", "black")

      g.append("line")
        .attr("x1", -plot.barwidth/2.2)
        .attr("y1", plot.y_scale(item.boxplot.p50)-plot.barheight)
        .attr("x2", plot.barwidth/2.2)
        .attr("y2", plot.y_scale(item.boxplot.p50)-plot.barheight)
        .attr("stroke-width", 1.5)
        .attr("stroke", "white")
      
      g.append("line")
        .attr("x1", -plot.barwidth/2.2)
        .attr("y1", plot.y_scale(item.boxplot.w2)-plot.barheight)
        .attr("x2", plot.barwidth/2.2)
        .attr("y2", plot.y_scale(item.boxplot.w2)-plot.barheight)
        .attr("stroke-width", 2)
        .attr("stroke", "black")
    }

    for(const outlier of item.boxplot.out){
      g.append("circle")
        .attr('cx', 0)
        .attr('cy', plot.y_scale(outlier.value)-plot.barheight)
        .attr('r', 2)
        .attr('fill','#901739')
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
}

function may_make_stat(plot) {
  //plot.boxplot = plot.term2 && plot.term2.isfloat && plot.term2_boxplot ? 1 : 0
  if (!plot.boxplot) {
    if (plot.boxplot_div) {
      plot.boxplot_div.style("display", "none")
    }
    return
  }
  plot.boxplot_div.style("display", "block")
  const x = plot.yaxis_width+ plot.barspace + plot.barwidth/2
  const max_label_height = get_max_labelheight( plot )
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

  const boxplot_div = plot.boxplot_div
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

  boxplot_div.selectAll('td, th, table')
    .style('border', '1px solid black')
    .style('padding', '0')
    .style('border-collapse', 'collapse')

  boxplot_div.selectAll('th, td')
    .style('padding', '2px 10px')
}
