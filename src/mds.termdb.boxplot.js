export function may_make_boxplot(plot) {
  if (plot.term2_displaymode != "boxplot") {
    plot.box_svg.style('display','none')
    return
  }
  plot.box_svg.style('display','inline-block')
  if (plot.use_logscale) {
    plot.y_scale = scaleLog().domain([plot.yscale_max,1]).range([0,plot.barheight])
  } else if (plot.use_percentage) {
    plot.y_scale = scaleLinear().domain([100,0]).range([0,plot.barheight])
  } else {
    plot.y_scale = scaleLinear().domain([plot.yscale_max,0]).range([0,plot.barheight])
  }

  const max_label_height = get_max_labelheight( plot )

  // space for boxplot
  // let box_plot_space = (plot.boxplot) ?  30 : 4
  let box_plot_space = 4

  // define svg height and width
  const svg_width = plot.items.length * (plot.barwidth+plot.barspace) + plot.yaxis_width
  const svg_height = plot.toppad + plot.barheight+max_label_height + box_plot_space

  plot.box_svg
    .transition()
    .attr('width', svg_width)
    .attr('height', svg_height)

  // Y axis
  plot.yaxis_g
    .attr('transform','translate('+(plot.yaxis_width-2)+','+plot.toppad+')')
    .transition()
    .call(
      axisLeft()
        .scale(plot.y_scale)
        // .tickFormat(d3format('d'))
        .ticks(10, d3format('d'))
    )

  client.axisstyle({
    axis:plot.yaxis_g,
    showline:true,
    fontsize:plot.barwidth*.8,
    color:'black'
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
  let x = plot.yaxis_width+ plot.barspace + plot.barwidth/2

  // in case of stacked bar, collect uniq set of term2 labels for showing in legend
  // this does not allow ordering the labels by certain way, may update later
  const term2_labels = new Set()

  plot.graph_g
    .attr('transform','translate('+x+','+(plot.toppad + plot.barheight)+')')
    .selectAll('*')
    .remove()


  for(const [ itemidx, item] of plot.items.entries()) {

    const g = plot.graph_g.append('g')
      .attr('transform','translate('+(itemidx*(plot.barwidth+plot.barspace))+',0)')

    // X axis labels  
    const xlabel = g.append('text')
      .text(item.label)
      .attr("transform", "translate(0,"+ box_plot_space +") rotate(-65)")
      .attr('text-anchor','end')
      .attr('font-size',plot.label_fontsize)
      .attr('font-family',client.font)
      .attr('dominant-baseline','central')

    let x_lab_tip = ''

    //this is for boxplot for 2nd numerical term 
    //if (isNaN(plot.y_scale(item.boxplot.w1))) console.log(item.boxplot)
    
    if ('w1' in item.boxplot) {
      g.append("line")
        .attr("x1", 0)
        .attr("y1", plot.y_scale(item.boxplot.w1)-plot.barheight)
        .attr("x2", 0)
        .attr("y2", plot.y_scale(item.boxplot.w2)-plot.barheight)
        .attr("stroke-width", 2)
        .attr("stroke", "black")

      if(plot.use_logscale){
        g.append("rect")
        .attr('x', -plot.barwidth/2)
        .attr('y', plot.y_scale(item.boxplot.p75)-plot.barheight)
        .attr('width', plot.barwidth)
        .attr('height', plot.barheight - plot.y_scale(item.boxplot.p75 / item.boxplot.p25))
        .attr('fill','#901739')
      }else{
        g.append("rect")
        .attr('x', -plot.barwidth/2)
        .attr('y', plot.y_scale(item.boxplot.p75)-plot.barheight)
        .attr('width', plot.barwidth)
        .attr('height', plot.barheight - plot.y_scale(item.boxplot.p75-item.boxplot.p25))
        .attr('fill','#901739')
      }

      g.append("line")
        .attr("x1", -plot.barwidth/2.2)
        .attr("y1", plot.y_scale(item.boxplot.w1)-plot.barheight)
        .attr("x2", plot.barwidth/2.2)
        .attr("y2", plot.y_scale(item.boxplot.w1)-plot.barheight)
        .attr("stroke-width", 2)
        .attr("stroke", "black")

      g.append("line")
        .attr("x1", -plot.barwidth/2.2)
        .attr("y1", plot.y_scale(item.boxplot.p50)-plot.barheight)
        .attr("x2", plot.barwidth/2.2)
        .attr("y2", plot.y_scale(item.boxplot.p50)-plot.barheight)
        .attr("stroke-width", 1.5)
        .attr("stroke", "white")
      
      g.append("line")
        .attr("x1", -plot.barwidth/2.2)
        .attr("y1", plot.y_scale(item.boxplot.w2)-plot.barheight)
        .attr("x2", plot.barwidth/2.2)
        .attr("y2", plot.y_scale(item.boxplot.w2)-plot.barheight)
        .attr("stroke-width", 2)
        .attr("stroke", "black")
    }

    for(const outlier of item.boxplot.out){
      g.append("circle")
        .attr('cx', 0)
        .attr('cy', plot.y_scale(outlier.value)-plot.barheight)
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
  }
}