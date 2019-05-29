import font from './client'

export function may_make_stattable(plot) {
  //plot.boxplot = plot.term2 && plot.term2.isfloat && plot.term2_boxplot ? 1 : 0
  if (!plot.boxplot) {
    plot.stat_div.style("display", "none")
    return
  }
  plot.stat_div.style("display", "block")
  const x = plot.yaxis_width+ plot.barspace + plot.barwidth/2
  const max_label_height = get_max_labelheight( plot )
  // table for statistical summary
  plot.stat_div
  .attr('transform','translate('+x+','+(plot.toppad + plot.barheight + max_label_height)+')')
  .selectAll('*')
  .remove()

  let exposed_data = ''

  if(plot.unannotated){
    exposed_data = '<tr><td colspan="2">Among All Patients</td></tr>'
    + '<tr><td>'+ plot.unannotated.label_annotated +'</td><td>'+ plot.unannotated.value_annotated +'</td></tr>'
    + '<tr><td>'+ plot.unannotated.label +'</td><td>'+ plot.unannotated.value +'</td></tr>'
    + '<tr><td colspan="2">Among Patients treated</td></tr>'
  }

  const stat_div = plot.stat_div
    .html(
      '<table><tr><th></th><th>Value</th></tr>'
      + exposed_data
      + '<tr><td>Mean (SD)</td><td>'+ plot.boxplot.mean.toFixed(2) + ' (' + plot.boxplot.sd.toFixed(2) +') </td></tr>'
      + '<tr><td>Median (IQR)</td><td>'+ plot.boxplot.p50.toFixed(2) + ' (' + plot.boxplot.iqr.toFixed(2) +') </td></tr>'
      + '<tr><td>5th Percentile</td><td>'+ plot.boxplot.p05.toFixed(2) +'</td></tr>'
      + '<tr><td>25th Percentile</td><td>'+ plot.boxplot.p25.toFixed(2) +'</td></tr>'
      + '<tr><td>75th Percentile</td><td>'+ plot.boxplot.p75.toFixed(2) +'</td></tr>'
      + '<tr><td>95th Percentile</td><td>'+ plot.boxplot.p95.toFixed(2) +'</td></tr>'
      + '</table>'
    )

  stat_div.selectAll('td, th, table')
    .style('border', '1px solid black')
    .style('padding', '0')
    .style('border-collapse', 'collapse')

  stat_div.selectAll('th, td')
    .style('padding', '2px 10px')
}


function get_max_labelheight ( plot ) {
  let textwidth = 0
  for(const i of plot.items) {
    plot.box_svg.append('text')
      .text( i.label )
      .attr('font-family', font)
      .attr('font-size', plot.label_fontsize)
      .each( function() {
        textwidth = Math.max( textwidth, this.getBBox().width )
      })
      .remove()
  }

  return textwidth
}


