// init is similar to a Class constructor
// in that it returns an object "instance"
export function init(holder) {
/*
  holder: a d3 selection
*/
  const self = {
    dom: {
      div: holder.append('div').style('margin','10px 0px')
    },
    // main() remembers the self "instance" via closure
    // so that self does not need to be passed to it
    // as an argument
    main(plot, data, isVisible) {
      if (!isVisible) {
        self.dom.div.style('display','none')
        return
      }
      if( !plot.term2 ) {
        throw 'term2 is required for table view'
      }
      processData(self, data)
    }
  }
  return self
}

function processData(self, data) {
  const column_keys = data.refs.rows
  const rows = data.refs.cols.map(t1 => {
    return {
      label: t1,
      lst: data.charts[0].serieses
        .find(d => d.seriesId == t1)
        .data.slice()
        .sort((a,b) => column_keys.indexOf(a.dataId) - column_keys.indexOf(b.dataId))
        .map(d => {
          return {
            label: d.dataId,
            value: d.total
          }
        })
    }
  })
  render(self, column_keys, rows)
}

export function render(self, column_keys, rows) {
  self.dom.div
    .style('display','inline-block')
  .selectAll('*')
    .remove()
  
  // show table
  const table = self.dom.div.append('table')
  //.style('margin-top','20px')
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
}
