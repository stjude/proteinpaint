import * as client from "./client"
import {event as d3event} from "d3-selection"
import {scaleLinear, scaleLog, scaleOrdinal, schemeCategory10, schemeCategory20 } from "d3-scale"
import {format as d3format} from 'd3-format'
import {axisLeft} from "d3-axis"

// init is similar to a Class constructor
// in that it returns an object "instance"
export function init(holder) {
/*
  holder: a d3 selection
*/
  const svg = holder.append('svg')
  const self = {
    dom: {
      svg,
      yaxis_g: svg.append('g'), // for y axis
      graph_g: svg.append('g') // for bar and label of each data item
    },
    // main() remembers the self "instance" via closure
    // so that self does not need to be passed to it
    // as an argument
    main(plot, data, isVisible) {
      if (!isVisible) {
        self.dom.svg.style('display','none')
        return
      }
      processData(self, plot, data)
    }
  }
  return self
}

function processData(self, plot, data) {
  const column_keys = data.refs.rows
  let binmax = 0
  const lst = data.refs.cols.map(t1 => {
    const d = data.charts[0].serieses.find(d => d.seriesId == t1)
    if (binmax < d.max) binmax = d.max
    return {
      label: t1,
      vvalue: t1,
      boxplot: d.boxplot
    }
  })
  render(self, plot, lst, binmax)
}

function render(self, plot, lst, binmax) {
/*
  self: see "self" object in the init function above
  plot: supplied from mds.termdb.plot
  isVisible: boolean
*/
  plot.items = lst
  plot.settings.boxplot.yscale_max = binmax
  const sc = plot.settings.common
  const s = plot.settings.boxplot
  self.dom.svg.style('display','inline-block')
  self.y_scale = scaleLinear().domain([s.yscale_max,0]).range([0,sc.barheight])
  const max_label_height = get_max_labelheight( self, plot, s)

  // space for boxplot
  // let box_plot_space = (plot.boxplot) ?  30 : 4
  const box_plot_space = 4

  // define svg height and width
  const svg_width = plot.items.length * (sc.barwidth+sc.barspace) + s.yaxis_width
  const svg_height = s.toppad + sc.barheight + max_label_height + box_plot_space

  self.dom.svg
    .transition()
    .attr('width', svg_width)
    .attr('height', svg_height)

  // Y axis
  self.dom.yaxis_g
    .attr('transform','translate('+(s.yaxis_width-2)+','+s.toppad+')')
    .transition()
    .call(
      axisLeft()
        .scale(self.y_scale)
        // .tickFormat(d3format('d'))
        .ticks(10, d3format('d'))
    )

  client.axisstyle({
    axis: self.dom.yaxis_g,
    showline: true,
    fontsize: sc.barwidth*.8,
    color: 'black'
  })

  // if is stacked-bar, need to get color mapping for term2 values
  let term2valuecolor
  if( plot.items[0].lst ) {
    // may need a better way of deciding if it is two-term crosstabulate
    // to get all values for term2
    const term2values = new Set()
    for(const i of plot.items) {
      for(const j of i.lst) {
        term2values.add( j.label )
      }
    }
    if( term2values.size > 10 ) {
      term2valuecolor = scaleOrdinal( schemeCategory20 )
    } else {
      term2valuecolor = scaleOrdinal( schemeCategory10 )
    }
  }

  // plot each bar
  let x = s.yaxis_width + sc.barspace + sc.barwidth/2

  self.dom.graph_g
    .attr('transform','translate('+x+','+(s.toppad + sc.barheight)+')')
    .selectAll('*')
    .remove()

  plot.items.forEach((item, itemidx) => {
    if (!item.boxplot) return
    const g = self.dom.graph_g.append('g')
      .attr('transform','translate('+(itemidx*(sc.barwidth+sc.barspace))+',0)')

    // X axis labels  
    const xlabel = g.append('text')
      .text(item.label)
      .attr("transform", "translate(0,"+ box_plot_space +") rotate(-65)")
      .attr('text-anchor','end')
      .attr('font-size', s.label_fontsize)
      .attr('font-family', client.font)
      .attr('dominant-baseline','central')

    let x_lab_tip = ''

    //this is for boxplot for 2nd numerical term
    if ('w1' in item.boxplot) {
      g.append("line")
        .attr("x1", 0)
        .attr("y1", self.y_scale(item.boxplot.w1)-sc.barheight)
        .attr("x2", 0)
        .attr("y2", self.y_scale(item.boxplot.w2)-sc.barheight)
        .attr("stroke-width", 2)
        .attr("stroke", "black")

      if(sc.use_logscale){
        g.append("rect")
        .attr('x', -sc.barwidth/2)
        .attr('y', self.y_scale(item.boxplot.p75)-sc.barheight)
        .attr('width', sc.barwidth)
        .attr('height', sc.barheight - self.y_scale(item.boxplot.p75 / item.boxplot.p25))
        .attr('fill','#901739')
      }else{
        g.append("rect")
        .attr('x', -sc.barwidth/2)
        .attr('y', self.y_scale(item.boxplot.p75)-sc.barheight)
        .attr('width', sc.barwidth)
        .attr('height', sc.barheight - self.y_scale(item.boxplot.p75-item.boxplot.p25))
        .attr('fill','#901739')
      }

      g.append("line")
        .attr("x1", -sc.barwidth/2.2)
        .attr("y1", self.y_scale(item.boxplot.w1)-sc.barheight)
        .attr("x2", sc.barwidth/2.2)
        .attr("y2", self.y_scale(item.boxplot.w1)-sc.barheight)
        .attr("stroke-width", 2)
        .attr("stroke", "black")

      g.append("line")
        .attr("x1", -sc.barwidth/2.2)
        .attr("y1", self.y_scale(item.boxplot.p50)-sc.barheight)
        .attr("x2", sc.barwidth/2.2)
        .attr("y2", self.y_scale(item.boxplot.p50)-sc.barheight)
        .attr("stroke-width", 1.5)
        .attr("stroke", "white")
      
      g.append("line")
        .attr("x1", -sc.barwidth/2.2)
        .attr("y1", self.y_scale(item.boxplot.w2)-sc.barheight)
        .attr("x2", sc.barwidth/2.2)
        .attr("y2", self.y_scale(item.boxplot.w2)-sc.barheight)
        .attr("stroke-width", 2)
        .attr("stroke", "black")
    }

    for(const outlier of item.boxplot.out){
      g.append("circle")
        .attr('cx', 0)
        .attr('cy', self.y_scale(outlier.value)-sc.barheight)
        .attr('r', 2)
        .attr('fill','#901739')
    } 
    // x-label tooltip
    if( item.lst ){
      xlabel.on('mouseover',()=>{
        plot.tip.clear()
          .show(d3event.clientX,d3event.clientY)
          .d
          .append('div')
          .html(
            plot.term.name+': ' + item.label + '<br>'
            + '# patients: '+ item.value + '<br>'
            + x_lab_tip
            )
      })
      .on('mouseout',()=>{
        plot.tip.hide()
      })
    }else{  
      xlabel.on('mouseover',()=>{
        plot.tip.clear()
          .show(d3event.clientX,d3event.clientY)
          .d
          .append('div')
          .html(
            plot.term.name+': '+ item.label+'<br>'
            +'# patients: '+item.value
            )
      })
      .on('mouseout',()=>{
        plot.tip.hide()
      })
    }
  })
}

function get_max_labelheight ( self, plot, s ) {
  let textwidth = 0
  for(const i of plot.items) {
    self.dom.svg.append('text')
      .text( i.label )
      .attr('font-family', client.font)
      .attr('font-size', s.label_fontsize)
      .each( function() {
        textwidth = Math.max( textwidth, this.getBBox().width )
      })
      .remove()
  }

  return textwidth
}
