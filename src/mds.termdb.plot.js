import * as client from './client'
import * as common from './common'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {scaleLinear,scaleOrdinal,schemeCategory10,scaleLog,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {init} from './mds.termdb'
import {may_make_barchart} from './mds.termdb.barchart'
import {may_make_table} from './mds.termdb.table'
import {may_make_boxplot} from './mds.termdb.boxplot'
import {may_make_stattable} from './mds.termdb.stattable'
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
    term2_displaymode: arg.term2_displaymode ? arg.term2_displaymode : "stacked",
    term2_boxplot: 0,
    obj,
    custom_bins: {},
    bin_controls: {1:{}, 2:{}},
    bar_settings: {
      orientation: 'horizontal',
      unit: 'abs'
    }
  }

  arg.holder.style('white-space', 'nowrap')

  // bachart div
  plot.bar_div = arg.holder.append('div')
    .attr('class','pp-bar-holder')
    .style('display','inline-block')
  
  // boxplot svg
  plot.box_svg = arg.holder.append('svg')
  plot.yaxis_g = plot.box_svg.append('g') // for y axis
  plot.graph_g = plot.box_svg.append('g') // for bar and label of each data item

  // div for crosstab table
  plot.table_div = arg.holder.append('div')
  
  // set configuration controls
  controls(arg, plot, do_plot, update_plot)

  plot.legend_div = arg.holder.append('div')
    .style('margin','10px 0px')

  // div for stat summary table
  plot.stat_div = arg.holder.append('div') // for boxplot stats table
      .style('margin','10px 0px')
  
  //Exposed - not exponsed data
  plot.unannotated = (arg.unannotated) ? arg.unannotated : ''
  
  plot.term2 = arg.term2
  do_plot( plot )
}

function do_plot ( plot ) {
/*
make a barchart, boxplot, or stat table based on configs 
in the plot object called by showing the single-term plot 
at the beginning or stacked bar plot for cross-tabulating
*/ 
  // console.log(plot)
  plot.controls_update()
  may_make_barchart(plot)
  may_make_boxplot(plot)
  may_make_stattable(plot)
  may_make_table(plot)
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


