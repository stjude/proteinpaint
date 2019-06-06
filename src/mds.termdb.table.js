import {get_table_data} from './mds.termdb.barchart'

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
    main(plot, isVisible) {
      if (!isVisible) {
        self.dom.div.style('display','none')
        return
      }
      if( !plot.term2 ) {
        throw 'term2 is required for table view'
      }
      render(self, plot)
    }
  }
  return self
}


export function render (self, plot) {
  self.dom.div
    .style('display','inline-block')
  .selectAll('*')
    .remove()

  get_table_data(plot)
  .then(data => {
    const {column_keys, rows} = data
    
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
  })
}
