import {select as d3select, event as d3event} from 'd3-selection'
import {
  menuoption_add_filter,
  menuoption_select_to_gp, 
  menuoption_select_group_add_to_cart
} from './mds.termdb'
import * as client from './client'
import {make_numeric_bin_btns} from './mds.termdb.termsetting.ui'

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
      {label: 'Subconditions', value: 'bar_by_children'},
      {label: 'Grade', value: 'bar_by_grade'}
    ]
  )

  const value_by_params = ['value_by_max_grade', 'value_by_most_recent', 'value_by_computable_grade']

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
  	  plot.obj.showtree4selectterm(
  	  	[arg.term.id, plot.term2 ? plot.term2.id : null],
  		  tr.node(),
        (term2) => {
  	      plot.obj.tip.hide()
          plot.term2 = term2
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
  	  )
    } else if (d.value == "genotype") {
      // to-do
      console.log('genotype overlay to be handled from term tree portal', d, d3event.target)
    } else if (d.value == "bar_by_children") {
      if (plot.term1_q.bar_by_children){
        console.log('bar_by_children term1 should not allow subcondition overlay')
        return
      }
      plot.term2 = plot.term
      delete plot.term2_q.bar_by_grade
      plot.term2_q.bar_by_children = 1
      for(const param of value_by_params) {
        delete plot.term2_q[param]
        if (plot.term1_q[param]) plot.term2_q[param] = 1
      }
      main(plot)
    } else if (d.value == "bar_by_grade") {
      if (plot.term1_q.bar_by_grade){
        console.log('bar_by_grade term1 should not allow grade overlay')
        return
      }
      plot.term2 = plot.term
      delete plot.term2_q.bar_by_children
      plot.term2_q.bar_by_grade = 1
      for(const param of value_by_params) {
        delete plot.term2_q[param]
        if (plot.term1_q[param]) plot.term2_q[param] = 1
      }
      main(plot)
    } else {
      console.log('unhandled click event', d, d3event.target)
    }
  })

  radio.inputs.on('click', d => {
    d3event.stopPropagation()
    if (d.value != 'tree' || d.value != plot.settings.bar.overlay) return
	plot.obj.showtree4selectterm(
	  [arg.term.id, plot.term2 ? plot.term2.id : null],
	  tr.node(),
      (term2)=>{
	    plot.obj.tip.hide()
        plot.term2 = term2
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
    )
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

    radio.divs.style('display', d => {
      if (d.value == "bar_by_children") {
        return plot.term.iscondition && !plot.term.isleaf && plot.term1_q.bar_by_grade ? 'block' : 'none'
      } else if (d.value == "bar_by_grade") {
        return plot.term.iscondition && !plot.term.isleaf && plot.term1_q.bar_by_children ? 'block' : 'none'
      } /*else {
        const block = plot.term.iscondition || (plot.term2 && plot.term2.iscondition) ? 'block' : 'inline-block'
        return d.value != 'genotype' || plot.obj.modifier_ssid_barchart ? block : 'none'
      }*/
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
  	  plot.obj.showtree4selectterm(
  	    [arg.term.id, plot.term2 ? plot.term2.id : null],
  		  tr.node(),
        (term0)=>{
  	      plot.obj.tip.hide()
          plot.term0 = term0
          main(plot)
        }
      )
    } else if (d.value == "genotype") {
      // to-do
    }
  })

  radio.inputs.on('click', d => {
  // don't know where is this used???
    d3event.stopPropagation()
    if (d.value != 'tree' || d.value != plot.settings.bar.divideBy) return
	plot.obj.showtree4selectterm(
	  [arg.term.id, plot.term0 ? plot.term0.id : null],
	  tr.node(),
      term0=>{
	    plot.obj.tip.hide()
        plot.term0 = term0
        main(plot)
      }
    )
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
  const tr = table.append('tr')
  tr.append('td').html(label).attr('class', 'sja-termdb-config-row-label')
  const td = tr.append('td')
  const options = [
    {label: "Subconditions, max grade", value: "bar_by_children + value_by_max_grade"},
    {label: "Subconditions, most recent", value: "bar_by_children + value_by_most_recent"},
    {label: "Subconditions, graded", value: "bar_by_children + value_by_computable_grade"},
    {label: "Max grade per patient", value: "bar_by_grade + value_by_max_grade"},
    {label: "Most recent grades per patient", value: "bar_by_grade + value_by_most_recent"}, 
    {label: "Grade per patient", value: "bar_by_grade + value_by_computable_grade"},
  ]

  const radio = renderRadioInput(
    'pp-termdb-condition-unit-'+ index + '-' + plot.controlsIndex, 
    td,
    options,
    null,
    'block'
  )

  const q = plot['term' + index + '_q']

  radio.inputs
    .property('checked', matchedParam)
    .on('input', d => {
      // clear existing parameter values
      delete q.value_by_max_grade
      delete q.value_by_most_recent
      delete q.value_by_computable_grade
      delete q.bar_by_children
      delete q.bar_by_grade

      for(const param of d.value.split(" + ")) {
        q[param] = 1
      }

      main(plot)
    })

  const matchedParam = d => {
    const params = d.value.split(" + ")
    let numMatched = 0
    for(const param of params) {
      if (q[param]) numMatched++
    }
    return numMatched == params.length
  }

  plot.controls.push(() => {
    radio.inputs.property('checked', matchedParam)

    tr.style('display', plot[termNum] && plot[termNum].iscondition 
      ? "table-row" 
      : index == 2 && plot.term.iscondition 
      ? "table-row"
      : "none")
    /*
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
    */
  })
}

function setBinOpts(plot, main, table, termNum, label) {
  const tr = table.append('tr')

  tr.append('td').html(label).attr('class', 'sja-termdb-config-row-label')

  const bin_edit_td = tr.append('td')

  bin_edit_td.append('div')
    .attr('class','sja_edit_btn')
    .html('EDIT')
    .on('click',()=>{
      // click to show ui and customize binning

      make_numeric_bin_btns(plot.tip, plot.term, plot.term1_q, (result)=>{
        plot.term1_q = result
        main(plot)
    })
  })

  //TODO: remove following code if not used
  plot.controls.push(() => {
    plot.term1 = plot.term
    tr.style('display', plot[termNum] && plot[termNum].isfloat ? 'table-row' : 'none')
  })
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
