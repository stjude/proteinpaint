import {event as d3event} from 'd3-selection'
import {may_trigger_crosstabulate} from './mds.termdb.crosstab'

export function controls(arg, plot, do_plot, update_plot) {
  plot.config_div = arg.holder.append('div')
    .style('display','inline-block')
    .style('vertical-align','top')
    .style('margin', '8px')
    .style('padding', '5px')

  plot.controls_update = () => {
    plot.controls.forEach(update => update())
  }

  // label
  plot.config_div.append('div')
    .style('color', '#aaa')
    .style('font-size', '12px')
    .style('cursor', 'pointer')
    .html('CONFIG')
    .on('click', () => {
      plot.controls.forEach(update => update())
      const display = tip.style('display')
      tip.style('display', display == "none" ? "inline-block" : "none")
      plot.config_div.style('background', display == "none" ? '#ececec' : "")
    })

  const tip = plot.config_div.append('div').style("display","none")
  // will be used to track control elements
  // for contextual updates
  plot.controls = []
  const table = tip.append('table')
  setOverlayOpts(plot, do_plot, update_plot, table, arg)
  setViewOpts(plot, update_plot, table)
  setOrientationOpts(plot, do_plot, table)
  setScaleOpts(plot, do_plot, table)
  setBinOpts(plot, do_plot, table, 'term1', 'Primary Bins')
  setBinOpts(plot, do_plot, table, 'term2', 'Stacked Bins')
}

function setOrientationOpts(plot, do_plot, table) {
  const tr = table.append('tr')
  
  tr.append('td')
    .html('Orientation')

  const orientation = tr.append('td')
    .append('select')
    .on('change', () => {
      plot.settings.bar.orientation = orientation.property('value')
      do_plot(plot)
    })

  orientation.append('option')
    .attr('value', 'vertical')
    .property('selected', plot.settings.bar.orientation == "vertical")
    .html('Vertical')

  orientation.append('option')
    .attr('value', 'horizontal')
    .property('selected', plot.settings.bar.orientation == "horizontal")
    .html('Horizontal')

  plot.controls.push(() => {
    tr.style('display', plot.term2_displaymode == "stacked" ? "table-row" : "none")
  })
}

function setScaleOpts(plot, do_plot, table) {
  const tr = table.append('tr')

  tr.append('td')
    .html('Scale')

  const unit = tr.append('td')
    .append('select')
    .on('change', () => {
      plot.settings.bar.unit = unit.property('value')
      do_plot(plot)
    })

  const abs = unit.append('option')
    .attr('value', 'abs')
    .property('selected', plot.settings.bar.unit == "abs")
    .html('Linear')

  const log = unit.append('option')
    .attr('value', 'log')
    .property('selected', plot.settings.bar.unit == "log")
    .html('Log')

  const pct = unit.append('option')
    .attr('value', 'pct')
    .property('selected', plot.settings.bar.unit == "pct")
    .html('Percentage')

  plot.controls.push(() => {
    tr.style('display', plot.term2_displaymode == "stacked" ? "table-row" : "none")
    log.property('disabled', plot.term2 ? true : false)
    pct.property('disabled', plot.term2 ? false : true)
  })
}

function setOverlayOpts(plot, do_plot, update_plot, table, arg) {
  const tr = table.append('tr')
  
  tr.append('td')
    .html('Overlay with')

  const td = tr.append('td')
  
  const overlay = td.append('select')
    .on('change', () => {
      const value = overlay.property('value')
      plot.settings.bar.overlay = value
      if (value == "none") {
        plot.term2 = undefined
        plot.term2_displaymode = 'stacked'
        do_plot(plot)
      } else if (value == "tree") {
        const _arg = {
          term1: arg.term,
          obj: plot.obj,
          callback: result=>{
            // adding term2 for the first time
            plot.term2 = result.term2
            // update the plot data using the server-returned new data
            plot.items = result.items
            if (plot.term2.isfloat && plot.term2_boxplot){ 
              plot.term2_displaymode = 'boxplot'
              update_plot(plot)
            }else{
              plot.term2_boxplot = 0
              do_plot( plot )
            }
          }
        }
        may_trigger_crosstabulate( _arg, tr.node() )
      } else if (value == "genotype") {
        // to-do
      }
    })

  overlay.append('option')
    .attr('value', 'none')
    .property('selected', plot.settings.bar.overlay == "none")
    .html('None')

 overlay.append('option')
    .attr('value', 'tree')
    .property('selected', plot.settings.bar.overlay == "tree")
    .html('Second term')

  const genotype = overlay.append('option')
    .attr('value', 'genotype')
    .property('selected', plot.settings.bar.overlay == "genotype")
    .html('Genotype')

  td.append('span').html('&nbsp;') 
  const editbtn = td.append('span')  
    .attr('class', 'crosstab-btn')
    .html('replace')
    .style('cursor', 'pointer')
    .style('text-decoration', 'underline')
    .on('click', () =>{
      const _arg = {
        term1: arg.term,
        obj: plot.obj,
        callback: result=>{
          // replacing term2
          plot.term2 = result.term2
          // update the plot data using the server-returned new data
          plot.items = result.items
          if (plot.term2.isfloat && plot.term2_boxplot){ 
            plot.term2_displaymode = 'boxplot'
            update_plot(plot)
          }else{
            plot.term2_boxplot = 0
            do_plot( plot )
          }
        }
      }
      may_trigger_crosstabulate( _arg, tr.node() )
    })

  plot.controls.push(() => {
    // hide all options when opened from genome browser view 
    tr.style("display", plot.obj.modifier_ssid_barchart ? "none" : "table-row")
    editbtn.style("display", plot.settings.bar.overlay == "tree" ? "inline" : "none")
    // do not show genoetype overlay option when opened from stand-alone page
    if (!plot.settings.bar.overlay) {
      plot.settings.bar.overlay = plot.obj.modifier_ssid_barchart
        ? 'genotype'
        : plot.term2 
        ? 'tree'
        : 'none'
    }
    overlay.property('value', plot.settings.bar.overlay)
    genotype.style('display', plot.obj.modifier_ssid_barchart ? 'block' : 'none')
  })
}

function setViewOpts(plot, update_plot, table, arg) {
  const tr = table.append('tr')

  tr.append('td')
    .html('Overlay view')
  
  const view = tr.append('td')
    .append('select')
    .on('change', () => {
      const value = view.property('value')
      plot.term2_displaymode = value
      plot.term2_boxplot = value == 'boxplot'
      update_plot(plot)
    })

  view.append('option')
    .attr('value', 'stacked')
    .property('selected', plot.term2_displaymode == "stacked")
    .html('Stacked Bars')

  view.append('option')
    .attr('value', 'table')
    .property('selected', plot.term2_displaymode == "table")
    .html('Table')

  const boxplot = view.append('option')
    .attr('value', 'boxplot')
    .property('selected', plot.term2_displaymode == "boxplot")
    .html('Boxplot')

  plot.controls.push(() => {
    tr.style("display", plot.term2 ? "table-row" : "none")
    view.property('value', plot.term2_displaymode)
    boxplot.style('display', plot.term2 && plot.term2.isfloat ? 'block' : 'none')
  })
}

function setBinOpts(plot, do_plot, table, termNum, label) {
  const tr = table.append('tr')
  
  tr.append('td')
    .html(label)

  tr.append('td')
    .style('text-decoration', 'underline')
    .style("cursor", "pointer")
    .html('edit ...')
    .on('click', () => {
      custom_bin(plot, do_plot, termNum.slice(-1), tr.node())
    })

  plot.controls.push(() => {
    plot.term1 = plot.term
    tr.style('display', plot[termNum] && plot[termNum].isfloat ? 'table-row' : 'none')
  })
}

function custom_bin(plot, do_plot, binNum=1, btn){
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
        do_plot(plot)
        plot.tip.hide()
      }
    })

  btndiv.append('button')
    .html('Reset')
    .on('click', ()=>{
      plot.custom_bins[binNum] = null
      do_plot(plot)
      plot.tip.hide()
    })

  btndiv.append('button')
    .html('Cancel')
    .on('click', ()=>{
      plot.tip.hide()
    })
}
