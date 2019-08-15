import * as client from './client'
import * as common from './common'
import {TermdbBarchart} from './mds.termdb.barchart'
import {init as table_init} from './mds.termdb.table'
import {init as boxplot_init} from './mds.termdb.boxplot'
import {init as stattable_init} from './mds.termdb.stattable'
import {init as controls_init} from './mds.termdb.controls'


export function init(arg) {
/*
arg: 
.obj      required, tree-object
.genome   required
.dslabel  required
.term     required, term to be rendered as bars
.holder   required, dom element to hold the control panel and rendered views

+ see the overridable key-values of the plot object below
*/
  
  // initiating the plot object
  const plot = {
    // set() is the gatekeeper function to protect the shared state
    // among the different viz and controls
    set(updatedKeyVals={}) { //console.log(updatedKeyVals)
      nestedUpdate(plot, null, updatedKeyVals)
      setTimeout(()=>main(plot), 0)
    },
    tip: new client.Menu({padding:'18px'}),
  }

  plot.bus = client.get_event_bus(
    ["postInit", "postRender"],
    arg.obj.callbacks.plot,
    plot
  )

  // fill-in the REQUIRED argument keys
  Object.assign(plot, {
    obj: arg.obj,
    genome: arg.genome,
    dslabel: arg.dslabel,
    term: arg.term,
    // set the parent DOM elements for viz and controls
    dom: {
      holder: arg.holder
        .style('white-space', 'nowrap')
        .style('overflow-x', 'scroll'),
      
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
  })

  // fill-in the OPTIONAL argument keys
  Object.assign(plot, {
    // data
    term0: arg.term0 ? arg.term0 : null,
    term2: arg.term2 
      ? arg.term2 
      : arg.obj.modifier_ssid_barchart
      ? {mname: arg.obj.modifier_ssid_barchart.mutation_name}
      : null,
    unannotated: arg.unannotated ? arg.unannotated : ''
  })
    
  // namespaced configuration settings to indicate
  // the scope affected by a setting key-value
  // set the default settings
  plot.settings = {
    // currViews: ["barchart" | "table" | "boxplot"] 
    // + auto-added ["stattable"] if barchart && plot.term.isfloat
    currViews: ["barchart"], 
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
  }
  
  // override the default settings if arg.settings key-values are supplied
  if (arg.settings && typeof arg.settings == "object") {
    for(const key in arg.settings) {
      const val = arg.settings[key]
      if (!val || Array.isArray(val) || typeof val !== "object") plot.settings[key] = val
      else Object.assign(plot.settings[key], val)
    }
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
  plot.controls = controls_init(plot)
  plot.bus.emit("postInit")


  main( plot )
  if ( arg.obj.termfilter && arg.obj.termfilter.callbacks ) {
    // termfilter in action, insert main() of this plot to callback list to be called when filter is updated
	  // FIXME svg dimension will be 0 when the plot is invisible (as turned off by the VIEW button)
    arg.obj.termfilter.callbacks.push(()=>main(plot))
  }

  function nestedUpdate(obj, key, value, keylineage=[]) {
    // 7 is a a harcoded maximum depth allowed for processing nested object values
    if (keylineage.length >= 7) {
      obj[key] = value
    } else if (key=='term' || key == 'term2' || key == 'term0') {
      if (!value) obj[key] = value
      else if (typeof value == "object") {
        if (value.term) obj[key] = Object.assign({}, value.term)
        if (value.q) obj[key].q = Object.assign({}, value.q)
      }
    } else if (key !== null && (!value || typeof value != 'object')) {
      obj[key] = value
    } else {
      for(const subkey in value) {
        nestedUpdate(key == null ? obj : obj[key], subkey, value[subkey], keylineage.concat(subkey))
      }
    }
  }

  return plot
}

// the same route + request payload/URL parameters
// should produce the same response data, so the
// results of the server request can be cached in the
// client 
const serverData = {}

function main(plot, callback = ()=>{}) {
  coordinateState(plot)

  // create an alternative reference 
  // to plot.[term0,term,term2] and term1_q parameters
  // for convenience and namespacing related variables
  plot.terms = [plot.term0, plot.term, plot.term2]
  //plot.dom.holder.style('max-width', Math.round(85*window.innerWidth/100) + 'px')

  const dataName = getDataName(plot)
  if (serverData[dataName]) {
    syncParams(plot, serverData[dataName])
    render(plot, serverData[dataName])
  }
  else {
    client.dofetch2('/termdb-barsql' + dataName)
    .then(chartsData => {
      serverData[dataName] = chartsData
      syncParams(plot, serverData[dataName])
      render(plot, chartsData)
    })
    //.catch(window.alert)
  }
}


function coordinateState(plot) {
/*
  Enforce the coordinated updates of interdependent state key-values
*/
  if (plot.term2) {
    if (plot.settings.currViews.includes("boxplot")) {
      if (!plot.term2.isfloat) plot.settings.currViews = ["barchart"]
    } 

    if (plot.term2.q && plot.term2.id == plot.term.id) {
      if (
        (plot.term2.q.bar_by_children && (!plot.term.q || !plot.term.q.bar_by_grade))
        || (plot.term2.q.bar_by_grade && (!plot.term.q || !plot.term.q.bar_by_children))
      ) plot.term2 = undefined
    }

    if (plot.term2 && plot.term2.iscondition && plot.term2.id == plot.term.id) {
      if (!plot.term2.q) plot.term2.q = {}
      for(const param of ['value_by_max_grade', 'value_by_most_recent', 'value_by_computable_grade']) {
        delete plot.term2.q[param]
        if (plot.term.q[param]) plot.term2.q[param] = 1
      }
    }
  } else if (!plot.settings.currViews.includes("barchart")) {
    plot.settings.currViews = ["barchart"]
  }
  
  const i = plot.settings.currViews.indexOf("stattable")
  if (i == -1) {
    if (plot.settings.currViews.includes("barchart") && (plot.term.isfloat /*|| plot.term.isinteger*/)) {
      plot.settings.currViews.push("stattable")
    }
  } else if (!plot.settings.currViews.includes("barchart") || (!plot.term.isfloat /*&& !plot.term.isinteger*/)) {
    plot.settings.currViews.splice(i, 1)
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
  plot.controls.main(plot, data)
  plot.views.barchart.main(plot, data, plot.settings.currViews.includes("barchart"), plot.obj)
  plot.views.boxplot.main(plot, data, plot.settings.currViews.includes("boxplot"))
  plot.views.stattable.main(plot, data, plot.settings.currViews.includes("stattable"))
  plot.views.table.main(plot, data, plot.settings.currViews.includes("table"))
  plot.views.banner.main(plot, data)
  plot.controls.postRender(plot)
  plot.bus.emit("postRender")
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

