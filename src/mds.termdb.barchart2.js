//import * as client from './client'
//import * as common from './common'
//import {axisLeft} from 'd3-axis'
//import {format as d3format} from 'd3-format'
//import {scaleLinear,scaleOrdinal,schemeCategory10,scaleLog,schemeCategory20} from 'd3-scale'
//import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
//import {init} from './mds.termdb'
//import {may_makebutton_crosstabulate} from './mds.termdb.crosstab'

import settings from "./bars.settings"
import barsRenderer from "./bars.renderer"
import { select, event } from "d3-selection"
//import { tooltip } from "./client.js";

//const tip = tooltip({ zIndex: 1001 });
console.log(settings)

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
    this.handlers = {
      svg: {
        mouseout() {
          //tip.hide()
        },
      },
      series: {
        mouseover(d) {
          const html = d.term1 + " " + d.term2 + 
            "<br/>Total: " + d.count + 
            "<br/>Percentage: " + (100*d.count/d.groupTotal).toFixed(1) + "%" ;
          //tip.show(event, html);
        },
        mouseout() {
          //tip.hide()
        },
        rectFill(d) {
          return '#ccc'
        }
      },
      colLabel: {
        text: d => d
      },
      rowLabel: {},
      legend: {},
      yAxis: {
        text: () => {
          return this.settings.unit == "abs" ? "Total" : "Percentage"
        }
      },
      xAxis: {
        text: () => {
          return this.settings.term1[0].toUpperCase() + this.settings.term1.slice(1)
        }
      }
    }
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

  render(chartsData) { console.log(chartsData)
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
      self.renderers[chart.chartId](chart)
    })
  }
}
