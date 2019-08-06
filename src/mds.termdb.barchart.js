import rendererSettings from "./bars.settings"
import barsRenderer from "./bars.renderer"
import { select, event } from "d3-selection"
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { rgb } from 'd3-color'
import { Menu } from './client'
import { bar_click_menu } from './mds.termdb.controls'

const colors = {
  c10: scaleOrdinal( schemeCategory10 ),
  c20: scaleOrdinal( schemeCategory20 )
} 

const tip = new Menu({padding:'5px'})
//tip.d.style('text-align', 'center')

export class TermdbBarchart{
  constructor(opts={settings:{}}) {
    this.opts = opts
    this.dom = {
      holder: opts.holder,
      barDiv: opts.holder.append('div')
        .style('white-space', 'normal'),
      legendDiv: opts.holder.append('div')
        .style('margin', '5px 5px 15px 5px')
    }
    this.defaults = Object.assign(
      JSON.parse(rendererSettings),
      {
        isVisible: false,
        term0: '',
        term1: 'sex',
        term2: ''
      }
    ) 
    this.settings = Object.assign(this.defaults, opts.settings)
    this.renderers = {}
    this.serverData = {}
    this.terms = {
      term0: null,
      term1: this.opts.term1,
      term2: null
    }
    this.handlers = this.getEventHandlers()
    this.controls = {}
    this.currChartsData = null
    this.term2toColor = {}
  }

  main(plot=null, data=null, isVisible=true, obj=null) {
    if (!this.currServerData) this.dom.barDiv.style('max-width', window.innerWidth + 'px')
    if (data) this.currServerData = data
    if (!this.setVisibility(isVisible)) return
    if (obj) this.obj = obj
    if (plot) this.plot = plot
    this.updateSettings(plot)
    this.processData(this.currServerData)
  }

  updateSettings(plot) {
    if (!plot) return
    // translate relevant plot keys to barchart settings keys
    const obj = plot.obj
    const settings = {
      genome: obj.genome.name,
      dslabel: obj.dslabel ? obj.dslabel : obj.mds.label,
      term0: plot.term0 ? plot.term0.id : '',
      term1: plot.term.id,
      term2: obj.modifier_ssid_barchart ? 'genotype' 
        : plot.term2 ? plot.term2.id
        : '',
      ssid: obj.modifier_ssid_barchart ? obj.modifier_ssid_barchart.ssid : '',
      mname: obj.modifier_ssid_barchart ? obj.modifier_ssid_barchart.mutation_name : '',
      groups: obj.modifier_ssid_barchart ? obj.modifier_ssid_barchart.groups : null,
      unit: plot.settings.bar.unit,
      custom_bins: plot.custom_bins,
      orientation: plot.settings.bar.orientation,
      // normalize bar thickness regardless of orientation
      colw: plot.settings.common.barwidth,
      rowh: plot.settings.common.barwidth,
      colspace: plot.settings.common.barspace,
      rowspace: plot.settings.common.barspace
    }
    Object.assign(this.settings, settings, this.currServerData.refs ? this.currServerData.refs : {})
    this.settings.numCharts = this.currServerData.charts ? this.currServerData.charts.length : 0
    if (this.settings.term2 == "" && this.settings.unit == "pct") {
      this.settings.unit = "abs"
    }
    if (this.settings.term2 == "genotype") {
      this.terms.term2 = {name: this.settings.mname}
    } else if ('term2' in this.settings && plot.term2) {
      this.terms.term2 = plot.term2 
    } else {
      this.terms.term2 = null
    }
    this.terms.term0 = settings.term0 && plot.term0 ? plot.term0 : null
  }

  setVisibility(isVisible) {
    const display = isVisible ? 'block' : 'none'
    this.dom.barDiv.style('display', display)
    this.dom.legendDiv.style('display', display)
    return isVisible
  }

  processData(chartsData) {
    const self = this
    const cols = chartsData.refs.cols

    self.grade_labels = chartsData.refs.grade_labels 
      ? chartsData.refs.grade_labels
      : null

    self.seriesOrder = !chartsData.charts.length 
      ? [] 
      :chartsData.charts[0].serieses
        .sort(chartsData.refs.useColOrder
          ? (a,b) => cols.indexOf(b.seriesId) - cols.indexOf(a.seriesId)
          : (a,b) => !isNaN(a.seriesId)
            ? +b.seriesId - +a.seriesId
            : a.total - b.total
        )
        .map(d => d.seriesId)

    self.setMaxVisibleTotals(chartsData)

    const bins = chartsData.refs.bins 
      ? chartsData.refs.bins
      : self.settings.term2 
        && self.terms.term2.graph 
        && self.terms.term2.graph.barchart
        && self.terms.term2.graph.barchart.numeric_bin
      ? self.terms.term2.graph.barchart.numeric_bin
      : []

    self.bins = bins
    self.binLabels = bins.map(d=>d.label).reverse()

    const rows = chartsData.refs.rows;
    self.rowSorter = chartsData.refs.useRowOrder
      ? (a,b) => rows.indexOf(a.dataId) - rows.indexOf(b.dataId)
      : self.binLabels
      ? (a,b) => self.binLabels.indexOf(b.dataId) - self.binLabels.indexOf(a.dataId)
      : (a,b) => b.total - a.total

    const charts = this.dom.barDiv.selectAll('.pp-sbar-div')
      .data(chartsData.charts, chart => chart.chartId)

    charts.exit()
    .each(function(chart){
      delete self.renderers[chart.chartId]
      select(this).remove()
    })

    charts.each(function(chart) {
      if (!chartsData.refs.useColOrder) {
        chart.settings.cols.sort((a,b) => self.seriesOrder.indexOf(b) - self.seriesOrder.indexOf(a))
      }
      chart.maxAcrossCharts = chartsData.maxAcrossCharts
      chart.handlers = self.handlers
      chart.maxSeriesLogTotal = 0
      const refColId = chart.settings.cols.filter(d=>!chart.settings.exclude.cols.includes(d))[0]
      const matchedRows = chart.serieses.find(series => !refColId || series.seriesId == refColId)
      const rows = !matchedRows ? [] : matchedRows.data.sort(self.rowSorter).map(d => d.dataId)
      chart.visibleSerieses.forEach(series => self.sortStacking(rows, series, chart, chartsData))
      self.renderers[chart.chartId](chart)
    })

    charts.enter()
    .append('div')
    .attr('class', 'pp-sbar-div')
    .style("display", "inline-block")
    .style("padding", "20px")
    .style('vertical-align', 'top')
    .each(function(chart,i) {
      if (!chartsData.refs.useColOrder) {
        chart.settings.cols.sort((a,b) => self.seriesOrder.indexOf(b) - self.seriesOrder.indexOf(a))
      }
      chart.maxAcrossCharts = chartsData.maxAcrossCharts
      chart.handlers = self.handlers
      chart.maxSeriesLogTotal = 0
      self.renderers[chart.chartId] = barsRenderer(self, select(this))
      const refColId = chart.settings.cols.filter(d=>!chart.settings.exclude.cols.includes(d))[0]
      const matchedRows = chart.serieses.find(series => !refColId || series.seriesId == refColId)
      const rows = !matchedRows ? [] : matchedRows.data.sort(self.rowSorter).map(d => d.dataId)
      chart.visibleSerieses.forEach(series => self.sortStacking(rows, series, chart, chartsData))
      self.renderers[chart.chartId](chart)
    })
  }

  setMaxVisibleTotals(chartsData) {
    const term1 = this.settings.term1
    let maxVisibleAcrossCharts = 0
    for(const chart of chartsData.charts) {
      chart.settings = JSON.parse(rendererSettings)
      if (this.currChartsData != chartsData) {
        const unannotatedColLabels = chartsData.refs.unannotatedLabels.term1
        if (unannotatedColLabels) {
          for(const label of unannotatedColLabels) {
            if (!chart.settings.exclude.cols.includes(label)) {
              chart.settings.exclude.cols.push(label)
            }
          }
        }
        const unannotatedRowLabels = chartsData.refs.unannotatedLabels.term2
        if (unannotatedRowLabels) {
          for(const label of unannotatedRowLabels) {
            if (!chart.settings.exclude.rows.includes(label)) {
              chart.settings.exclude.rows.push(label)
            }
          }
        }
      }
    }
    const settingsCopy = Object.assign({},this.settings)
    delete settingsCopy.exclude
    for(const chart of chartsData.charts) {
      Object.assign(chart.settings, settingsCopy, chartsData.refs)
      chart.visibleSerieses = chart.serieses.filter(d=>{
        return !chart.settings.exclude.cols.includes(d.seriesId)
      })
      chart.settings.colLabels = chart.visibleSerieses.map(series=>{
        const id = series.seriesId
        const grade_label = this.terms.term1.iscondition && this.grade_labels
            ? this.grade_labels.find(c => id == c.grade)
            : null
        const label = grade_label ? grade_label.label : id
        const af = series && 'AF' in series ? ', AF=' + series.AF : ''
        return {
          id,
          label: label + af
        }
      })
      chart.maxVisibleSeriesTotal = chart.visibleSerieses.reduce((max,b) => {
        b.visibleData = b.data.filter(d => !chart.settings.exclude.rows.includes(d.dataId))
        b.visibleTotal = b.visibleData.reduce((sum, a) => sum + a.total, 0)
        return b.visibleTotal > max ? b.visibleTotal : max
      }, 0)
      if (chart.maxVisibleSeriesTotal > maxVisibleAcrossCharts) {
        maxVisibleAcrossCharts = chart.maxVisibleSeriesTotal
      }
    }
    for(const chart of chartsData.charts) {
      chart.maxVisibleAcrossCharts = maxVisibleAcrossCharts
    }
    this.currChartsData = chartsData
  }

  sortStacking(rows, series, chart, chartsData) {
    series.visibleData.sort((a,b) => {
      return rows.indexOf(a.dataId) < rows.indexOf(b.dataId) ? -1 : 1 
    });
    let seriesLogTotal = 0
    for(const result of series.visibleData) {
      result.colgrp = "-"
      result.rowgrp = "-"
      result.chartId = chart.chartId
      result.seriesId = series.seriesId
      result.seriesTotal = series.total
      result.logTotal = Math.log10(result.total)
      seriesLogTotal += result.logTotal;
      this.setTerm2Color(result)
      result.color = this.term2toColor[result.dataId]
    }
    if (seriesLogTotal > chart.maxSeriesLogTotal) {
      chart.maxSeriesLogTotal = seriesLogTotal
    }
    // assign color to hidden data
    // for use in legend
    for(const result of series.data) {
      this.setTerm2Color(result)
      result.color = this.term2toColor[result.dataId]
    }
  }

  sortSeries(a,b) {
    return a[this.settings.term2] < b[this.settings.term1] 
      ? -1
      : 1 
  }

  getEventHandlers() {
    const self = this
    const s = this.settings

    function barclick(d, callback, obj=null) {
    /*
      d: clicked bar data
      callback
    */

      const termValues = []
      self.terms.term0 = self.plot.term0
      self.terms.term1 = self.plot.term
      self.terms.term2 = self.plot.term2
      for(const index of [0,1,2]) { 
        const termNum = 'term' + index
        const term = self.terms[termNum]
        if (termNum == 'term0' || !term) continue

        const key = termNum=="term1" ? d.seriesId : d.dataId
        const q = term.q
        const label = term.iscondition && self.grade_labels && q.bar_by_grade
          ? self.grade_labels.find(c => c.grade == key).label
          : !term.values 
          ? key
          : termNum=="term1"
            ? term.values[d.seriesId].label
            : term.values[d.dataId].label

        if (term.iscondition) {
          termValues.push(Object.assign({
            term,
            values:[{key,label}]
          }, q));

          if (index == 1 && self.terms.term2 && term.id == self.terms.term2.id) {
            const q2 = self.plot.term2.q
            const term2Label = q.bar_by_children 
              ? self.grade_labels.find(c => c.grade == d.dataId).label
              : self.terms.term2.values
              ? self.terms.term2.values[d.dataId].label
              : d.dataId

            termValues.push(Object.assign({
              term,
              grade_and_child: [{
                grade: q2.bar_by_grade ? d.dataId : key,
                grade_label: q2.bar_by_grade ? term2Label : label ,
                child_id: q2.bar_by_children ? key : d.dataId,
                child_label: q2.bar_by_children ? label : term2Label
              }]
            }, q2))
          }
        } else {
          const bins = self.bins[index]
          if (!bins || !bins.length) {
            // not associated with numeric bins
            termValues.push({term, values: [{key, label}]})
          } else {
            const range = bins.find(d => d.label == label || d.name == label)
            if (range) termValues.push({term, ranges: [range]})
            else if (term.q && term.q.binconfig && term.q.binconfig.unannotated) {
              for(const id in term.q.binconfig.unannotated._labels) {
                const _label = term.q.binconfig.unannotated._labels[id];
                if (_label == label) termValues.push({term, ranges: [{value: id, label}]});
              }
            }
          }
        }
      }
      if (!obj) {
        callback({terms: termValues})
      } else {
        callback(obj, termValues)
      }
      self.obj.tip.hide()
    }

    return {
      chart: {
        title(chart) {
          if (!self.terms.term0) return chart.chartId
          const grade = self.grade_labels
            ? self.grade_labels.find(c => c.grade == chart.chartId)
            : null
          return self.terms.term0.values
            ? self.terms.term0.values[chart.chartId].label
            : grade
            ? grade.label
            : chart.chartId
        }
      },
      svg: {
        mouseout: ()=>{
          tip.hide()
        },
      },
      series: {
        mouseover(d) {
          const term1 = self.terms.term1
          const term2 = self.terms.term2 ? self.terms.term2 : null
          const seriesGrade = self.grade_labels
            ? self.grade_labels.find(c => c.grade == d.seriesId)
            : null
          const dataGrade = self.grade_labels
            ? self.grade_labels.find(c => c.grade == d.dataId)
            : null
          const term1unit = term1.unit 
          const seriesLabel = (term1.values
            ? term1.values[d.seriesId].label
            : term1.iscondition && seriesGrade
            ? seriesGrade.label
            : d.seriesId) + (term1.unit ? ' '+ term1.unit : '')
          const dataLabel = (term2 && term2.values
            ? term2.values[d.dataId].label
            : term2 && term2.iscondition && dataGrade
            ? dataGrade.label
            : d.dataId) + (term2 && term2.unit ? ' '+ term2.unit : '')
          const icon = !term2
            ? ''
            : "<div style='display:inline-block; width:14px; height:14px; margin: 2px 3px; vertical-align:top; background:"+d.color+"'>&nbsp;</div>"
          const rows = [`<tr><td colspan=2 style='padding:3px; text-align:center'>${seriesLabel}</td></tr>`]
          if (term2) rows.push(`<tr><td colspan=2 style='padding:3px; text-align:center'>${icon} <span>${dataLabel}</span></td></tr>`)
          rows.push(`<tr><td style='padding:3px; color:#aaa'>Total</td><td style='padding:3px'>${d.total}</td></tr>`)
          rows.push(`<tr><td style='padding:3px; color:#aaa'>Percentage</td><td style='padding:3px'>${(100*d.total/d.seriesTotal).toFixed(1)}</td></tr>`)
          tip.show(event.clientX, event.clientY).d.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`);
        },
        mouseout: ()=>{
          tip.hide()
        },
        rectFill(d) {
          return d.color
        },
        click(d) {
          if (self.obj.modifier_barchart_selectbar 
            && self.obj.modifier_barchart_selectbar.callback) {
            barclick(d, self.obj.modifier_barchart_selectbar.callback)
          }
          else if (self.obj.bar_click_menu) {
            bar_click_menu(self.obj, barclick, d)
          }
        }
      },
      colLabel: {
        text: d => {
          return self.terms.term1.values
            ? self.terms.term1.values['id' in d ? d.id : d].label
            : 'label' in d
            ? d.label
            : d
        },
        click: () => { 
          const d = event.target.__data__
          if (d === undefined) return
          self.settings.exclude.cols.push(d.id)
          self.main()
        },
        mouseover: () => {
          event.stopPropagation()
          tip.show(event.clientX, event.clientY).d.html("Click to hide bar");
        },
        mouseout: () => {
          tip.hide()
        }
      },
      rowLabel: {
        text: d => {
          return self.terms.term1.values
            ? self.terms.term1.values['id' in d ? d.id : d].label
            : 'label' in d
            ? d.label
            : d
        },
        click: () => { 
          const d = event.target.__data__
          if (d === undefined) return
          self.settings.exclude.cols.push(d.id)
          self.main()
        },
        mouseover: () => {
          event.stopPropagation()
          tip.show(event.clientX, event.clientY).d.html("Click to hide bar");
        },
        mouseout: () => {
          tip.hide()
        }
      },
      legend: {
        click: () => {
          event.stopPropagation()
          const d = event.target.__data__
          if (d === undefined) return
          if (d.type == 'col') {
            const i = self.settings.exclude.cols.indexOf(d.id)
            if (i == -1) return
            self.settings.exclude.cols.splice(i,1)
            self.main()
          }
          if (d.type == 'row') {
            const i = self.settings.exclude.rows.indexOf(d.dataId)
            if (i == -1) {
              self.settings.exclude.rows.push(d.dataId)
            } else {
              self.settings.exclude.rows.splice(i,1)
            }
            self.main()
          }
        },
        mouseover: () => {
          event.stopPropagation()
          tip.show(event.clientX, event.clientY).d.html("Click to unhide bar");
        },
        mouseout: () => {
          tip.hide()
        }
      },
      yAxis: {
        text: () => {
          if (s.orientation == "vertical") { 
            return s.unit == "pct" ? "% of patients" : "# of patients"
          } else {
            const term = self.terms.term1
            return term.iscondition && self.plot.term.q.value_by_max_grade
              ? 'Maximum grade'
              : term.iscondition && self.plot.term.q.value_by_most_recent
              ? 'Most recent grade'
              : term.iscategorical || !term.unit
              ? ''
              : term.unit //term.name[0].toUpperCase() + term.name.slice(1)
          }
        }
      },
      xAxis: {
        text: () => {
          if (s.orientation == "vertical") {
            const term = self.terms.term1
            const q1 = term.q
            return term.iscondition && q1.bar_by_grade && q1.value_by_max_grade
              ? 'Maximum grade' 
              : term.iscondition && q1.bar_by_grade && q1.value_by_most_recent
              ? 'Most recent grades'
              : term.iscategorical || !term.unit
              ? ''
              : term.unit // term.name[0].toUpperCase() + term.name.slice(1)
          } else {
            return s.unit == "pct" ? "% of patients" : "# of patients"
          }
        }
      }
    }
  }

  setTerm2Color(result) {
    if (this.settings.groups && result.dataId in this.settings.groups) {
      this.term2toColor[result.dataId] = this.settings.groups[result.dataId].color
    }
    if (result.dataId in this.term2toColor) return 
    this.term2toColor[result.dataId] = this.settings.term2 === ""
      ? "rgb(144, 23, 57)"
      : rgb(this.settings.rows && this.settings.rows.length < 11 
        ? colors.c10(result.dataId)
        : colors.c20(result.dataId)
      ).toString() //.replace('rgb(','rgba(').replace(')', ',0.7)')
  }

  getLegendGrps(chart) {
    const legendGrps = []
    const s = this.settings
    if (s.exclude.cols.length) {
      const t = this.terms.term1
      const b = t.graph && t.graph.barchart ? t.graph.barchart : null
      const grade_labels = b && t.iscondition ? this.grade_labels : null

      legendGrps.push({
        name: "Hidden " + this.terms.term1.name + " value",
        items: s.exclude.cols
          .filter(collabel => s.cols.includes(collabel))
          .map(collabel => {
            const total = chart.serieses
              .filter(c => c.seriesId == collabel)
              .reduce((sum, b) => sum + b.total, 0)
            
            const grade = grade_labels ? grade_labels.find(c => c.grade == collabel) : null
            
            return {
              id: collabel,
              text: grade ? grade.label : collabel,
              color: "#fff",
              textColor: "#000",
              border: "1px solid #333",
              inset: total ? total : '',
              type: 'col'
            }
          })
      })
    }
    if (s.rows && s.rows.length > 1 && !s.hidelegend && this.terms.term2 && this.term2toColor) {
      const t = this.terms.term2
      const b = t.graph && t.graph.barchart ? t.graph.barchart : null
      const overlay = !t.iscondition || !b ? '' : b.value_choices.find(d => false /*d[s.conditionUnits[2]]*/)
      const grade_labels = b && t.iscondition ? this.grade_labels : null
      const colors = {}
      legendGrps.push({
        name: t.name + (overlay ? ': '+overlay.label : ''),
        items: s.rows.map(d => {
          const g = grade_labels ? grade_labels.find(c => typeof d == 'object' && 'id' in d ? c.grade == d.id : c.grade == d) : null
          this.binLabels
          return {
            dataId: d,
            text: g ? g.label : d,
            color: this.term2toColor[d],
            type: 'row',
            isHidden: s.exclude.rows.includes(d)
          }
        }).sort(
          this.settings.term2 && this.binLabels
          ? this.rowSorter 
          : (a,b) => a.text < b.text ? -1 : 1
        )
      })
    }
    return legendGrps;
  }
}
