import * as client from './client'
import * as common from './common'
import {TermdbBarchart} from './mds.termdb.barchart'
import {init as table_init} from './mds.termdb.table'
import {init as boxplot_init} from './mds.termdb.boxplot'
import {init as stattable_init} from './mds.termdb.stattable'
import {controls} from './mds.termdb.controls'

/*
  Purpose: coordinate the rendering of barchart, boxplot, crosstab, stat views
  Workflow: 
  1.  When BARCHART button clicked, div for button was created with CROSSTAB (with addbutton_crosstabulate()).
  2.  Plot object was created which has been used by do_plot(), set_yscale() and get_max_labelheight().
    plot = {
      tip: new client.Menu({padding:'18px'}), //tip from clinent.Menu for tooltip while hoverover bar or x-axis label
      term: arg.term,   // 1st term 
      items: arg.items, // with all items in the term with item.label and item.value
      settings: {
        common: {
          // settings that affect more than view
        },
        bar | boxplot: { 
          // see the settings and comments in the mds.termdb.[bar | boxplot] code 
        }
      },
      dom: {
        // will hold parent DOM elements for the general layout
        // view-specific DOM elements are not held here
        // but within the view objects
      },
      views: {
        // will hold view functions or instances
      }
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


export function render(arg) {
/*
arg: server returned data
.items[]
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
    obj: arg.obj,
    genome: arg.genome,
    dslabel: arg.dslabel,
    tip: new client.Menu({padding:'18px'}),
    
    // data
    term: arg.term,
    items: arg.items,
    boxplot: arg.boxplot,

    // may need to put the following properties under
    // a namespace or within the affected module
    custom_bins: {},
    bin_controls: {1:{}, 2:{}},
    term2_displaymode: arg.term2_displaymode ? arg.term2_displaymode : "stacked",
    term2_boxplot: 0,
    
    // namespaced configuration settings to indicate
    // the scope affected by a setting key-value
    settings: {
      common: {
        use_logscale: false, // flag for y-axis scale type, 0=linear, 1=log
        use_percentage: false,
        barheight: 300, // maximum bar length 
        barwidth: 20, // bar thickness
        barspace: 2 // space between two bars
      },
      boxplot: {
        toppad: 20, // top padding
        yaxis_width: 100,
        label_fontsize: 15,
      },
      bar: {
        orientation: 'horizontal',
        unit: 'abs'
      }
    },
    // dom: {} see below
    // views: {} see below
  }

  arg.holder.style('white-space', 'nowrap')
  // set the parent DOM elements for viz and controls
  plot.dom = {
    // dom.viz will hold the rendered view
    viz: arg.holder.append('div').style('display','inline-block'),
    // dom.controls will hold the config input, select, button elements
    controls: arg.holder.append('div').style('display','inline-block')
  }

  // set view functions or objects
  plot.views = {
    barchart: new TermdbBarchart({
      holder: plot.dom.viz,
      settings: {},
      term1: arg.term,
      obj,
    }),
    boxplot: boxplot_init(plot.dom.viz),
    stattable: stattable_init(plot.dom.viz),
    table: table_init(plot.dom.viz)
  }
  // set configuration controls
  controls(arg, plot, do_plot, update_plot)
  
  //Exposed - not exponsed data
  plot.unannotated = (arg.unannotated) ? arg.unannotated : ''
  plot.term2 = arg.term2
  do_plot( plot )
  if (Array.isArray(arg.obj.filterCallbacks)) {
    arg.obj.filterCallbacks.push(()=>update_plot(plot))
  }
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
    obj: plot.obj,
    termfilter: plot.obj.termfilter ? plot.obj.termfilter.terms : ''
  }

  if(plot.term2){
    arg.crosstab2term = 1
    arg.term1 = { id : plot.term.id }
    arg.term2 = { id : plot.term2.id}
    arg.boxplot = plot.term2_boxplot
  }else{
    arg.barchart = { id : plot.term.id }
  }

  client.dofetch( 'termdb', arg )
  .then(data=>{
    if(data.error) throw data.error
    if(!data.lst) throw 'no data for barchart'

    plot.items =  data.lst
    if (data.binmax){ 
      plot.settings.boxplot.yscale_max = data.binmax
    }
    do_plot( plot )
  })
}

// translate plot properties into the expected 
// barchart settings keys
function may_make_barchart(plot) {
  const obj = plot.obj
  plot.views.barchart.main({
    isVisible: plot.term2_displaymode == "stacked",
    genome: obj.genome.name,
    dslabel: obj.dslabel ? obj.dslabel : obj.mds.label,
    term1: plot.term.id,
    term2: obj.modifier_ssid_barchart ? 'genotype' 
      : plot.term2 ? plot.term2.id
      : '',
    ssid: obj.modifier_ssid_barchart ? obj.modifier_ssid_barchart.ssid : '',
    mname: obj.modifier_ssid_barchart ? obj.modifier_ssid_barchart.mutation_name : '',
    groups: obj.modifier_ssid_barchart ? obj.modifier_ssid_barchart.groups : null,
    term2Obj: plot.term2,
    unit: plot.settings.bar.unit,
    custom_bins: plot.custom_bins,
    orientation: plot.settings.bar.orientation,
    // normalize bar thickness regardless of orientation
    colw: plot.settings.common.barwidth,
    rowh: plot.settings.common.barwidth,
    colspace: plot.settings.common.barspace,
    rowspace: plot.settings.common.barspace,
  }, obj)
}

function may_make_boxplot(plot) {
  plot.views.boxplot.main(plot, plot.term2_displaymode == "boxplot")
}

function may_make_stattable(plot) {
  plot.views.stattable.main(plot, plot.boxplot != undefined)
}

function may_make_table(plot) {
  plot.views.table.main(plot, plot.term2_displaymode == "table")
}

