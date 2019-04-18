import {select} from 'd3-selection'

export default function htmlLegend(legendDiv, legendItemClickCallback=null, viz={settings:{}}) {
  const isHidden = {}

  function render(data) {
    legendDiv.selectAll('*').remove()
    legendDiv
      .style('text-align', data.legendTextAlign ? data.legendTextAlign : 'center')
    .selectAll('div')
      .data(data)
    .enter().append('div')
      .each(addLegendRow)

    const s = viz.settings
    if (s.legendChartSide=='right') {
      setTimeout(()=>{
        const pbox = viz.dom.container.node().parentNode.getBoundingClientRect()
        const mbox = viz.dom.container.node().getBoundingClientRect()
        const lbox = viz.dom.legendDiv.node().getBoundingClientRect()
        const currPadTop = parseFloat(viz.dom.legendDiv.style('padding-top'))
        const padTop = pbox.height - mbox.height + (mbox.height - lbox.height + currPadTop)/2
        if (Math.abs(currPadTop - padTop) < 20) return
        //console.log(padTop, pbox.height, mbox.height, lbox.height)
        viz.dom.legendDiv.transition().duration(100)
          .style('padding-top', padTop < 0 ? 0 : padTop+'px')
      },1200)
    }
  }

  function addLegendRow(d) {
    const s = viz.settings
    const div = select(this)
    if (d.name) {
      if (s.legendChartSide == 'right') {
        div.style('text-align','left')

        div.append('div')
          .style('font-size', s.legendFontSize)
          .style('font-weight',600)
          .html(d.name)

        div.append('div')
          .selectAll('div')
          .data(d.items)
        .enter().append('div')
          .style('display','inline-block')
          .style('margin-right','5px')
          .each(addLegendItem)
      }
      else {
        div.style('white-space','nowrap')
        div.append('div')
          .style('display', 'inline-block')
          .style('width', d.rowLabelHangLeft ? d.rowLabelHangLeft+'px' : null)
          .style('text-align', d.rowLabelHangLeft ? 'right' : null)
          .style('font-weight',600)
          .style('vertical-align','top')
          .html(d.name)

        div.append('div')
          .style('display','inline-block')
          .style('max-width',  1.2*d.rowLabelHangLeft+'px')
          .style('white-space','normal')
          .style('vertical-align','top')
          .selectAll('div')
          .data(d.items)
        .enter().append('div')
          .style('display','inline-block')
          .style('margin-left','15px')
          .each(addLegendItem)
      }
    }
    else {
      div.selectAll('div')
        .data(d.items)
      .enter().append('div')
        .style('display','inline-block')
        .style('margin-left','15px')
        .each(addLegendItem)
    }
  }

  function addLegendItem(d) {
    const s = viz.settings
    const div = select(this)
    const color = d.fill ? d.fill : d.stroke ? d.stroke : d.color

    div.style('opacity', d.isHidden ? 0.3 : 1)
    
    if (d.svg) {
      div.append('svg')
        .attr('width', d.svgw)
        .attr('height', d.svgh)
        .style('display', 'inline-block')
        .style('vertical-align', 'top')
        .html(d=>d.svg)
    }
    else {
      div.append('div')
        .style('display','inline-block')
        .style('position','relative')
        .style('width','12px')
        .style('height','12px')
        .style('top','1px')
        .style('border','1px solid '+ color)
        .style('border-radius', d.shape=='circle' ? '6px' : '')
        .style('background-color', d.shape=='circle' ? '' : color)
        .style('cursor','pointer')
    }

    div.append('div')
      .style('display','inline-block')
      .style('margin-left', d.svg ? '1px' : '3px')
      .style('cursor','pointer')
      .style('font-size', s.legendFontSize)
      .style('line-height', s.legendFontSize)
      .style('vertical-align', d.svg ? 'top' : null)
      .html(d.text)

    if (d.gArr) {
      div.on('click',()=>{
        d.gArr.forEach(g=>{
          g.style('display', g.style('display')=='none' ? '' : 'none')
        })
        isHidden[d.text] = !isHidden[d.text]
        div.style('opacity', isHidden[d.text] ? 0.3 : 1)
      })
    }
    else if (legendItemClickCallback) {
      div.on('click',()=>{
        legendItemClickCallback(d.text)
      })
    }
  }

  return render
}