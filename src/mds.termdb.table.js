import {custom_table_data} from './mds.termdb.barchart'

export function may_make_table (plot) {
  if (plot.term2_displaymode != 'table') {
    plot.table_div.style('display','none')
    return
  } 
  if( !plot.term2 ) throw 'term2 is required for table view'

  plot.bar_div.style('display','none')
  plot.box_svg.style('display','none')
  plot.legend_div.style('display','none')
  plot.table_div.style('display','inline-block')
  plot.stat_div.style('display','none')

  plot.table_div.selectAll('*').remove()
  const table_data = plot.custom_bins["1"] || plot.custom_bins["2"]
    ? custom_table_data
    : default_table_data

  table_data(plot)
  .then(data => {
    const {column_keys, rows} = data
    
    // show table
    const table = plot.table_div.append('table')
    .style('margin-top','20px')
    .style('border-spacing','3px')
    .style('border-collapse','collapse')
    .style('border', '1px solid black')

    // header
    const tr = table.append('tr')
    tr.append('td') // column 1
    // print term2 values as rest of columns
    for(const i of column_keys) {
      tr.append('th')
        .text( i )
        .style('border', '1px solid black')
        .style('padding', '3px')
        .style('text-align', 'center')
    }

    for(const t1v of rows) {
      const tr = table.append('tr')

      // column 1
      tr.append('th')
        .text( t1v.label )
        .style('border', '1px solid black')
        .style('padding', '3px')

      // other columns
      for(const t2label of column_keys) {
        const td = tr.append('td')
          .style('border', '1px solid black')
          .style('padding', '3px')
          .style('text-align', 'right')
        const v = t1v.lst.find( i=> i.label == t2label )
        if( v ) {
          td.text( v.value )
        }
      }
    }
  })
}


function default_table_data(plot) {
  let column_keys = []
  if(plot.term2 && plot.term2.graph.barchart.order ) {
    column_keys = plot.term2.graph.barchart.order
  } else {

    // no predefined order, get unique values from data
    const term2values = new Set()
    for(const t1v of plot.items) {
      for(const j of t1v.lst) {
        term2values.add( j.label )
      }
    }
    for(const s of term2values) {
      column_keys.push( s )
    }
  }

  // rows are term1 values
  let rows = []
  // order of rows maybe predefined
  if( plot.term.graph && plot.term.graph.barchart && plot.term.graph.barchart.order ) {
    for(const v of plot.term.graph.barchart.order ) {
      const i = plot.items.find( i=> i.label == v )
      if( i ) {
        rows.push( i )
      }
    }
  } else {
    rows = plot.items
  }

  return Promise.resolve({column_keys, rows})
}