import {Menu} from './client'
import {event as d3event} from 'd3-selection'
import {may_trigger_crosstabulate} from './mds.termdb.crosstab'

export function controls(arg, plot, do_plot, update_plot) {
  const tip = new Menu({padding:'18px'})

  plot.config_div = arg.holder.append('div')
    .style('position', 'absolute')
    .style('right', '5px')
    .style('color', '#aaa')
    .style('font-size', '12px')
    .style('cursor', 'pointer')
    .html('CONFIG')
    .on('click',()=>{
      plot.controls.forEach(update => update())
      tip.showunder(plot.config_div.node(), 0)
    })

  // will be used to track control elements
  // for contextual updates
  plot.controls = []
  const table = tip.d.append('table')
  setOrientationOpts(tip, plot, do_plot, table)
  setScaleOpts(tip, plot, do_plot, table)
  setBinOpts(tip, plot, do_plot, table, 'term1', 'Primary Bins')
  setOverlayOpts(tip, plot, do_plot, table, arg)
  setViewOpts(tip, plot, update_plot, table)
  setBinOpts(tip, plot, do_plot, table, 'term2', 'Stacked Bins')
}

function setOrientationOpts(tip, plot, do_plot, table) {
  const tr = table.append('tr')
  
  tr.append('td')
    .html('Orientation')

  const orientation = tr.append('td')
    .append('select')
    .on('change', () => {
      plot.bar_settings.orientation = orientation.property('value')
      do_plot(plot)
      tip.hide()
    })

  orientation.append('option')
    .attr('value', 'vertical')
    .property('selected', plot.bar_settings.orientation == "vertical")
    .html('Vertical')

  orientation.append('option')
    .attr('value', 'horizontal')
    .property('selected', plot.bar_settings.orientation == "horizontal")
    .html('Horizontal')
}

function setScaleOpts(tip, plot, do_plot, table) {
  const tr = table.append('tr')

  tr.append('td')
    .html('Scale')

  const unit = tr.append('td')
    .append('select')
    .on('change', () => {
      plot.bar_settings.unit = unit.property('value')
      do_plot(plot)
      tip.hide()
    })

  const abs = unit.append('option')
    .attr('value', 'abs')
    .property('selected', plot.bar_settings.unit == "abs")
    .html('Linear')

  const log = unit.append('option')
    .attr('value', 'log')
    .property('selected', plot.bar_settings.unit == "log")
    .html('Log')

  const pct = unit.append('option')
    .attr('value', 'pct')
    .property('selected', plot.bar_settings.unit == "pct")
    .html('Percentage')

  plot.controls.push(() => {
    log.property('disabled', plot.term2 ? true : false)
    pct.property('disabled', plot.term2 ? false : true)
  })
}

function setOverlayOpts(tip, plot, do_plot, table, arg) {
  const tr = table.append('tr')
  
  tr.append('td')
    .html('Overlay with')

  const td = tr.append('td')
  
  const overlay = td.append('select')
    .on('change', () => {
      const value = overlay.property('value')
      plot.bar_settings.overlay = value
      if (value == "none") {
        plot.term2 = undefined
        plot.term2_displaymode = 'stacked'
        do_plot(plot)
        tip.hide()
      } else if (value == "tree") {
        const _arg = {
          term1: arg.term,
          button_row: plot.term2_border_div,
          obj: plot.obj,
          callback: result=>{
            // either adding term2 for the first time or replacing term2
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

            tip.hide()
          }
        }
        may_trigger_crosstabulate( _arg, tr.node() )
      } else if (value == "genotype") {
        // to-do
      }
    })

  overlay.append('option')
    .attr('value', 'none')
    .property('selected', plot.bar_settings.overlay == "none")
    .html('None')

 overlay.append('option')
    .attr('value', 'tree')
    .property('selected', plot.bar_settings.overlay == "tree")
    .html('Second term')

  const genotype = overlay.append('option')
    .attr('value', 'genotype')
    .property('selected', plot.bar_settings.overlay == "genotype")
    .html('Genotype')

  td.append('span').html('&nbsp;') 
  const edit = td.append('span')  
    .html('change')
    .style('cursor', 'pointer')
    .style('text-decoration', 'underline')
    .on('click', () =>{
      const _arg = {
        term1: arg.term,
        button_row: plot.term2_border_div,
        obj: plot.obj,
        callback: result=>{
          // either adding term2 for the first time or replacing term2
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

          tip.hide()
        }
      }
      may_trigger_crosstabulate( _arg, tr.node() )
    })

  plot.controls.push(() => {
    // hide all options when opened from genome browser view 
    tr.style("display", plot.obj.modifier_ssid_barchart ? "none" : "table-row")
    edit.style("display", plot.bar_settings.overlay == "tree" ? "inline" : "none")
    // do not show genoetype overlay option when opened from stand-alone page
    if (!plot.bar_settings.overlay) {
      plot.bar_settings.overlay = plot.obj.modifier_ssid_barchart
        ? 'genotype'
        : plot.term2 
        ? 'tree'
        : 'none'
    }
    overlay.property('value', plot.bar_settings.overlay)
    genotype.style('display', plot.obj.modifier_ssid_barchart ? 'block' : 'none')
  })
}

function setViewOpts(tip, plot, update_plot, table, arg) {
  const tr = table.append('tr')

  tr.append('td')
    .html('Overlay view')
  
  const view = tr.append('td')
    .append('select')
    .on('change', () => {
      const value = view.property('value')
      plot.term2_displaymode = value
      if (value  == 'table'){
        plot.term2_boxplot = 0
        plot.table_div.style('display','block')
        update_plot(plot)
      }else if(value == 'stacked'){
        plot.term2_boxplot = 0
        plot.table_div.style('display','none')
        plot.svg.style('display','block')
        plot.legend_div.style('display','block')
        if(plot.boxplot_div){
          plot.boxplot_div.style('display','block')
        }
        update_plot(plot)
      }
      // if 'boxplot' selected - query server for data
      else if(value == 'boxplot'){
        plot.term2_boxplot = 1
        plot.table_div.style('display','none')
        plot.svg.style('display','block')
        plot.legend_div.style('display','none')
        update_plot(plot)
      }
      tip.hide()
    })

  view.append('option')
    .attr('value', 'stacked')
    .property('selected', plot.term2_displaymode == "stacked")
    .html('Stacked')

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

function setBinOpts(tip, plot, do_plot, table, termNum, label) {
  const tr = table.append('tr')
  
  tr.append('td')
    .html(label)

  tr.append('td')
    .style('text-decoration', 'underline')
    .style("cursor", "pointer")
    .html('edit ...')
    .on('click', () => {
      custom_bin(tip, plot, do_plot, termNum.slice(-1), tr.node())
    })

  plot.controls.push(() => {
    plot.term1 = plot.term
    tr.style('display', plot[termNum] && plot[termNum].isfloat ? 'table-row' : 'none')
  })
}

function custom_bin(tip, plot, do_plot, binNum=1, btn){
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
        tip.hide()
      }
    })

  btndiv.append('button')
    .html('Reset')
    .on('click', ()=>{
      plot.custom_bins[binNum] = null
      do_plot(plot)
      plot.tip.hide()
      tip.hide()
    })

  btndiv.append('button')
    .html('Cancel')
    .on('click', ()=>{
      plot.tip.hide()
      tip.hide()
    })
}
