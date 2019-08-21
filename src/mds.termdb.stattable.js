// init is similar to a Class constructor
// in that it returns an object "instance"
export function init(holder) {
/*
  holder: a d3 selection
*/
  const self = {
    dom: {
      div: holder.append('div').style('margin','10px')
    },
    // main() remembers the self "instance" via closure
    // so that self does not need to be passed to it
    // as an argument
    main(plot, data) {
      const isVisible = plot.settings.currViews.includes("stattable")
      if (!isVisible) {
        self.dom.div.style('display','none')
        return
      }
      processData(self, plot, data)
    }
  }
  return self
}

function processData(self, plot, data) {
  render(self, plot, data)
}

export function render(self, plot, data) {
  // table for statistical summary
  self.dom.div
    .style("display", "block")
  .selectAll('*')
    .remove()

  let exposed_data = ''

  if(plot.unannotated){
    exposed_data = '<tr><td colspan="2">Among All Patients</td></tr>'
    + '<tr><td>'+ plot.unannotated.label_annotated +'</td><td>'+ plot.unannotated.value_annotated +'</td></tr>'
    + '<tr><td>'+ plot.unannotated.label +'</td><td>'+ plot.unannotated.value +'</td></tr>'
    + '<tr><td colspan="2">Among Patients treated</td></tr>'
  }

  let rows = '<tr><td>Mean (SD)</td><td>'+ data.boxplot.mean.toFixed(2) + ' (' + data.boxplot.sd.toFixed(2) +') </td></tr>'
  if (data.boxplot.p50) {
    rows += '<tr><td>Median (IQR)</td><td>'+ data.boxplot.p50.toFixed(2) + ' (' + data.boxplot.iqr.toFixed(2) +') </td></tr>'
      + '<tr><td>5th Percentile</td><td>'+ data.boxplot.p05.toFixed(2) +'</td></tr>'
      + '<tr><td>25th Percentile</td><td>'+ data.boxplot.p25.toFixed(2) +'</td></tr>'
      + '<tr><td>75th Percentile</td><td>'+ data.boxplot.p75.toFixed(2) +'</td></tr>'
      + '<tr><td>95th Percentile</td><td>'+ data.boxplot.p95.toFixed(2) +'</td></tr>'
  }

  self.dom.div.html(
    '<table><tr><th></th><th>Value</th></tr>'
    + exposed_data
    + rows
    + '</table>'
  )

  self.dom.div.selectAll('td, th, table')
    .style('border', '1px solid black')
    .style('padding', '0')
    .style('border-collapse', 'collapse')

  self.dom.div.selectAll('th, td')
    .style('padding', '2px 10px')
}
