import * as client from './client'
import * as common from './common'
import {TermdbBarchart} from './mds.termdb.barchart'
import {init as table_init} from './mds.termdb.table'
import {init as boxplot_init} from './mds.termdb.boxplot'
import {init as stattable_init} from './mds.termdb.stattable'
import {controls} from './mds.termdb.controls'

export function init(arg) {
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
        unit: 'abs',
        divideBy: 'none',
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
  controls(arg, plot, main)
  
  //Exposed - not exponsed data
  plot.unannotated = (arg.unannotated) ? arg.unannotated : ''
  plot.term2 = arg.term2
  main( plot )
  if (Array.isArray(arg.obj.filterCallbacks)) {
    arg.obj.filterCallbacks.push(()=>main(plot))
  }
}

// the same route + request payload/URL parameters
// should produce the same response data, so the
// results of the server request can be cached in the
// client 
const serverData = {}

function main(plot) {
  const dataName = getDataName(plot)
  if (serverData[dataName]) {
    render(plot, serverData[dataName]) 
  }
  else {
    client.dofetch2('/termdb-barchart' + dataName)
    .then(chartsData => {
      serverData[dataName] = chartsData
      render(plot, chartsData)
    })
  }
}

// creates a unique request identifier to be used
// for caching server response keys
function getDataName(plot) {
  const obj = plot.obj

  return '?'
    + 'genome=' + obj.genome.name
    + '&dslabel=' + (obj.dslabel ? obj.dslabel : obj.mds.label)
    + '&term0=' + (plot.term0 ? plot.term0.id : '')
    + '&term1=' + plot.term.id
    + '&term2=' + (
      obj.modifier_ssid_barchart ? 'genotype' 
      : plot.term2 ? plot.term2.id
      : ''
    )
    + '&ssid=' + (obj.modifier_ssid_barchart ? obj.modifier_ssid_barchart.ssid : '')
    + '&mname=' + (obj.modifier_ssid_barchart ? obj.modifier_ssid_barchart.mutation_name : '')
    + '&filter=' + (
        !obj.termfilter 
        ? ''
        : encodeURIComponent(JSON.stringify(obj.termfilter.terms))
    )
    + '&custom_bins=' + (
      !plot.custom_bins 
      ? '' 
      : encodeURIComponent(JSON.stringify(plot.custom_bins))
    )
}

function render ( plot, data ) {
/*
make a barchart, boxplot, or stat table based on configs 
in the plot object called by showing the single-term plot 
at the beginning or stacked bar plot for cross-tabulating
*/ 
  // console.log(plot)
  plot.controls_update()
  plot.views.barchart.main(plot, data, plot.term2_displaymode == "stacked", obj)
  plot.views.boxplot.main(plot, data, plot.term2_displaymode == "boxplot")
  plot.views.stattable.main(plot, data, data.boxplot != undefined && plot.term2_displaymode == "stacked")
  plot.views.table.main(plot, data, plot.term2_displaymode == "table")
}

