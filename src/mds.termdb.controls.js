import {select as d3select, event as d3event} from 'd3-selection'
import {
  menuoption_add_filter,
  menuoption_select_to_gp, 
  menuoption_select_group_add_to_cart
} from './mds.termdb'
import * as client from './client'
import {display as termui_display, numeric_bin_edit} from './mds.termdb.termsetting.ui'

// used to track unique "instances" of controls by plot object
// to be used to disambiguate between input names
const plots = []


const panel_bg_color = '#fdfaf4'
const panel_border_color = '#D3D3D3'

export function init(plot) {
  plots.push(plot)
  
  const self = {
    main(plot) {
      //self.dom.config_div.style('display', data.charts && data.charts.length ? 'inline-block' : 'none')
      self.updaters.forEach(updater => updater()) // match input values to current
    },
    index: plots.length - 1, // used for assigning unique input names, across different plots
    dom: {
      holder: plot.dom.controls
        .style('margin', '8px')
        .style('vertical-align', 'top')
        .style('transition','0.5s'),

      topbar: plot.dom.controls.append('div'),
      
      config_div: plot.dom.controls.append('div')
        .style('max-width', '50px')
        .style('height', 0)
        .style('vertical-align','top')
        .style('transition', '0.2s ease-in-out')
        .style('overflow', 'hidden')
    },
    visibility: 'hidden',
    // updaters will collect functions that synchronize an input 
    // to the relevant plot.term or setting
    // !!! important since changes to a plot.term or setting
    // !!! may be triggered by more than one input or function
    updaters: [],
    postRender(plot) {
      const abspos = plot.settings.currViews.includes("bachart") 
        && (
          !plot.views.barchart.visibleCharts
          || plot.views.barchart.visibleCharts.length > 1
          || plot.views.barchart.visibleCharts[0].settings.svgw > window.innerWidth - 400
        )

      self.dom.holder.style('position', abspos ? 'absolute' : '')
      /*
       !!! adjusting the barchart.dom.holder style shrinks the height so
       much that the rendered view is not visible - need to discuss !!!

      if(abspos){
        plot.views.barchart.dom.holder.style('height',self.dom.holder.node().offsetHeight+'px')
      }else{
        plot.views.barchart.dom.holder.style('height','')
      }*/
    }
  }

  setBurgerBtn(self)
  setConfigDiv(self)
  setBarsAsOpts(plot, self, 'term', 'Bars as', 1)
  setOverlayOpts(plot, self)
  setViewOpts(plot, self)
  setOrientationOpts(plot, self)
  setScaleOpts(plot, self)
  setBinOpts(plot, self, 'term1', 'Primary Bins')
  setDivideByOpts(plot, self)
  return self
}

function setBurgerBtn(self) {
  const hamburger_btn = self.dom.topbar.append('div')
    .attr('class','sja_edit_btn')
    .style('margin','10px')
    .style('font-size', '16px')
    .style('transition','0.5s')
    .html('&#8801;')
    .on('click', () => {
      self.updaters.forEach(updater => updater())
      self.visibility = self.dom.tip.style('visibility') == "hidden" ? "visible" : "hidden"

      //change visibility of 'config' div
      self.dom.tip.style('visibility', self.visibility)
        
      self.dom.config_div
        .style('max-width', self.visibility == 'hidden' ? '50px' : '660px')
        .style('height', self.visibility == 'hidden' ? 0 : '')
        
      self.dom.holder.style('background', self.visibility == 'hidden' ? '' : panel_bg_color)
        // .style('border', display == "none" ? 'solid 1px '+panel_border_color : "")

      hamburger_btn
        .html(self.visibility == 'hidden' ? '&#8801;' : '&#215;')
    })
}

function setConfigDiv(self) {
  self.dom.tip = self.dom.config_div.append('div')
    .style('visibility','hidden')
    .style('transition','0.2s')

  self.dom.table = self.dom.tip.append('table').attr('cellpadding',0).attr('cellspacing',0)

  self.updaters.push(()=>{
    self.dom.table.selectAll('tr')
      .filter(rowIsVisible)
      .each(rowStyle)
  })

  function rowIsVisible() {
    return d3select(this).style('display') != 'none'
  }

  function rowStyle(){
    d3select(this).selectAll('td')
    .style('border-top','2px solid #FFECDD')
    .style('padding','5px 10px')
  }

  return self.dom.table
}

function renderRadioInput(inputName, elem, opts, inputHandler) {
  const divs = elem.selectAll('div')
    .style('display', 'block')
    .data(opts, d => d.value)
  
  divs.exit().each(function(d){
    d3select(this)
    .on('input', null)
    .on('click', null)
    .remove()
  })
  
  const labels = divs.enter().append('div')
    .style('display', 'block')
    .style('padding', '5px')
    .append('label')
  
  const inputs = labels.append('input')
    .attr('type', 'radio')
    .attr('name', inputName)
    .attr('value', d=>d.value)
    .style('vertical-align','top')
    .on('input', inputHandler)
  
  labels.append('span')
    .style('vertical-align','top')
    .html(d=>'&nbsp;'+d.label)

  return {
    divs: elem.selectAll('div'), 
    labels: elem.selectAll('label').select('span'),
    inputs: labels.selectAll('input'),
  }
}

function setOrientationOpts(plot, self) {
  const tr = self.dom.table.append('tr')
  tr.append('td').html('Orientation').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-condition-unit-' + self.index, 
    td, 
    [
      {label: 'Vertical', value: 'vertical'},
      {label: 'Horizontal', value: 'horizontal'}
    ]
  )

  radio.inputs
  .property('checked', d => d.value == plot.settings.bar.orientation)
  .on('input', d => {
    plot.dispatch({settings: {
      bar: {
        orientation: d.value
      }
    }})
  })

  self.updaters.push(() => {
    tr.style('display', plot.settings.currViews.includes("barchart") ? "table-row" : "none")
  })
}

function setScaleOpts(plot, self) {
  const tr = self.dom.table.append('tr')
  tr.append('td').html('Scale').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-scale-unit-' + self.index, 
    td, 
    [
      {label: 'Linear', value: 'abs'},
      {label: 'Log', value: 'log'},
      {label: 'Percentage', value: 'pct'}
    ]
  )

  radio.inputs
  .property('checked', d => d.value == plot.settings.bar.unit)
  .on('input', d => {
    plot.dispatch({settings: {
      bar: {
        unit: d.value
      }
    }})
  })

  self.updaters.push(() => {
    tr.style('display', plot.settings.currViews.includes("barchart") ? "table-row" : "none")
    radio.divs.style('display', d => {
      if (d.value == 'log') {
        return plot.term2 ? 'none' : 'inline-block' 
      } else if (d.value == 'pct') {
        return plot.term2 ? 'inline-block' : 'none'
      } else {
        return 'inline-block'
      }
    })
  })
}

function setOverlayOpts(plot, self) {
  const tr = self.dom.table.append('tr')
  tr.append('td').html('Overlay with').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-overlay-' + self.index, 
    td, 
    [
      {label: 'None', value: 'none'},
      {label: 'Subconditions', value: 'bar_by_children'},
      {label: 'Grade', value: 'bar_by_grade'},
      {label: '', value: 'tree'},
      {label: 'Genotype', value: 'genotype'},
    ]
  )

  const bar_by_children_radio = radio.inputs.filter(d=>d.value=="bar_by_children").node();
  const bar_by_grade_radio = radio.inputs.filter(d=>d.value=="bar_by_grade").node();
  
  //add blue-pill for term2
  const treeInput = radio.inputs.filter((d)=>{ return d.value == 'tree'}).style('margin-top', '2px')
  const pill_div = d3select(treeInput.node().parentNode.parentNode)
    .append('div')
    .style('display','inline-block')
  
  const termuiObj = {
    mainlabel: 'Another term',
    holder: pill_div,
    genome: plot.obj.genome,
    mds: plot.obj.mds,
    tip: plot.obj.tip,
    currterm: plot.term,
    termsetting: {term:plot.term2, q: plot.term2?plot.term2.q:undefined},
    callback: (term2) => { //console.log(term2)
      plot.term2 = term2
      if (!term2) {
        plot.settings.bar.overlay = 'none'
        plot.dispatch({settings: {bar: {overlay: 'none'}}})
      } else {
        treeInput.property('checked', true)
        plot.dispatch({settings: {bar: {overlay: 'tree'}}}) 
      }
    }
  }

  plot.termuiObjOverlay = termuiObj
  termui_display(termuiObj)

  radio.inputs
  .property('checked', d => d.value == plot.settings.bar.overlay)
  .on('input', d => {
    d3event.stopPropagation()
    if (d.value == "none") {
      plot.dispatch({
        term2: undefined,
        settings: {
          currViews: ["barchart"],
          bar: {overlay: d.value}
        }
      })
    } else if (d.value == "tree") {
      plot.dispatch({
        term2: {term: termuiObj.termsetting.term},
        settings: {bar: {overlay: d.value}}
      })
    } else if (d.value == "genotype") {
      // to-do
      console.log('genotype overlay to be handled from term tree portal', d, d3event.target)
    } else if (d.value == "bar_by_children") { 
      if (plot.term.q.bar_by_children) {
        console.log('bar_by_children term1 should not allow subcondition overlay')
        return
      }
      const q = {bar_by_grade: 1}
      plot.dispatch({
        term2: {
          term: plot.term,
          q: {
            bar_by_children: 1
          }
        },
        settings: {bar: {overlay: d.value}}
      })
    } else if (d.value == "bar_by_grade") {
      if (plot.term.q.bar_by_grade){
        console.log('bar_by_grade term1 should not allow grade overlay')
        return
      }
      plot.dispatch({
        term2: {
          term: plot.term,
          q: {
            bar_by_grade: 1
          }
        },
        settings: {bar: {overlay: d.value}}
      })
    } else {
      console.log('unhandled click event', d, d3event.target)
    }
  })

  radio.inputs.on('click', d => {
    d3event.stopPropagation()
    if (d.value != 'tree' || d.value != plot.settings.bar.overlay) return
	
    plot.obj.showtree4selectterm(
      [plot.term.id, plot.term2 ? plot.term2.id : null],
	    tr.node(),
      (term2)=>{
  	    plot.obj.tip.hide()
        plot.dispatch({ term2 })
      }
    )
  })

  self.updaters.push(() => {
    // hide all options when opened from genome browser view 
    tr.style("display", plot.obj.modifier_ssid_barchart ? "none" : "table-row");
    // do not show genotype overlay option when opened from stand-alone page
    if (!plot.settings.bar.overlay) {
      plot.settings.bar.overlay = plot.obj.modifier_ssid_barchart
        ? 'genotype'
        : plot.term2 && plot.term2.id != plot.term.id
        ? 'tree'
        : 'none'
    }
    radio.inputs.property('checked', d => d.value == plot.settings.bar.overlay)

    radio.labels
      .html(d=>{
        const term1 = plot.term
        if (!term1.iscondition) return '&nbsp;'+ d.label
        if (d.value == "bar_by_children") return '&nbsp;'+ term1.id + " subconditions"
        if (d.value == "bar_by_grade") return '&nbsp;'+ term1.id + " grades"
        return '&nbsp;'+ d.label
      })

    radio.divs
      .style('display', d => { 
        const term1 = plot.term
        if (d.value == "bar_by_children") {
          return term1.iscondition && !term1.isleaf && term1.q && term1.q.bar_by_grade ? 'block' : 'none'
        } else if (d.value == "bar_by_grade") {
          return term1.iscondition && !term1.isleaf && term1.q && term1.q.bar_by_children ? 'block' : 'none'
        } else {
          const block = 'block' //term1.q.iscondition || (plot.term2 && plot.term2.iscondition) ? 'block' : 'inline-block'
          return d.value != 'genotype' || plot.obj.modifier_ssid_barchart ? block : 'none'
        }
      })

    if (plot.term2 && plot.term2.id != plot.term.id && plot.term2 != termuiObj.termsetting.term) {
      termuiObj.termsetting.term = plot.term2
      termuiObj.update_ui()
    }
  })
}

function setViewOpts(plot, self) {
  const tr = self.dom.table.append('tr')
  tr.append('td').html('Display mode').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-display-mode-' + self.index, 
    td, 
    [
      {label: 'Barchart', value: 'barchart'},
      {label: 'Table', value: 'table'},
      {label: 'Boxplot', value: 'boxplot'}
    ]
  )

  radio.inputs
  .property('checked', d => plot.settings.currViews.includes(d.value))
  .on('input', d => {
    plot.dispatch({
      settings: {currViews: [d.value]}
    })
  })

  self.updaters.push(() => {
    tr.style("display", plot.term2 ? "table-row" : "none")
    radio.inputs.property('checked', d => plot.settings.currViews.includes(d.value))
    radio.divs.style('display', d => plot.term2 && (d.value != 'boxplot' || plot.term2.isfloat) ? 'inline-block' : 'none')
  })
}

function setDivideByOpts(plot, self) {
  const tr = self.dom.table.append('tr')
  tr.append('td').html('Divide by').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-divide-by-' + self.index, 
    td, 
    [
      {label: 'None', value: 'none'},
      {label: '', value: 'tree'},
      {label: 'Genotype', value: 'genotype'}
    ]
  )
  
  //add blue-pill for term0
  const pill_div = d3select(radio.divs.filter((d)=>{ return d.value == 'tree'}).node())
    .append('div')
    .style('display','inline-block')
  
  const termuiObj = {
    holder: pill_div,
    genome: plot.obj.genome,
    mds: plot.obj.mds,
    tip: plot.obj.tip,
    currterm: plot.term,
    termsetting: {term:plot.term0, q: plot.term0?plot.term0.q:undefined},
    currterm: plot.term,
    callback: (term0) => {
      plot.dispatch({
        term0: term0 ? {term: term0} : undefined,
        settings: {
          bar: {
            divideBy: term0 ? 'tree' : 'none'
          }
        }
      })
    }
  }

  plot.termuiObjDivide = termuiObj
  termui_display(termuiObj)

  radio.inputs
  .property('checked', d => d.value == plot.settings.bar.divideBy)
  .on('input', d => {
    d3event.stopPropagation()
    plot.settings.bar.divideBy = d.value
    if (d.value == "none") {
      plot.dispatch({term0: undefined})
    } else if (d.value == "tree") {
      plot.dispatch({term0: {term: termuiObj.termsetting.term}})
    } else if (d.value == "genotype") {
      // to-do
    }
  })

  self.updaters.push(() => {
    // hide all options when opened from genome browser view 
    tr.style("display", plot.obj.modifier_ssid_barchart || !plot.settings.currViews.includes("barchart") ? "none" : "table-row")
    // do not show genotype divideBy option when opened from stand-alone page
    if (!plot.settings.bar.divideBy) {
      plot.settings.bar.divideBy = plot.obj.modifier_ssid_barchart
        ? 'genotype'
        : plot.term0
        ? 'tree'
        : 'none'
    }
    radio.inputs.property('checked', d => d.value == plot.settings.bar.divideBy)
    radio.divs.style('display', d => {
      if (d.value == "max_grade_perperson" || d.value == "most_recent_grade") {
        return plot.term.iscondition || (plot.term0 && plot.term0.iscondition) ? 'block' : 'none'
      } else {
        const block = 'block' //plot.term.iscondition || (plot.term0 && plot.term0.iscondition) ? 'block' : 'inline-block'
        return d.value != 'genotype' || plot.obj.modifier_ssid_barchart ? block : 'none'
      }
    })

    if (plot.term0 && plot.term0 != termuiObj.termsetting.term) {
      termuiObj.termsetting.term = plot.term0
      termuiObj.update_ui()
    }
  })
}

function setBarsAsOpts(plot, self, termNum, label, index) {
  /**/
  const tr = self.dom.table.append('tr')
  tr.append('td').html(label).attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  /*
  const options = [
    {label: "Subconditions, max grade", value: "bar_by_children + value_by_max_grade"},
    {label: "Subconditions, most recent", value: "bar_by_children + value_by_most_recent"},
    {label: "Subconditions, graded", value: "bar_by_children + value_by_computable_grade"},
    {label: "Max grade per patient", value: "bar_by_grade + value_by_max_grade"},
    {label: "Most recent grades per patient", value: "bar_by_grade + value_by_most_recent"}, 
    {label: "Grade per patient", value: "bar_by_grade + value_by_computable_grade"},
  ]
  */
   if (!plot.term.q) plot.term.q = {}

   const termuiObj = {
    holder: td.append('div'),
    genome: plot.obj.genome,
    mds: plot.obj.mds,
    tip: plot.obj.tip,
    currterm: plot.term,
    termsetting: {term: plot.term},
    currterm: plot.term,
    is_term1: true,
    callback: (term) => {
      plot.dispatch({term})
    }
  }
  setTimeout(()=> {
    if (!plot.term.q) plot.term.q = {}
    termuiObj.termsetting.q = plot.term.q
    termui_display(termuiObj)
  },0)

  self.updaters.push(() => {
    tr.style('display', plot.term && plot.term.iscondition ? 'table-row' : 'none')
    plot.termuiObjOverlay.update_ui()
  })
}


function setBinOpts(plot, self, termNum, label) {
  const tr = self.dom.table.append('tr')

  tr.append('td').html(label).attr('class', 'sja-termdb-config-row-label')

  const bin_edit_td = tr.append('td')

  bin_edit_td.append('div')
    .attr('class','sja_edit_btn')
    .style('margin-left','0px')
    .html('EDIT')
    .on('click',()=>{
      // click to show ui and customize binning
      numeric_bin_edit(plot.tip, plot.term, plot.term.q, true, (q)=>{
        plot.dispatch({term: {term: plot.term, q}})
    })
  })

  //TODO: remove following code if not used
  self.updaters.push(() => {
    plot.term1 = plot.term
    tr.style('display', plot[termNum] && (plot[termNum].isfloat || plot[termNum].isinteger) ? 'table-row' : 'none')
  })
}
