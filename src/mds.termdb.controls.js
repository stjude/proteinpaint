import {select as d3select, event as d3event} from 'd3-selection'
import {
  showtree4selectterm, 
  menuoption_add_filter,
  menuoption_select_to_gp, 
  menuoption_select_group_add_to_cart
} from './mds.termdb'
import * as client from './client'

// used to track controls unique "instances" by plot object
// to be used to disambiguate between input names
const plots = []


const panel_bg_color = '#EBFFEF'
const panel_border_color = '#C5E2CC'
const panel_row_alt_color = 'white'

export function controls(arg, plot, main) {
  plot.config_div = arg.holder.append('div')
    .style('display','inline-block')
    .style('vertical-align','top')
    .style('margin', '8px')

  // controlsIndex to be used to assign unique radio input names
  // by config div
  plot.controlsIndex = plots.length
  plots.push(plot)

  // label
  plot.config_div.append('div').append('button')
    .style('color', '#333')
	.style('margin','10px')
    .style('font-size', '14px')
    .style('cursor', 'pointer')
    .html('CONFIG')
    .on('click', () => {
      plot.controls.forEach(update => update())
      const display = tip.style('display')
      tip.style('display', display == "none" ? "inline-block" : "none")
      plot.config_div
	  	.style('background', display == "none" ? panel_bg_color : "")
	  	.style('border', display == "none" ? 'solid 1px '+panel_border_color : "")
    })

  const tip = plot.config_div.append('div').style("display","none")
  // will be used to track control elements
  // for contextual updates
  plot.controls = []
  const table = tip.append('table').attr('cellpadding',0).attr('cellspacing',0)
  setConditionUnitOpts(plot, main, table, 'term', 'Bar categories', 1)
  setOverlayOpts(plot, main, table, arg)
  setViewOpts(plot, main, table)
  setOrientationOpts(plot, main, table)
  setScaleOpts(plot, main, table)
  setBinOpts(plot, main, table, 'term1', 'Primary Bins')
  setBinOpts(plot, main, table, 'term2', 'Overlay Bins')
  setDivideByOpts(plot, main, table, arg)

  plot.controls_update = () => {
    plot.controls.forEach(update => update())
    table.selectAll('tr')
    .filter(rowIsVisible)
    .each(altRowColors)
  }

  function rowIsVisible() {
    return d3select(this).style('display') != 'none'
  }

  function altRowColors(d,i){
    d3select(this).selectAll('td')
    //.style('border-top', i !== 0 ? '1px solid #ccc' : '')
    .style('background-color', i%2 == 0 ? panel_row_alt_color : '')
  }
}

function renderRadioInput(inputName, elem, opts, inputHandler) {
  const divs = elem.selectAll('div')
    .style('display', 'inline-block')
    .data(opts, d => d.value)
  
  divs.exit().each(function(d){
    d3select(this)
    .on('input', null)
    .on('click', null)
    .remove()
  })
  
  const labels = divs.enter().append('div')
    .style('display', 'inline-block')
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
    labels: elem.selectAll('label'),
    inputs: labels.selectAll('input'),
  }
}

function setOrientationOpts(plot, main, table) {
  const tr = table.append('tr')
  tr.append('td').html('Orientation').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-condition-unit-' + plot.controlsIndex, 
    td, 
    [
      {label: 'Vertical', value: 'vertical'},
      {label: 'Horizontal', value: 'horizontal'}
    ]
  )

  radio.inputs
  .property('checked', d => d.value == plot.settings.bar.orientation)
  .on('input', d => {
    plot.settings.bar.orientation = d.value
    main(plot)
  })

  plot.controls.push(() => {
    tr.style('display', plot.term2_displaymode == "stacked" ? "table-row" : "none")
  })
}

function setScaleOpts(plot, main, table) {
  const tr = table.append('tr')
  tr.append('td').html('Scale').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-scale-unit-' + plot.controlsIndex, 
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
    plot.settings.bar.unit = d.value
    main(plot)
  })

  plot.controls.push(() => {
    tr.style('display', plot.term2_displaymode == "stacked" ? "table-row" : "none")
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

function setOverlayOpts(plot, main, table, arg) {
  const tr = table.append('tr')
  tr.append('td').html('Overlay with').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-overlay-' + plot.controlsIndex, 
    td, 
    [
      {label: 'None', value: 'none'},
      {label: 'Term', value: 'tree'},
      {label: 'Genotype', value: 'genotype'},
      //{label: 'Subconditions', value: 'by_children'},
      //{label: 'Highest graded subconditions per person', value: 'max_graded_children'},
      //{label: 'Max. grade per person', value: 'max_grade_perperson'},
      {label: 'Grade by subcondition', value: 'max_grade_by_subcondition'},
      //{label: 'Most recent grade', value: 'most_recent_grade'},
    ]
  )

  radio.inputs
  .property('checked', d => d.value == plot.settings.bar.overlay)
  .on('input', d => {
    d3event.stopPropagation()
    plot.settings.bar.overlay = d.value
    if (d.value == "none") {
      plot.term2 = undefined
      plot.term2_displaymode = 'stacked'
      main(plot)
    } else if (d.value == "tree") {
      const obj = Object.assign({},plot.obj)
      delete obj.termfilter
      delete obj.dom.termfilterdiv
      const _arg = {
        term1: arg.term,
        term2: plot.term2,
        obj,
        callback: term2 => {
          obj.tip.hide()

          // adding term2 for the first time
          plot.term2 = term2
          if (plot.term2.iscondition) {
            plot.settings.common.conditionParents[2] = plot.term2.id
            if (!plot.settings.common.conditionUnits[2]) {
              plot.settings.common.conditionUnits[2] = "max_grade_perperson"
            }
          }
          if (plot.term2.isfloat && plot.term2_boxplot) { 
            plot.term2_displaymode = 'boxplot'
          } else {
            if (plot.term2_displaymode == "boxplot") {
              plot.term2_displaymode = "stacked"
            }
            plot.term2_boxplot = 0
          }
          main( plot )
        }
      }
      showtree4selectterm( _arg, tr.node() )
    } else if (d.value == "genotype") {
      // to-do
    } else if (
        d.value == "by_children" 
        || d.value == "max_graded_children" 
        || d.value == "max_grade_perperson" 
        || d.value == "most_recent_grade"
      ) {
      if (!plot.term2) plot.term2 = plot.term
      plot.settings.common.conditionUnits[2] = d.value
      plot.settings.common.conditionParents[2] = plot.term2.id
      main(plot)
    } else if (d.value == "max_grade_by_subcondition") {
      if (!plot.term2) plot.term2 = plot.term
      plot.settings.common.conditionUnits[2] = d.value
      plot.settings.common.conditionParents[2] = plot.term2.id
      plot.settings.common.conditionParents[1] = plot.term.id
      main(plot)
    }
  })

  radio.inputs.on('click', d => {
    d3event.stopPropagation()
    if (d.value != 'tree' || d.value != plot.settings.bar.overlay) return
    const obj = Object.assign({},plot.obj)
    delete obj.termfilter
    delete obj.termfilterdiv
    const _arg = {
      term1: arg.term,
      term2: plot.term2,
      obj,
      callback: term2=>{
        obj.tip.hide()
        plot.term2 = term2
        if (plot.term2.iscondition) {
          plot.settings.common.conditionParents[2] = plot.term2.id
          if (!plot.settings.common.conditionUnits[2]) {
            plot.settings.common.conditionUnits[2] = "max_grade_perperson"
          }
        }
        if (plot.term2.isfloat && plot.term2_boxplot) { 
          plot.term2_displaymode = 'boxplot'
        } else {
          if (plot.term2_displaymode == "boxplot") {
            plot.term2_displaymode = "stacked"
          }
          plot.term2_boxplot = 0
        }
        main( plot )
      }
    }
    showtree4selectterm( _arg, tr.node() )
  })

  plot.controls.push(() => {
    // hide all options when opened from genome browser view 
    tr.style("display", plot.obj.modifier_ssid_barchart ? "none" : "table-row")
    // do not show genotype overlay option when opened from stand-alone page
    if (!plot.settings.bar.overlay) {
      plot.settings.bar.overlay = plot.obj.modifier_ssid_barchart
        ? 'genotype'
        : plot.term2 
        ? 'tree'
        : 'none'
    }
    radio.inputs.property('checked', d => d.value == plot.settings.bar.overlay)
    const cu = plot.settings.common.conditionUnits
    radio.divs.style('display', d => {
      if (d.value == "by_children") {
        if (plot.term.iscondition && (!plot.term2 || plot.term2.id == plot.term.id)) return 'none'
        return plot.term.isleaf || cu[1] == 'by_children' ? 'none' : 'block'
      } /*else if (d.value == "max_graded_children") {
        if (cu[1] == 'by_children') return 'none'
        return plot.term.iscondition && (!plot.term2 || plot.term2.id == plot.term.id) ? 'block' : 'none'
      }*/ else if (d.value == "max_grade_by_subcondition") {
        // if (cu[1] == 'max_grade_perperson' || cu[1] == "most_recent_grade") return 'none'
        return !plot.term.isleaf && plot.term.iscondition && (!plot.term2 || plot.term2.id == plot.term.id) ? 'block' : 'none'
      } /*else if (d.value == "max_grade_perperson" || d.value == "most_recent_grade") {
        if (plot.term.iscondition && plot.term2 && plot.term2.id == plot.term.id) return 'none'
        return plot.term.iscondition || (plot.term2 && plot.term2.iscondition) ? 'block' : 'none'
      }*/ else {
        const block = plot.term.iscondition || (plot.term2 && plot.term2.iscondition) ? 'block' : 'inline-block'
        return d.value != 'genotype' || plot.obj.modifier_ssid_barchart ? block : 'none'
      }
    })
  })
}

function setViewOpts(plot, main, table, arg) {
  const tr = table.append('tr')
  tr.append('td').html('Display mode').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-display-mode-' + plot.controlsIndex, 
    td, 
    [
      {label: 'Barchart', value: 'stacked'},
      {label: 'Table', value: 'table'},
      {label: 'Boxplot', value: 'boxplot'}
    ]
  )

  radio.inputs
  .property('checked', d => d.value == plot.term2_displaymode)
  .on('input', d => {
    plot.term2_displaymode = d.value
    plot.term2_boxplot = d.value == 'boxplot'
    main(plot)
  })

  plot.controls.push(() => {
    tr.style("display", plot.term2 ? "table-row" : "none")
    radio.inputs.property('checked', d => d.value == plot.term2_displaymode)
    radio.divs.style('display', d => plot.term2 && (d.value != 'boxplot' || plot.term2.isfloat) ? 'inline-block' : 'none')
  })
}

function setDivideByOpts(plot, main, table, arg) {
  const tr = table.append('tr')
  tr.append('td').html('Divide by').attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const radio = renderRadioInput(
    'pp-termdb-divide-by-' + plot.controlsIndex, 
    td, 
    [
      {label: 'None', value: 'none'},
      {label: 'Term', value: 'tree'},
      {label: 'Genotype', value: 'genotype'},
      {label: 'Max. grade per person', value: 'max_grade_perperson'},
      {label: 'Most recent grade', value: 'most_recent_grade'}
    ]
  )

  radio.inputs
  .property('checked', d => d.value == plot.settings.bar.divideBy)
  .on('input', d => {
    d3event.stopPropagation()
    plot.settings.bar.divideBy = d.value
    if (d.value == "none") {
      plot.term0 = undefined
      //plot.term2_displaymode = 'stacked'
      main(plot)
    } else if (d.value == "tree") {
      const obj = Object.assign({},plot.obj)
      delete obj.termfilter
      delete obj.termfilterdiv
      const _arg = {
        term1: arg.term,
        term2: plot.term2,
        obj,
        callback: term2=>{
          obj.tip.hide()
          plot.term0 = term2
          if (plot.term0.iscondition) { //!plot.settings.common.conditionParents[0]) {
            plot.settings.common.conditionParents[0] = plot.term0.id
            if (!plot.settings.common.conditionUnits[0]) {
              plot.settings.common.conditionUnits[0] = "max_grade_perperson"
            }
          }
          main(plot)
        }
      }
      showtree4selectterm( _arg, tr.node() )
    } else if (d.value == "genotype") {
      // to-do
    } else if (d.value == "by_children" || d.value == "max_grade_perperson" || d.value == "most_recent_grade") {
      if (!plot.term0) plot.term0 = plot.term
      plot.settings.common.conditionUnits[0] = d.value
      plot.settings.common.conditionParents[0] = plot.term0.id
      main(plot)
    }
  })

  radio.inputs.on('click', d => {
    d3event.stopPropagation()
    if (d.value != 'tree' || d.value != plot.settings.bar.divideBy) return
    const obj = Object.assign({},plot.obj)
    delete obj.termfilter
    delete obj.termfilterdiv
    const _arg = {
      term1: arg.term,
      term2: plot.term0,
      obj,
      callback: term2=>{
        obj.tip.hide()
        plot.term0 = term2
        main(plot)
      }
    }
    showtree4selectterm( _arg, tr.node() )
  })

  plot.controls.push(() => {
    // hide all options when opened from genome browser view 
    tr.style("display", plot.obj.modifier_ssid_barchart || plot.term2_displaymode != "stacked" ? "none" : "table-row")
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
        return plot.term1.iscondition || (plot.term0 && plot.term0.iscondition) ? 'block' : 'none'
      } else {
        const block = plot.term.iscondition || (plot.term0 && plot.term0.iscondition) ? 'block' : 'inline-block'
        return d.value != 'genotype' || plot.obj.modifier_ssid_barchart ? block : 'none'
      }
    })
  })
}

function setConditionUnitOpts(plot, main, table, termNum, label, index) {
  /**/
  const cu = plot.settings.common.conditionUnits
  const tr = table.append('tr')
  tr.append('td').html(label).attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const optionsSeed = [
    {label: "Subconditions", value: "by_children"}
  ]

  plot.controls.push(() => {
    const choices = plot[termNum]
        && plot[termNum].graph 
        && plot[termNum].graph.barchart 
        && plot[termNum].graph.barchart.value_choices 
        ? plot[termNum].graph.barchart.value_choices
      : plot.term.iscondition
        && plot.term.graph 
        && plot.term.graph.barchart 
        && plot.term.graph.barchart.value_choices 
      ? plot.term.graph.barchart.value_choices
      : []

    const radio = renderRadioInput(
      'pp-termdb-condition-unit-'+ index + '-' + plot.controlsIndex, 
      td,
      optionsSeed.concat( 
        choices
        .filter(d => d.max_grade_perperson || d.most_recent_grade)
        .map(d => {
          let value = d.max_grade_perperson 
            ? 'max_grade_perperson'
            : 'most_recent_grade'

          return {label: d.label, value}
        })
      )
    )

    radio.inputs
    .property('checked', d => d.value == cu[index])
    .on('input', d => {
      cu[index] = d.value
      plot.settings.common.conditionParents[index] = plot[termNum] ? plot[termNum].id : ''
      main(plot)
    })

    tr.style('display', plot[termNum] && plot[termNum].iscondition 
      ? "table-row" 
      : index == 2 && plot.term.iscondition 
      ? "table-row"
      : "none")

    radio.divs.style('display', d => {
      if (d.value == 'none') {
        return index == 1 ? 'none' : 'block'
      } else if (d.value == 'by_children') {
        return (plot[termNum] && !plot[termNum].isleaf) 
          && ((index == 1 && (!plot.term0 || cu[0] != 'by_children')) || (index == 0 && cu[1] != 'by_children'))
          ? 'block' : 'none'
      } else if (index != 1) {
        return cu[1] != d.value ? 'block' : 'none'
      } // return d.value != 'none' || !plot[termNum].isleaf ? 'block' : 'none'
    })

    radio.inputs.property('checked', d => cu[index] == d.value) 
  })
}

function setBinOpts(plot, main, table, termNum, label) {
  const tr = table.append('tr')
  
  tr.append('td').html(label).attr('class', 'sja-termdb-config-row-label')

  const bin_edit_td = tr.append('td')

  const bin_size_div = bin_edit_td.append('div')
    .html('Bin Size')

  const bin_size_btn = bin_size_div.append('div')
    .attr('class','sja_edit_btn')

  const first_bin_div = bin_edit_td.append('div')
    .html('First Bin')

  const first_bin_btn = first_bin_div.append('div')
    .attr('class','sja_edit_btn')

  const last_bin_div = bin_edit_td.append('div')
    .html('Last Bin')

  const last_bin_btn = last_bin_div.append('div')
    .attr('class','sja_edit_btn')

  let first_bin_range, last_bin_range, custom_bin_size, bin_term
  bin_term = plot.term
  
  update_btn()

  bin_size_btn.on('click', () => {
    bin_size_menu(plot, main, bin_size_btn, termNum.slice(-1), custom_bin_size)
  })

  first_bin_btn.on('click', () => {
    plot.tip.clear().showunder(first_bin_btn.node())
    edit_bin_menu(plot.tip,first_bin_range)
  })

  last_bin_btn.on('click', () => {
    plot.tip.clear().showunder(last_bin_btn.node())
    edit_bin_menu(plot.tip,last_bin_range)
  })

  tr.append('td')
    .style('text-decoration', 'underline')
    .style("cursor", "pointer")
    .html('edit ...')
    .on('click', () => {
      custom_bin(plot, main, termNum.slice(-1), tr.node())
    })

  plot.controls.push(() => {
    plot.term1 = plot.term
    tr.style('display', plot[termNum] && plot[termNum].isfloat ? 'table-row' : 'none')
    // update button from term2
    if(plot.term2 && termNum == 'term2'){ 
      bin_term = plot.term2
      update_btn()
    }
  })

  function update_btn(){
  
    if(bin_term.isfloat || bin_term.isinteger ){
      if(plot.custom_bins[termNum.slice(-1)]){
        bin_size_btn.text(plot.custom_bins[termNum.slice(-1)].size + ' ' + (bin_term.unit?bin_term.unit:''))
        first_bin_btn.text('EDIT')
        last_bin_btn.text('EDIT')

        //define first, last bin range and custom_bin
        // first_bin_range = { start : auto_bins.start_value , stop: (auto_bins.start_value + plot.custom_bins[termNum.slice(-1)].size)}
        // last_bin_range = { start: '', stop: ''}
        custom_bin_size = plot.custom_bins[termNum.slice(-1)]

      }else if(bin_term.graph.barchart.numeric_bin.auto_bins){
        const auto_bins = bin_term.graph.barchart.numeric_bin.auto_bins
        bin_size_btn.text(auto_bins.bin_size + ' ' + (bin_term.unit?bin_term.unit:''))
        first_bin_btn.text('EDIT')
        last_bin_btn.text('EDIT')
  
        //define first, last bin range and custom_bin
        first_bin_range = { start : auto_bins.start_value , stop: (auto_bins.start_value + auto_bins.bin_size)}
        last_bin_range = { start: '', stop: ''}
        custom_bin_size = { size: auto_bins.bin_size }
  
      }else if(bin_term.graph.barchart.numeric_bin.fixed_bins){
        const fixed_bins = bin_term.graph.barchart.numeric_bin.fixed_bins
        bin_size_btn.text('EDIT')
        first_bin_btn.text(fixed_bins[0].label + ' ' + (bin_term.unit?bin_term.unit:''))
        last_bin_btn.text(fixed_bins[fixed_bins.length-1].label + ' ' + (bin_term.unit?bin_term.unit:''))
        
        //define first, last bin range and custom_bin
        first_bin_range = fixed_bins[0]
        last_bin_range = fixed_bins[fixed_bins.length-1]
        custom_bin_size = { size: ''}
      }
    }
  }
}

function bin_size_menu(plot, main, btn, binNum=1, custom_bin_size){

  if(plot.custom_bins[binNum]) custom_bin_size = plot.custom_bins[binNum]
  
  let bin_term
  if (binNum == 1) bin_term = plot.term
  else bin_term = plot.term2

  const tip = plot.tip
  tip.clear().showunder(btn.node())
  tip.d.style('padding','0')

  const bin_size_div = tip.d.append('div')
    .style('display','block')
    .style('padding','3px 5px')

  const x = '<span style="font-family:Times;font-style:italic">x</span>'

  bin_size_div.append('div')
    .style('display','inline-block')
    .style('padding','3px 10px')
    .html('Bin Size')

  const bin_size_input = bin_size_div.append('input')
    .attr('type','number')
    .attr('value',custom_bin_size.size)
    .style('width','60px')
    .on('keyup', async ()=>{
      if(!client.keyupEnter()) return
      bin_size_input.property('disabled',true)
      apply()
      bin_size_input.property('disabled',false)
    })

  // select between start/stop inclusive
  const include_select = bin_size_div.append('select')
    .style('margin-left','10px')

  include_select.append('option')
  .attr('value','stopinclusive')
    .html('start &lt; ' + x + ' &le; end')
  include_select.append('option')
    .attr('value','startinclusive')
    .html('start &le; ' + x + ' &lt; end')

  include_select.node().selectedIndex =
    custom_bin_size.startinclusive ? 1 : 0 

  tip.d.append('div')
    .attr('class','sja_menuoption')
    .style('text-align','center')
    .text('APPLY')
    .on('click', ()=>{
      apply()
    })

  if(plot.custom_bins[binNum]){
    tip.d.append('div')
      .attr('class','sja_menuoption')
      .style('text-align','center')
      .html('RESET')
      .on('click', ()=>{
        plot.custom_bins[binNum] = null
        main(plot)
        plot.tip.hide()
        if(bin_term.graph.barchart.numeric_bin.auto_bins){
          const auto_bins = bin_term.graph.barchart.numeric_bin.auto_bins
          btn.text(auto_bins.bin_size + ' ' + (bin_term.unit?bin_term.unit:''))
        }else{
          btn.text('EDIT')
        }
      })
  }

  function apply(){
    plot.custom_bins[binNum] = {
      size: bin_size_input.node().value ? parseFloat(bin_size_input.node().value) : "auto",
      startinclusive: (include_select.node().value == 'startinclusive'),
      stopinclusive: (include_select.node().value == 'stopinclusive'),
      min_val: 'auto',
      min_unit: 'value',
      max_val: 'auto',
      max_unit: 'value'
    }
    main(plot)
    tip.hide()
    btn.text(plot.custom_bins[binNum].size + ' ' + (bin_term.unit?bin_term.unit:''))
  }

}

function edit_bin_menu(tip, range){

  tip.d.style('padding','0')

  const bin_edit_div = tip.d.append('div')
    .style('display','block')
    .style('padding','3px 5px')

  const start_input = bin_edit_div.append('input')
    .attr('type','number')
    .attr('value',range.start)
    .style('width','60px')
    .on('keyup', async ()=>{
      if(!client.keyupEnter()) return
      start_input.property('disabled',true)
      // await apply()
      start_input.property('disabled',false)
    })

  // to replace operator_start_div
  const startselect = bin_edit_div.append('select')
    .style('margin-left','10px')

  startselect.append('option')
    .html('&le;')
  startselect.append('option')
    .html('&lt;')
  startselect.append('option')
    .html('&#8734;')

  startselect.node().selectedIndex =
    range.startunbounded ? 2 :
    range.startinclusive ? 0 : 1

  const x = '<span style="font-family:Times;font-style:italic">x</span>'

  bin_edit_div.append('div')
    .style('display','inline-block')
    .style('padding','3px 10px')
    .html(x)

  // to replace operator_end_div
  const stopselect = bin_edit_div.append('select')
    .style('margin-right','10px')

  stopselect.append('option')
    .html('&le;')
  stopselect.append('option')
    .html('&lt;')
  stopselect.append('option')
    .html('&#8734;')

  stopselect.node().selectedIndex =
    range.stopunbounded ? 2 :
    range.stopinclusive ? 0 : 1
    
  const stop_input = bin_edit_div.append('input')
    .attr('type','number')
    .style('width','60px')
    .attr('value',range.stop)
    .on('keyup', async ()=>{
      if(!client.keyupEnter()) return
      stop_input.property('disabled',true)
      // await apply()
      stop_input.property('disabled',false)
    })

  tip.d.append('div')
    .attr('class','sja_menuoption')
    .style('text-align','center')
    .text('APPLY')
}

function custom_bin(plot, main, binNum=1, btn){
  plot.tip.clear().showunder(btn)

  const custom_bins = binNum in plot.custom_bins ? plot.custom_bins[binNum] : null
  const controls = plot.bin_controls[binNum]

  const custom_bin_div = plot.tip.d.append('div')
    .style('margin','10px 0px')
    .style('align-items','flex-start')
    .style('display','flex')

  // Bin Size
  const bin_size_div = custom_bin_div.append('div')
    .style('display','inline-block')
    .style('margin-left','25px')
    .style('margin-right','10px')
    .style('text-align','center')

  bin_size_div.append('div')
    .text('Bin Size')
    .style('padding-right','3px')
    .style('text-align','center')

  controls.custom_bin_size = bin_size_div.append('input')
    .style('margin-top','10px')
    .attr('size','8')
    .style('text-align','center')
    .property('value', custom_bins ? custom_bins.size : null)
    .attr('placeholder', 'auto')

  // uniform bin start_inclusive or stop_inclusive
  controls.bin_inclusion = bin_size_div.append('div')
    .append('select')
    .style('margin-top','10px')

  controls.bin_inclusion.append('option')
    .attr('value','start')
    .text('Start inclusive')
    .property('selected', custom_bins && custom_bins.startinclusive)

   controls.bin_inclusion.append('option')
    .attr('value','stop')
    .text('Stop inclusive')
    .property('selected', custom_bins && custom_bins.stopinclusive)

  // First Bin
  const first_bin_div = custom_bin_div.append('div')
    .style('display','inline-block')
    .style('margin-left','25px')
    .style('text-align','center')

  first_bin_div.append('div')
    .text('Minimum')
    .style('padding-right','3px')
    .style('text-align','center')

  const first_bin_input_div = first_bin_div.append('div')
    .style('margin-top','10px')
    .style('display','block')
    .style('white-space','nowrap')

  // comparison operator
  /*controls.first_bin_oper = first_bin_input_div.append('select')
    .property('selected', custom_bins && custom_bins.first_bin_oper == "lteq")
  controls.first_bin_oper.append('option')
    .attr('value', 'lt')
    .html('&lt;')
    .property('selected', custom_bins && custom_bins.first_bin_oper == "lt")
  controls.first_bin_oper.append('option')
    .attr('value', 'lteq')
    .html('&lt;=')*/

  // lower cutoff 
  controls.min_val = first_bin_input_div.append('input')
    .style('display','inline-block')
    .style('text-align','center')
    .attr('size','8')
    .attr('placeholder', 'auto')
    .property('value', !custom_bins 
      ? null
      : custom_bins.min_val == "auto"
      ? null
      : custom_bins.min_val)

  // cutoff unit
  controls.min_unit = first_bin_div.append('select')
    .style('margin-top','10px')

  controls.min_unit.append('option')
    .attr('value','value')
    .text('Value')
    .property('selected', custom_bins && custom_bins.min_unit == 'value' ? true : false)

  controls.min_unit.append('option')
    .attr('value','percentile')
    .text('Percentile')
    .property('selected', custom_bins && custom_bins.min_unit == 'percentile' ? true : false)

  // Last Bin
  const last_bin_div = custom_bin_div.append('div')
    .style('display','inline-block')
    .style('margin-left','25px')
    .style('margin-right','10px')
    .style('text-align','center')

  last_bin_div.append('div')
    .text('Maximum')
    .style('padding-right','3px')
    .style('text-align','center')

  const last_bin_input_div = last_bin_div.append('div')
    .style('margin-top','10px')
    .style('display','block')
    .style('white-space','nowrap')
  
  // comparison operator
  /*controls.last_bin_oper = last_bin_input_div.append('select')
  controls.last_bin_oper.append('option')
    .attr('value', 'gt')
    .html('&gt;')
    .property('selected', custom_bins && custom_bins.first_bin_oper == "gt")
  controls.last_bin_oper.append('option')
    .attr('value', 'gteq')
    .html('&gt;=')
    .property('selected', custom_bins && custom_bins.first_bin_oper == "gteq")*/

  // bin size
  controls.max_val = last_bin_input_div.append('input')
    .style('display','inline-block')
    .style('text-align','center')
    .attr('size','8')
    .attr('placeholder', 'auto')
    .property('value', !custom_bins 
      ? null
      : custom_bins.max_val == "auto"
      ? null
      : custom_bins.max_val)

  // cutoff unit
  controls.max_unit = last_bin_div.append('select')
    .style('margin-top','10px')

  controls.max_unit.append('option')
    .attr('value','value')
    .text('Value')
    .property('selected', custom_bins && custom_bins.max_unit == 'value' ? true : false)

  controls.max_unit.append('option')
    .attr('value','percentile')
    .text('Percentile')
    .property('selected', custom_bins && custom_bins.max_unit == 'percentile' ? true : false)

  // submit, reset buttons
  const btndiv = plot.tip.d.append('div')
    .style('text-align','center')
    
  btndiv.append('button')
    .html('Submit')
    .on('click', ()=>{
      const size = controls.custom_bin_size.property('value')
      const inclusive = controls.bin_inclusion.property('value')
      const startinclusive = inclusive == 'start'
      const stopinclusive = inclusive == 'stop'
      const min_val = controls.min_val.property('value')
      const min_unit = controls.min_unit.property('value')
      const max_val = controls.max_val.property('value')
      const max_unit = controls.max_unit.property('value')
      if (size !== "" && isNaN(size)) {
        alert('Invalid bin size.' + size)
      } else {
        //if (!min_val || !isNaN(min_val)) errs.push('Invalid first')
        plot.custom_bins[binNum] = {
          size: size ? +size : "auto",
          startinclusive,
          stopinclusive,
          min_val: min_val != '' && !isNaN(min_val) ? +min_val : 'auto',
          min_unit,
          max_val: max_val != '' && !isNaN(max_val) ? +max_val : 'auto',
          max_unit
        }
        main(plot)
        plot.tip.hide()
      }
    })

  btndiv.append('button')
    .html('Reset')
    .on('click', ()=>{
      plot.custom_bins[binNum] = null
      main(plot)
      plot.tip.hide()
    })

  btndiv.append('button')
    .html('Cancel')
    .on('click', ()=>{
      plot.tip.hide()
    })
}

export function bar_click_menu(obj, barclick, clickedBar) {
/*
  obj: the term tree obj
  barclick: function to handle option click
  clickedBar: the data associated with the clicked bar
*/
  const menu = obj.bar_click_menu
  const options = []
  if (menu.add_filter) {
    options.push({
      label: "Add as filter", 
      callback: menuoption_add_filter
    })
  }
  if (menu.select_group_add_to_cart) {
    options.push({
      label: "Select to GenomePaint",
      callback: menuoption_select_to_gp
    })
  }
  if (menu.select_to_gp) {
    options.push({
      label: "Add group to cart",
      callback: menuoption_select_group_add_to_cart
    })
  }
  if (options.length) {
    obj.tip.clear().d
      .selectAll('div')
      .data(options)
    .enter().append('div')
      .attr('class', 'sja_menuoption')
      .html(d=>d.label)
      .on('click', d => {
        barclick(clickedBar, d.callback, obj)
      })

    obj.tip.show(d3event.clientX, d3event.clientY)
  }
}
