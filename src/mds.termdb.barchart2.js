import settings from "./bars.settings"
import barsRenderer from "./bars.renderer"
import { select, event } from "d3-selection"
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { rgb } from 'd3-color'
import { Menu } from './client'
import {may_makebutton_crosstabulate} from './mds.termdb.crosstab'

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
    this.terms = {
      term0: null,
      term1: this.opts.term1,
      term2: null
    }
    this.handlers = this.getEventHandlers()
    this.controls = {}
    this.setControls()
  }

  main(_settings={}, obj=null) {
    this.obj = obj
    this.updateSettings(_settings)

    const dataName = '?'
      + 'genome=' + this.settings.genome
      + '&dslabel=' + this.settings.dslabel
      + '&term0=' + this.settings.term0
      + '&term1=' + this.settings.term1
      + '&term2=' + this.settings.term2
      + '&ssid=' + this.settings.ssid
      + '&mname=' + this.settings.mname

    if (this.serverData[dataName]) {
      this.render(this.serverData[dataName]) 
    }
    else {
      fetch('/termdb-barchart' + dataName)
      .then(response => response.json())
      .then(chartsData => {
        this.serverData[dataName] = chartsData
        this.render(chartsData)
      })
    }
  }

  updateSettings(settings) {
    Object.assign(this.settings, settings)
    if (this.settings.term2 == "" && this.settings.unit == "pct") {
      this.settings.unit = "abs"
    }
    if (this.settings.term2 == "genotype") {
      this.terms.term2 = {name: this.settings.mname}
    }
    this.updateControls()
  }

  render(chartsData) {
    const self = this
    self.seriesOrder = chartsData.charts[0].serieses
      .sort((a,b) => !isNaN(a.seriesId)
        ? +b.seriesId - +a.seriesId
        : a.total - b.total
      )
      .map(d => d.seriesId)

    const charts = this.holder.selectAll('.pp-sbar-div')
      .data(chartsData.charts, chart => chart.chartId)

    charts.exit()
    .each(function(chart){
      delete self.renderers[chart.chartId]
      select(this).remove()
    })

    charts.each(function(chart) {
      chart.settings = Object.assign(self.settings, chartsData.refs)
      chart.settings.cols.sort((a,b) => self.seriesOrder.indexOf(b) - self.seriesOrder.indexOf(a))
      chart.maxAcrossCharts = chartsData.maxAcrossCharts
      chart.handlers = self.handlers
      chart.maxSeriesLogTotal = 0
      const rows = chart.serieses
        .find(series => series.seriesId == chart.settings.cols[0])
        .data
        .sort((a,b) => b.total - a.total)
        .map(d => d.dataId)
      chart.serieses.forEach(series => self.sortStacking(rows, series, chart, chartsData))
      self.renderers[chart.chartId](chart)
    })

    charts.enter()
    .append('div')
    .attr('class', 'pp-sbar-div')
    .style("display", "inline-block")
    .style("padding", "20px")
    .each(function(chart,i) {
      chart.settings = Object.assign(self.settings, chartsData.refs)
      chart.settings.cols.sort((a,b) => self.seriesOrder.indexOf(b) - self.seriesOrder.indexOf(a))
      chart.maxAcrossCharts = chartsData.maxAcrossCharts
      chart.handlers = self.handlers
      chart.maxSeriesLogTotal = 0
      self.renderers[chart.chartId] = barsRenderer(self, select(this))
      const rows = chart.serieses
        .find(series => series.seriesId == chart.settings.cols[0])
        .data
        .sort((a,b) => b.total - a.total)
        .map(d => d.dataId)
      chart.serieses
        //.sort((a,b) => b.total - a.total)
        .forEach(series => self.sortStacking(rows, series, chart, chartsData))
      self.renderers[chart.chartId](chart)
    })
  }

  sortStacking(rows, series, chart, chartsData) {
    series.data.sort((a,b) => {
      return rows.indexOf(a.dataId) < rows.indexOf(b.dataId) ? -1 : 1 
    });
    let seriesLogTotal = 0
    for(const result of series.data) {
      result.colgrp = "-"
      result.rowgrp = "-"
      result.chartId = chart.chartId
      result.seriesId = series.seriesId
      result.seriesTotal = series.total
      result.logTotal = Math.log10(result.total)
      seriesLogTotal += result.logTotal
    }
    if (seriesLogTotal > chart.maxSeriesLogTotal) {
      chart.maxSeriesLogTotal = seriesLogTotal
    }
  }

  sortSeries(a,b) {
    console.log(a[this.settings.term2] < b[this.settings.term1])
    return a[this.settings.term2] < b[this.settings.term1] 
      ? -1
      : 1 
  }

  getEventHandlers() {
    const terms = this.terms
    const s = this.settings
    return {
      svg: {
        mouseout: ()=>{
          tip.hide()
        },
      },
      series: {
        mouseover(d) { 
          const html = terms.term1.name +': ' + d.seriesId +
            (!terms.term2 ? "" : "<br/>" + terms.term2.name +": "+ d.dataId) + 
            "<br/>Total: " + d.total + 
            (
              !terms.term2 
              ? "" 
              : "<br/>Percentage: " + (100*d.total/d.seriesTotal).toFixed(1) + "% of " + d.seriesId
            );
          tip.show(event.clientX, event.clientY).d.html(html);
        },
        mouseout: ()=>{
          tip.hide()
        },
        rectFill(d) {
          return s.term2 === ""
            ? "rgb(144, 23, 57)"
            : rgb(s.rows.length < 11 
              ? colors.c10(d.dataId)
              : colors.c20(d.dataId)
            ).toString().replace('rgb(','rgba(').replace(')', ',0.7)')
        },
        click(d) {
          if (!obj.modifier_barchart_selectbar || !obj.modifier_barchart_selectbar.callback) return
          const t = []
          for(const termNum in terms) {
            const term = terms[termNum]
            if (termNum != 'term0' && term) {
              t.push({
                term,
                value: d.seriesId,
                label: !term.values 
                  ? d.seriesId
                  : termNum=="term1"
                    ? term.values[d.seriesId] 
                    : term.values[d.dataId]
              })
            }
          } //console.log(t, d, terms)
          obj.modifier_barchart_selectbar.callback({terms: t})
        }
      },
      colLabel: {
        text: d => d
      },
      rowLabel: {},
      legend: {},
      yAxis: {
        text: () => {
          return s.unit == "pct" ? "% of patients" : "# of patients"
        }
      },
      xAxis: {
        text: () => {
          return s.term1[0].toUpperCase() + s.term1.slice(1)
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
    this.addSelectOpts('unit', 'Y axis', [
      {value: 'abs', label: 'Linear'},
      //{value: 'log', label: 'Log'},
      {value: 'pct', label: 'Percent'},
    ])
    
    this.addCrossTabBtn('term0', 'Chart By')
    this.addCrossTabBtn('term2', 'Select Second Term')
  }

  addSelectOpts(key, label, opts) {
    const selectDiv = this.controlsDiv.append('div')
      .style('padding', '3px')
      .style('text-align', 'center')
      .style('display', 'none')
      
    const selectLabel = selectDiv.append('label')
    selectLabel.append('span')
      .html(label + '<br/>')
    
    const selectElem = selectLabel.append('select')
      .on('change', () => {
        this.main({[key]: selectElem.property('value')})
      })

    selectElem.selectAll('options')
      .data(opts)
    .enter().append('option')
      .property('selected', d => d.value == this.settings[key] ? "selected" : "") 
      .attr('value', d => d.value)
      .html(d => d.label)

    this.controls[key] = {
      div: selectDiv,
      elem: selectElem,
      set: () => {
        selectElem.property('value', this.settings[key])
        selectElem
          .selectAll('option')
          .filter(d => d.value == 'pct')
          .property('disabled', () => this.settings.term2 === "")
      }
    }
  }

  addCrossTabBtn(key, label) {
    const btn = may_makebutton_crosstabulate({
      term1: this.terms.term1,
      button_row: this.controlsDiv,
      obj: this.opts.obj,
      callback: result => {
        //console.log(result)
        this.terms[key] = result.term2
        this.main({[key]: result.term2.id})
      }
    })

    btn.style('font-size','1em')
      .text(label)

    const closer = this.controlsDiv.append('div')
      .attr('class', 'sja-menu-option')
      .style('font-size', '1em')
      .style('display', 'none')
      .style('margin-right', '20px')
      .style('padding', '2px')
      .style('cursor', 'pointer')
      .style('background', '#f2f2f2')
      .html('X')
      .on('click', ()=>{
        this.terms[key] = undefined
        this.main({[key]: ''})
      })

    this.controls[key] = {
      div: btn,
      elem: null,
      set: () => {
        btn.text(this.terms[key] ? this.terms[key].name : label)
        closer.style('display', this.settings[key] ? 'inline-block' : 'none')
      }
    }
  }

  updateControls() {
    for(const key in this.controls) {
      this.controls[key].set()
      this.controls[key].div.style("display", "inline-block")
    }
  }
}
