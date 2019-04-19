import settings from "./bars.settings"
import barsRenderer from "./bars.renderer"
import { select, event } from "d3-selection"
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { rgb } from 'd3-color'
import { Menu } from './client'

const colors = {
  c10: scaleOrdinal( schemeCategory10 ),
  c20: scaleOrdinal( schemeCategory20 )
} 

const tip = new Menu({padding:'5px'})
tip.d.style('text-align', 'center')

export default class BarsApp{
  constructor(opts={settings:{}}) {
    this.opts = opts
    this.holder = opts.holder
    this.defaults = JSON.parse(settings)
    this.settings = Object.assign({
      term0: '',
      term1: 'sex',
      term2: ''
    }, this.defaults, opts.settings)
    this.renderers = {}
    this.serverData = {}
    this.handlers = this.getEventHandlers()
    this.setControls()
  }

  main(_settings={}) {
    Object.assign(this.settings, _settings)

    const dataName = '?genome=hg38&dslabel=SJLife'
      + '&term0=' + this.settings.term0
      + '&term1=' + this.settings.term1
      + '&term2=' + this.settings.term2

    if (this.serverData[dataName]) {
      this.render(this.serverData[dataName]) 
    }
    else {
      fetch('/termdb2' + dataName)
      .then(response => response.json())
      .then(chartsData => {
        this.serverData[dataName] = chartsData
        this.render(chartsData)
      })
    }
  }

  render(chartsData) {
    const self = this
    const charts = this.holder.selectAll('.pp-sbar-div')
      .data(chartsData, chart => chart.chartId)

    charts.exit()
    .each(function(chart){
      delete self.renderers[chart.chartId]
      select(this).remove()
    })

    charts.each(function(chart) {
      chart.settings = Object.assign(self.settings, chart.settings)
      chart.handlers = self.handlers
      chart.seriesgrps.forEach(series => self.sortStacking(series))
      self.renderers[chart.chartId](chart)
    })

    charts.enter()
    .append('div')
    .attr('class', 'pp-sbar-div')
    .style("display", "inline-block")
    .style("padding", "20px")
    .each(function(chart,i) {
      chart.settings = Object.assign(self.settings, chart.settings)
      chart.handlers = self.handlers
      self.renderers[chart.chartId] = barsRenderer(select(this))
      chart.seriesgrps.forEach(series => self.sortStacking(series))
      self.renderers[chart.chartId](chart)
    })
  }

  sortStacking(series) {
    series.sort((a,b) => {
      return a.dataId < b.dataId ? -1 : 1 
    });
    series.seriesId = series[0] ? series[0].seriesId : ""
    for(const result of series) {
      result.lastTotal = 0
      result.scaleId = result.seriesId
    }
    let cumulative = 0
    for(const result of series) {
      cumulative += result.total
      result.lastTotal = cumulative
    }
  }

  sortSeries(a,b) {
    console.log(a[this.settings.term2] < b[this.settings.term1])
    return a[this.settings.term2] < b[this.settings.term1] 
      ? -1
      : 1 
  }

  getEventHandlers() {
    const self = this
    return {
      svg: {
        mouseout: ()=>{
          tip.hide()
        },
      },
      series: {
        mouseover(d) {
          const html = d.seriesId + " " + d.dataId + 
            "<br/>Total: " + d.total + 
            (!d.dataId ? "" : "<br/>Percentage: " + (100*d.total/d.groupTotal).toFixed(1) + "%");
          tip.show(event.clientX, event.clientY).d.html(html);
        },
        mouseout: ()=>{
          tip.hide()
        },
        rectFill(d) {
          return self.settings.term2 === ""
            ? "rgb(144, 23, 57)"
            : rgb(self.settings.rows.length < 11 
              ? colors.c10(d.dataId)
              : colors.c20(d.dataId)
            ).toString().replace('rgb(','rgba(').replace(')', ',0.7)')
        }
      },
      colLabel: {
        text: d => d
      },
      rowLabel: {},
      legend: {},
      yAxis: {
        text: () => {
          return this.settings.unit == "abs" ? "# of patients" : "% of patients"
        }
      },
      xAxis: {
        text: () => {
          return this.settings.term1[0].toUpperCase() + this.settings.term1.slice(1)
        }
      }
    }
  }

  setControls() {
    this.controlsDiv = this.holder.append('div')
    /*
    this.addSelectOpts('orientation', 'Orientation', [
      {value: 'x', label: 'X axis'},
      {value: 'y', label: 'Y axis'}
    ])
    */
    this.addSelectOpts('unit', 'Unit', [
      {value: 'abs', label: '# Patients'},
      {value: 'pct', label: '% Patients'}
    ])

    /*this.addSelectOpts('scale', 'Scale', [
      {value: 'linear', label: 'Linear'},
      {value: 'log', label: 'Log'}
    ])*/
    
    const terms = [
      {value: '', label: 'N/A'},
      {value: 'racegrp', label: 'Race'},
      {value: 'sex', label: 'Gender'},
      {value: 'diaggrp', label: 'Diagnosis Group'}
    ]
    this.addSelectOpts('term0', 'Chart By', terms)
    // this.addSelectOpts('term1', 'Columns By', terms)
    this.addSelectOpts('term2', 'Stack By', terms)
  }

  addSelectOpts(key, label, opts) {
    const selectDiv = this.controlsDiv.append('div')
      .style('display', 'inline-block')
      .style('padding', '3px')
      .style('text-align', 'center')
      .append('label')
    
    selectDiv.append('span')
      .html(label + '<br/>')
    
    const selectElem = selectDiv.append('select')
      .on('change', () => {
        this.main({[key]: selectElem.property('value')})
      })

    selectElem.selectAll('options')
      .data(opts)
    .enter().append('option')
      .property('selected', d => d.value == this.settings[key] ? "selected" : "") 
      .attr('value', d => d.value)
      .html(d => d.label)
  }
}
