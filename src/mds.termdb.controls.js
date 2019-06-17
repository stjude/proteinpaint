import {select as d3select, event as d3event} from 'd3-selection'
import {
  showtree4selectterm, 
  menuoption_add_filter,
  menuoption_select_to_gp, 
  menuoption_select_group_add_to_cart
} from './mds.termdb'

// used to track controls unique "instances" by plot object
// to be used to disambiguate between input names
const plots = []

export function controls(arg, plot, main) {
  plot.config_div = arg.holder.append('div')
    .style('display','inline-block')
    .style('vertical-align','top')
    .style('margin', '8px')
    .style('padding', '10px 15px 15px 15px')

  // controlsIndex to be used to assign unique radio input names
  // by config div
  plot.controlsIndex = plots.length
  plots.push(plot)

  // label
  plot.config_div.append('div').append('button')
    .style('color', '#333')
    .style('font-size', '14px')
    .style('cursor', 'pointer')
    .html('CONFIG')
    .on('click', () => {
      plot.controls.forEach(update => update())
      const display = tip.style('display')
      tip.style('display', display == "none" ? "inline-block" : "none")
      plot.config_div.style('background', display == "none" ? 'rgb(245,245,220)' : "")
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
    .style('background-color', i%2 == 0 ? '' : '#eee')
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
      {label: 'Max. grade per person', value: 'max_grade_perperson'},
      {label: 'Most recent grade', value: 'most_recent_grade'}
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
    } else if (d.value == "max_grade_perperson" || d.value == "most_recent_grade") {
      if (!plot.term2) plot.term2 = plot.term
      plot.settings.common.conditionUnits[2] = d.value
      plot.settings.common.conditionParents[2] = plot.term2.id
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
      if (d.value == "max_grade_perperson" || d.value == "most_recent_grade") {
        return plot.term.iscondition || (plot.term2 && plot.term2.iscondition) ? 'block' : 'none'
      } else {
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

  // First Bin
  const first_bin_div = custom_bin_div.append('div')
    .style('display','inline-block')
    .style('margin-left','25px')
    .style('text-align','center')

  first_bin_div.append('div')
    .text('First Bin')
    .style('padding-right','3px')
    .style('text-align','center')

  const first_bin_input_div = first_bin_div.append('div')
    .style('margin-top','10px')
    .style('display','block')
    .style('white-space','nowrap')
  
  controls.first_bin_oper = first_bin_input_div.append('select')
    .property('selected', custom_bins && custom_bins.first_bin_oper == "lteq")
  controls.first_bin_oper.append('option')
    .attr('value', 'lt')
    .html('&lt;')
    .property('selected', custom_bins && custom_bins.first_bin_oper == "lt")
  controls.first_bin_oper.append('option')
    .attr('value', 'lteq')
    .html('&lt;=')

  controls.first_bin_size = first_bin_input_div.append('input')
    .style('display','inline-block')
    .style('margin-left','5px')
    .attr('size','8')
    .attr('placeholder', 'auto')
    .property('value', !custom_bins 
      ? null
      : custom_bins.first_bin_size == "auto"
      ? null
      : custom_bins.first_bin_size)

  controls.first_bin_options = first_bin_div.append('select')
    .style('margin-top','10px')

  controls.first_bin_options.append('option')
    .attr('value','value')
    .text('Value')
    .property('selected', custom_bins && custom_bins.first_bin_option == 'value' ? true : false)

  controls.first_bin_options.append('option')
    .attr('value','percentile')
    .text('Percentile')
    .property('selected', custom_bins && custom_bins.first_bin_option == 'percentile' ? true : false)

  // Bin Size
  const bin_size_div = custom_bin_div.append('div')
    .style('display','inline-block')
    .style('margin-left','25px')
    .style('margin-right','10px')

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

  // Last Bin
  const last_bin_div = custom_bin_div.append('div')
    .style('display','inline-block')
    .style('margin-left','25px')
    .style('margin-right','10px')
    .style('text-align','center')

  last_bin_div.append('div')
    .text('Last Bin')
    .style('padding-right','3px')
    .style('text-align','center')

  const last_bin_input_div = last_bin_div.append('div')
    .style('margin-top','10px')
    .style('display','block')
    .style('white-space','nowrap')
  
  controls.last_bin_oper = last_bin_input_div.append('select')
  controls.last_bin_oper.append('option')
    .attr('value', 'gt')
    .html('&gt;')
    .property('selected', custom_bins && custom_bins.first_bin_oper == "gt")
  controls.last_bin_oper.append('option')
    .attr('value', 'gteq')
    .html('&gt;=')
    .property('selected', custom_bins && custom_bins.first_bin_oper == "gteq")

  controls.last_bin_size = last_bin_input_div.append('input')
    .style('display','inline-block')
    .style('margin-left','5px')
    .attr('size','8')
    .attr('placeholder', 'auto')
    .property('value', !custom_bins 
      ? null
      : custom_bins.last_bin_size == "auto"
      ? null
      : custom_bins.last_bin_size)

  controls.last_bin_options = last_bin_div.append('select')
    .style('margin-top','10px')

  controls.last_bin_options.append('option')
    .attr('value','value')
    .text('Value')
    .property('selected', custom_bins && custom_bins.last_bin_option == 'value' ? true : false)

  controls.last_bin_options.append('option')
    .attr('value','percentile')
    .text('Percentile')
    .property('selected', custom_bins && custom_bins.last_bin_option == 'percentile' ? true : false)

  // submit, reset buttons
  const btndiv = plot.tip.d.append('div')
    .style('text-align','center')
    
  btndiv.append('button')
    .html('Submit')
    .on('click', ()=>{
      const size = controls.custom_bin_size.property('value')
      const first_bin_size = controls.first_bin_size.property('value')
      const first_bin_option = controls.first_bin_options.property('value')
      const first_bin_oper = controls.first_bin_oper.property('value')
      const last_bin_size = controls.last_bin_size.property('value')
      const last_bin_option = controls.last_bin_options.property('value')
      const last_bin_oper = controls.last_bin_oper.property('value')
      if (size !== "" && isNaN(size)) {
        alert('Invalid bin size.' + size)
      } else {
        //if (!first_bin_size || !isNaN(first_bin_size)) errs.push('Invalid first')
        plot.custom_bins[binNum] = {
          size: size ? +size : "auto",
          first_bin_size: first_bin_size != '' && !isNaN(first_bin_size) ? +first_bin_size : 'auto',
          first_bin_option,
          first_bin_oper,
          last_bin_size: last_bin_size != '' && !isNaN(last_bin_size) ? +last_bin_size : 'auto',
          last_bin_option,
          last_bin_oper
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

export function bar_click_menu(obj, menu, terms, barBins, clickedBar) {
  let options = []
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
      .on('click', d=>{
        const termValues = []
        for(const index of [0,1,2]) {
          const termNum = 'term' + index
          const term = terms[termNum]
          const bins = !barBins ? [] : barBins[index];
          const key = termNum=="term1" ? clickedBar.seriesId : clickedBar.dataId
          const label = !term || !term.values 
            ? key
            : termNum=="term1"
              ? term.values[clickedBar.seriesId].label
              : term.values[clickedBar.dataId].label

          if (termNum != 'term0' && term) {
            const range = !bins ? null : bins.find(d => d.label == label)
            if (range) {
              termValues.push({term, range})
            } else {
              termValues.push({term, values: [{key, label}]})
            }
          }
        } console.log(termValues, d.callback)
        d.callback(obj, termValues)
        obj.tip.hide()
      })
      
    obj.tip.show(event.clientX, event.clientY)
  }
}
