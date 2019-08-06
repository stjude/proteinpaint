import * as client from './client'
import * as common from './common'
import {TermdbBarchart} from './mds.termdb.barchart'
import {init as table_init} from './mds.termdb.table'
import {init as boxplot_init} from './mds.termdb.boxplot'
import {init as stattable_init} from './mds.termdb.stattable'
import {controls} from './mds.termdb.controls'

export function init(arg, callback = ()=>{}) {
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
    term0: arg.term0 ? arg.term0 : null,
    term: arg.term,
    term2: arg.term2 
      ? arg.term2 
      : arg.obj.modifier_ssid_barchart
      ? {mname: arg.obj.modifier_ssid_barchart.mutation_name}
      : null,
    items: arg.items,
    boxplot: arg.boxplot,

    // may need to put the following properties under
    // a namespace or within the affected module
    bin_controls: {1:{}, 2:{}},
    term2_displaymode: arg.term2_displaymode ? arg.term2_displaymode : "stacked",
    term2_boxplot: 0,

    unannotated: arg.unannotated ? arg.unannotated : '',
    
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
        barheight: 400, // maximum bar length 
        barwidth: 25, // bar thickness
        barspace: 5 // space between two bars
      },
      bar: {
        orientation: 'horizontal',
        unit: 'abs',
        overlay: 'none',
        divideBy: 'none'
      }
    },
    // dom: {} see below
    // views: {} see below
  }

  arg.holder
    .style('white-space', 'nowrap')
    .style('overflow-x', 'scroll')
  // set the parent DOM elements for viz and controls
  plot.dom = {
    holder: arg.holder,
    
    // will hold no data notice or the page title in multichart views
    banner: arg.holder.append('div').style('display', 'none'),
    
    // dom.controls will hold the config input, select, button elements
    controls: arg.holder.append('div')
      .attr('class','pp-termdb-plot-controls')
      .style('display','inline-block'),
    
    // dom.viz will hold the rendered view
    viz: arg.holder.append('div')
      .attr('class','pp-termdb-plot-viz')
      .style('display','inline-block')
      .style('min-width', '300px')
      .style('margin-left', '50px'),
  }

  // set view functions or objects
  plot.views = {
    banner: banner_init(plot.dom.banner), 
    barchart: new TermdbBarchart({
      holder: plot.dom.viz,
      settings: {},
      term1: arg.term,
      obj: arg.obj,
    }),
    boxplot: boxplot_init(plot.dom.viz),
    stattable: stattable_init(plot.dom.viz),
    table: table_init(plot.dom.viz)
  }
  // set configuration controls
  controls(arg, plot, main)
  
  main( plot, callback )
  if ( arg.obj.termfilter && arg.obj.termfilter.callbacks ) {
    // termfilter in action, insert main() of this plot to callback list to be called when filter is updated
	// FIXME svg dimension will be 0 when the plot is invisible (as turned off by the VIEW button)
    arg.obj.termfilter.callbacks.push(()=>main(plot))
  }
}

// the same route + request payload/URL parameters
// should produce the same response data, so the
// results of the server request can be cached in the
// client 
const serverData = {}

function main(plot, callback = ()=>{}) {
  // create an alternative reference 
  // to plot.[term0,term,term2] and term1_q parameters
  // for convenience and namespacing related variables
  plot.terms = [plot.term0, plot.term, plot.term2]
  plot.dom.holder.style('max-width', Math.round(85*window.innerWidth/100) + 'px')

  const dataName = getDataName(plot)
  if (serverData[dataName]) {
    syncParams(plot, serverData[dataName])
    render(plot, serverData[dataName])
    callback({plot, main})
  }
  else {
    client.dofetch2('/termdb-barsql' + dataName)
    .then(chartsData => {
      serverData[dataName] = chartsData
      syncParams(plot, serverData[dataName])
      render(plot, chartsData)
      callback({plot, main})
    })
    //.catch(window.alert)
  }
}

// creates URL search parameter string, that also serves as 
// a unique request identifier to be used for caching server response
function getDataName(plot) {
  const obj = plot.obj
  const params = [
    'genome=' + obj.genome.name,
    'dslabel=' + (obj.dslabel ? obj.dslabel : obj.mds.label)
  ];

  plot.terms.forEach((term, i)=>{
    if (!term) return
    params.push('term'+i+'_id=' + encodeURIComponent(term.id))
    if (term.iscondition && !term.q) term.q = {}
    if (term.q && typeof term.q == 'object') {
      if (term.iscondition && !Object.keys(term.q).length) {
        term.q = {bar_by_grade:1, value_by_max_grade:1}
      }
      params.push('term'+i+'_q=' +encodeURIComponent(JSON.stringify(term.q)))
    }
  })

  if (obj.modifier_ssid_barchart) {
    params.push(
      'term2_is_genotype=1',
      'ssid=' + obj.modifier_ssid_barchart.ssid,
      'mname=' + obj.modifier_ssid_barchart.mutation_name,
      'chr=' + obj.modifier_ssid_barchart.chr,
      'pos=' + obj.modifier_ssid_barchart.pos
    )
  } 

  if (obj.termfilter && obj.termfilter.terms && obj.termfilter.terms.length) {
    params.push('tvslst=' + encodeURIComponent(JSON.stringify(obj.termfilter.terms.map(filter=>{
      const f = Object.create(null)
      for(const key in filter) {
        if (key != "term") f[key] = filter[key]
        else {
          f.term = {id: filter.term.id}
          for(const subkey in filter.term) {
            if (subkey.startsWith('is')) f.term[subkey] = filter.term[subkey]
          }
        }
      }
      return f
    }))))
  }

  return '?' + params.join('&')
}

function syncParams( plot, data ) {
  if (!data || !data.refs) return
  for(const i of [0,1,2]) {
    const term = plot.terms[i]
    if (!term) continue
    if (data.refs.bins && data.refs.bins[i]) {
      term.bins = data.refs.bins[i]
    }
    if (data.refs.q && data.refs.q[i]) {
      if (!term.q) term.q = {}
      const q = data.refs.q[i]
      if (q !== term.q) {
        for(const key in term.q) delete term.q[key]
        Object.assign(term.q, q)
      }
    }
  }
}

function render ( plot, data ) {
/*
make a barchart, boxplot, or stat table based on configs 
in the plot object called by showing the single-term plot 
at the beginning or stacked bar plot for cross-tabulating
*/ 
  plot.controls_update(plot, data)
  plot.views.barchart.main(plot, data, plot.term2_displaymode == "stacked", plot.obj)
  plot.views.boxplot.main(plot, data, plot.term2_displaymode == "boxplot")
  plot.views.stattable.main(plot, data, data.boxplot != undefined && plot.term2_displaymode == "stacked")
  plot.views.table.main(plot, data, plot.term2_displaymode == "table")
  plot.views.banner.main(plot, data)
}

function banner_init(div) {
  div.style('text-align', 'center')
     .style('padding', '10px')

  return {
    main(plot, data) {
      if (!data.charts.length) {
        div.html('No data to display.').style('display', 'block')
      } else {
        div.style('display', 'none')
      }
    }
  }
}

