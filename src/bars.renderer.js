import { select, event } from "d3-selection";
import { scaleLinear, scaleLog } from "d3-scale";
import htmlLegend from "./html.legend";
import { axisLeft } from "d3-axis";
import { format } from 'd3-format'
import { newpane } from "./client.js";

/*
arguments: 
  - holder: d3-selected DOM element

returns: 
  a bar chart renderer (main) function with the following argument 
  {
    // *** COMPUTED AGGREGATES ***
    maxAcrossCharts: number,   
    charts: [{
      chartId: string | number,
      total: number,
      maxSeriesTotal: number,
      serieses: [{
        seriesId: string | number,
        total: number,
        data: [{
          dataId: string | number,
          total: "+1"
        }]
      },

      // *** RENDERER SETTINGS ***
      // will extend instance settings
      // partial example below, see
      // bar.settings for a full example,
      // reuses config keys from tp.schema
      settings: {
        cols: [$seriesId],
        colgrps: [col2name.$seriesId.grp], 
        rows: [$dataId],
        rowgrps: [row2name.$seriesId.grp], // for clustering bars
        col2name: {
          $seriesId: {
            name: $seriesId,
            grp: string | number
          }
        },
        row2name: {
          $dataId: {
            name: $dataId,
            grp: string | number
          }
        }
      },

      // *** EVENT CALLBACK FUNCTIONS ***
      // for optional user interactivity
      // see bars.app.js for example event handlers
      handlers: {
        svg: {
          mouseover(d) {},
          mouseout() {}
        },
        series: {
          mouseover(d) {},
          mouseout() {},
          rectFill(d) {}
        },
        colLabel: {
          text: d => d,
          mouseover(d) {},
          mouseout() {}
        },
        rowLabel: {
          text: d => d,
          mouseover(d) {},
          mouseout() {}
        },
        legend: {
          text: d => d,
          mouseover(d) {},
          mouseout() {}
        },
        yAxis: {
          text: () => {}
        },
        xAxis: {
          text: () => {}
        }
      }
    }]
  }
*/

export default function barsRenderer(barsapp, holder) {
  const hm = {}
  const emptyObj = {}; //used to represent any empty cell
  let chart
  let chartTitle
  let svg, mainG, series, collabels;
  // eslint-disable-next-line
  let yAxis, yTitle, xAxis, xTitle, xLine;
  // eslint-disable-next-line
  let currCell, currRects, currRowTexts, currColTexts;
  let clusterRenderer;
  // eslint-disable-next-line
  let legendRenderer;
  let defaults; //will have key values in init
  let currseries = [];
  let unstackedBarsPanes;

  function main(_chart, _unstackedBarsPanes) {
    chart = _chart
    Object.assign(hm, chart.settings)
    hm.handlers = chart.handlers
    if (_unstackedBarsPanes) unstackedBarsPanes = _unstackedBarsPanes;
    if (!svg) init();

    const unadjustedColw = hm.colw
    setDimensions();
    currseries.map(setIds);
    chart.serieses.map(setIds);
    currseries = chart.serieses;

    chartTitle.style("width", hm.svgw + "px")
      .html(chart.chartId);
    svg.attr("height", hm.svgh);
    svg.attr("width", hm.svgw);

    mainG.attr("transform", "translate(" + hm.rowlabelw + ",0)");

    const s = series
      .attr("transform", seriesGrpTransform)
      .selectAll(".bars-cell-grp")
      .data(chart.serieses, seriesBindKey);
    s.exit().each(seriesExit);
    s.each(seriesUpdate);
    s.enter()
      .append("g")
      .each(seriesEnter);

    const c = collabels
      .attr("transform", colLabelsTransform)
      .style("display", hm.colw < 6 ? "none" : "")
      .selectAll("g")
      .data(hm.cols, returnD)
    c.exit().remove();
    c.each(updateColLabel);
    c.enter()
      .append("g")
      .each(addColLabel);

    currRects = series.selectAll("rect");
    currColTexts = collabels.selectAll("text");
    setLegend()
    hm.delay = 0.35 * hm.duration
    renderAxes(yAxis, yTitle, xTitle, hm);
    hm.colw = unadjustedColw

    setTimeout(()=>{
      const bbox = svg.node().getBBox();
      const x = bbox.width - svg.attr('width') + hm.rowlabelw
      svg.transition().duration(100)
        .attr('width', bbox.width + 20)
        .attr('height', bbox.height + 20)
      mainG.transition().duration(100)
        .attr('transform', 'translate(' + x +',0)' )
    },10)
  }

  function init() {
    defaults = {
      geneonrow: hm.geneonrow,
      nicenames: {},

      colw: hm.geneonrow
        ? Math.min(
            15,
            Math.max(
              1,
              Math.floor((document.body.clientWidth * 0.7) / hm.cols.length)
            )
          )
        : 20,
      rowh: hm.geneonrow
        ? 20
        : Math.min(
            18,
            Math.max(
              10,
              Math.floor((document.body.clientHeight * 0.7) / hm.rows.length)
            )
          ),

      rowspace: hm.geneonrow ? 2 : hm.rows.length > 100 ? 0 : 1,
      colspace: !hm.geneonrow ? 2 : hm.cols.length > 100 ? 0 : 1,

      rowtick: 8,
      coltick: 5,
      rowlabtickspace: 4,
      collabtickspace: 4,
      collabelh: 150,
      rowlabelw: 150,
      rowheadleft: true,
      colheadtop: false,

      samplecount4gene: true,
      samplecount4legend: false,

      showgrid: true,
      gridstroke: "#fff",
      showEmptyCells: false,

      cellbg: "#eeeeee",

      fontsizeratio: 0.9,
      rowlabelfontsizemax: 16,
      collabelfontsizemax: 12,
      crudefill: hm.colw <= 2,
      duration: 1000,
      delay: 0
    };

    for (let key in defaults) {
      if (!(key in hm) || key == "cols" || key == "rows")
        hm[key] = defaults[key];
    }

    if (!svg) {
      chartTitle = holder.append('div')
        .style('text-align','center')

      svg = holder
        .append("svg")
        .attr("class", "pp-bars-svg")
        .style("overflow", "visible")
        .on("mouseover.tphm2", hm.handlers.svg.mouseover)
        .on("mouseout.tphm2", hm.handlers.svg.mouseout)
        .on("click.tphm2", hm.handlers.svg.click);
    }

    mainG = svg.append("g").attr("class", "sjpcb-bars-mainG");
    hm.h.svg = svg;
    hm.h.mainG = mainG;

    collabels = mainG
      .append("g")
      .attr("class", "bars-collabels")
      .on("mouseover.tphm2", colLabelMouseover)
      .on("mouseout.tphm2", colLabelMouseout)
      .on("click.tphm2", hm.handlers.colLabel.click);

    series = mainG
      .append("g")
      .attr("class", "bars-series")
      .on("mouseover.tphm2", seriesMouseOver)
      .on("mouseout.tphm2", seriesMouseOut)
      .on("click", seriesClick);

    yAxis = mainG.append("g").attr("class", "sjpcb-bar-chart-y-axis");
    yTitle = mainG
      .append("g")
      .attr("class", "sjpcb-bar-chart-y-title")
      .style("cursor", "default");
    xAxis = mainG.append("g").attr("class", "sjpcb-bar-chart-x-axis");
    xLine = xAxis.append("line").style("stroke", "#000")
    xTitle = mainG
      .append("g")
      .attr("class", "sjpcb-bar-chart-x-title")
      .style("cursor", "default");

    //legendDiv = svg.append("g").attr("class", "sjpcb-bars-legend");
    legendRenderer = htmlLegend(
      barsapp.opts.legendDiv,
      () => {},
      {
        settings: {
          legendOrientation: 'vertical'
        }
      }
    );
  }

  function setDimensions() {
    const svgw = hm.svgw
    const spacing =
      hm.cols.length * hm.colspace +
      (hm.colgrps.length - 1) * hm.colgspace +
      hm.rowlabelw +
      hm.rowgrplabelw
    hm.colw = Math.min(
      Math.max(16, Math.round((svgw - spacing) / hm.cols.length)),
      100
    );
    hm.svgw =
      hm.cols.length * (hm.colw + hm.colspace) -
      hm.colspace +
      (hm.colgrps.length - 1) * hm.colgspace +
      hm.rowlabelw +
      hm.rowgrplabelw
    //+ hm.borderwidth
    if (!hm.svgh)
      hm.svgh = 600; /*hm.rows.length*(hm.rowh+hm.rowspace) //- hm.rowspace
        + (hm.rowgrps.length-1)*hm.rowgspace
        //+ hm.collabelh //+ hm.colgrplabelh // legendh will be added in finalizePos
        + 2*hm.borderwidth*/

    hm.h.yScale = {}
    hm.h.yPrevBySeries = {}
    const ratio =
      hm.scale == "byChart"
        ? 1
        : chart.maxSeriesTotal / chart.maxAcrossCharts;
    for (const series of chart.serieses) {
      if (series.data[0]) {
        const min = hm.unit == "log" ? 1 : 0
        const max = hm.unit == "pct" ? series.total
          : hm.unit == "log" ? chart.maxSeriesLogTotal
          : chart.maxSeriesTotal

        hm.h.yScale[series.seriesId] = scaleLinear()
          .domain([min, max / ratio])
          .range([0, hm.svgh - hm.collabelh])

        hm.h.yPrevBySeries[series.seriesId] = 0
        for(const data of series.data) {
          data.height = getRectHeight(data)
          data.y = getRectY(data)
        }
      }
    }

    hm.rowfontsize = Math.min(
      hm.rowh * hm.fontsizeratio,
      hm.rowlabelfontsizemax
    );
    hm.colfontsize = Math.min(
      hm.colw * hm.fontsizeratio,
      hm.collabelfontsizemax
    );
  }

  function setIds(series) {
    if (!('seriesId' in series)) {
      series.data.map(data => {
        if (data) series.seriesId = data[hm.serieskey];
      });
    }
    series.data.map(d => {
      d.rowId = d[hm.rowkey];
      d.colId = d[hm.colkey];
    });
  }

  function seriesBindKey(series) {
    return series.seriesId
  }

  function cellKey(d) {
    return d.rowId + " " + d.colId; //+' '+d.cellmateNum
  }

  function returnD(d) {
    return d;
  }

  function seriesExit() {
    select(this).remove();
  }

  function seriesUpdate(series) {
    const g = select(this)
      .selectAll(".bars-cell")
      .data(series.data, cellKey);

    g.exit().each(function() {
      select(this).style("display", "none");
    });

    g.style("display", d => {
      return hm.cols.includes(d.colId) ? "block" : "none";
    });

    g.select("rect")
      .transition()
      .duration(hm.duration)
      .attr("width", hm.colw)
      .attr("height", d => d.height)
      .attr("x", getRectX)
      .attr("y", d => d.y)
      .attr("fill", hm.handlers.series.rectFill);

    g.enter()
      .append("g")
      .each(addCell);
  }

  function seriesEnter(series) {
    if (!series || !series.data.length) return;
    select(this)
      .attr("class", "bars-cell-grp")
      .selectAll("g")
      .data(series.data, cellKey)
      .enter()
      .append("g")
      .each(addCell);
  }

  function addCell(d) {
    const g = select(this)
      .attr("class", "bars-cell")
      .datum(d);

    g.style("display", d => {
      //if (d.rowId=='Arrhythmias') console.log(d.colId)
      return hm.cols.includes(d.colId) ? "block" : "none";
    });

    g.append("rect")
      .attr("width", hm.colw)
      .attr("height", d => d.height)
      .attr("x", getRectX)
      .attr("y", d => d.y)
      .attr("fill", hm.handlers.series.rectFill)
      .attr("shape-rendering", "crispEdges")
      .style("opacity", 0)
      .transition()
      .delay(hm.delay)
      .duration(hm.duration)
      .style("opacity", 1);
  }

  function seriesGrpTransform() {
    let x = 1 + hm.colspace
    let y = hm.colheadtop ? hm.collabelh : hm.colgrplabelh;
    if (hm.legendontop) y += hm.legendh;
    return "translate(" + x + "," + y + ")";
  }

  function getRectHeight(d) {
    const total = hm.unit == "log" ? d.logTotal : d.total
    const height = hm.h.yScale[d.seriesId](total)
    const rowspace = 0; //Math.round(height) > 1 ? hm.rowspace : 0;
    hm.h.yPrevBySeries[d.seriesId] += height + rowspace
    return Math.max(0, height - rowspace);
  }

  function getRectX(d) { 
    const grpoffset = hm.colgrps.indexOf(d[hm.colgrpkey]) * hm.colgspace
    return hm.cols.indexOf(d.colId) * (hm.colw + hm.colspace) + grpoffset
  }

  function getRectY(d) {
    return hm.svgh - hm.collabelh - hm.h.yPrevBySeries[d.seriesId]
  }

  function colLabelsTransform() {
    let x = 5 + hm.colspace
    let y = hm.colheadtop
      ? /*hm.collabelh -*/ hm.borderwidth + 1
      : hm.svgh - hm.collabelh + 20;
    if (hm.legendontop) y += hm.legendh;
    return "translate(" + x + "," + y + ")";
  }

  function colLabelTransform(d) {
    const grp = hm.col2name[d] ? hm.col2name[d].grp : "";
    const x =
      hm.colgrps.indexOf(grp) * hm.colgspace +
      hm.cols.indexOf(d) * (hm.colw + hm.colspace) +
      hm.colw / 2;
    const y = hm.colheadtop
      ? -1 * (hm.coltick + hm.collabtickspace)
      : hm.coltick + hm.collabtickspace;
    return "translate(" + x + "," + y + ")";
  }

  function addColLabel(d) {
    if (!this || d === undefined) return;
    const g = select(this)
      .attr("transform", colLabelTransform)
      .style("opacity", 0);

    g.append("text")
      .attr("transform", "rotate(-40)")
      .attr("y", 2) //hm.colw / 3)
      .attr("text-anchor", "end")
      .attr("font-size", hm.colfontsize)
      .text(hm.handlers.colLabel.text);

    g.transition()
      .delay(hm.delay)
      .duration(hm.duration)
      .style("opacity", 1);
  }

  function updateColLabel() {
    const g = select(this);

    g.attr("transform", colLabelTransform); //.transition().duration(hm.duration)

    g.selectAll("text") //.transition().duration(hm.duration)
      //.attr('transform', 'rotate(-90)')
      .attr("y", 2) //hm.colw / 3)
      .attr("text-anchor", "end")
      .attr("font-size", hm.colfontsize)
      .text(hm.handlers.colLabel.text);
  }

  function rowTextWeight(d) {
    return d == currCell.rowId ? 700 : "";
  }

  function rowTextSize(d) {
    return d == currCell.rowId ? Math.max(12, hm.rowfontsize) : hm.rowfontsize;
  }

  function rowTextColor(d) {
    return d == currCell.rowId ? "#00f" : "";
  }

  function colTextWeight(d) {
    return d == currCell.colId ? 700 : "";
  }

  function colTextSize(d) {
    return d == currCell.colId ? 12 : hm.colfontsize;
  }

  function colTextColor(d) {
    return d == currCell.colId ? "#00f" : "";
  }

  function renderAxes(yAxis, yTitle, xTitle, s) {
    const colLabelBox = collabels.node().getBBox()
    const lineY = s.svgh - s.collabelh + 24
    xLine
    .attr("x1", 1)
    .attr("x2", s.svgw - s.svgPadding.left - hm.rowlabelw + s.cols.length*s.colspace)
    .attr("y1", lineY)
    .attr("y2", lineY)

    xTitle.selectAll("*").remove()
    const xLabel = hm.handlers.xAxis.text()
    xTitle.append("text")
      .style("text-anchor", "middle")
      .style("font-size", s.axisTitleFontSize + "px")
      .text(xLabel);

    const textBBox = xTitle.node().getBBox()
    setTimeout(()=>{
      xTitle.attr(
          "transform",
          "translate(" + 
            (s.svgw - s.svgPadding.left - s.svgPadding.right - s.rowlabelw)/2 +
            "," +
            (colLabelBox.height +
              hm.svgh -
              hm.collabelh +
              20 +
              s.axisTitleFontSize) +
            ")"
        )
    }, 0)

    const ratio =
      hm.scale == "byChart" || hm.clickedAge
        ? 1
        : chart.maxSeriesTotal / chart.maxAcrossCharts
    const min = hm.unit == "log" ? 1 : 0
    const max = hm.unit == "pct" ? 100 
      //: hm.unit == "log" ? chart.maxSeriesLogTotal
      : chart.maxSeriesTotal //maxAcrossCharts

    yAxis.call(
      axisLeft(
        (hm.unit == "log" ? scaleLog() : scaleLinear())
          .domain([max / ratio, min])
          .range([
            s.colgrplabelh,
            s.svgh - s.collabelh + s.colgrplabelh - s.borderwidth
          ])
      ).ticks(8, format('d'))
    );

    yTitle.selectAll("*").remove();
    const h = s.svgh - s.collabelh;
    yTitle
      .attr(
        "transform",
        "translate(" +
          (-s.svgPadding.left - s.axisTitleFontSize) +
          "," +
          h / 2 +
          ")rotate(-90)"
      )
      .append("text")
      .style("text-anchor", "middle")
      .style("font-size", s.axisTitleFontSize + "px")
      .text(hm.handlers.yAxis.text());
  }

  function seriesMouseOver() {
    const t =
      event.target.tagName == "tspan" ? event.target.parentNode : event.target;
    const d = t.__data__;

    if (d && t.tagName == "rect") {
      //console.log(_data_)
      //if (!hm.h.isEmptyCell(d)) {
      currCell = d;
      //if (!hm.showgrid) currRects.style('stroke', rectStroke)
      //else {
      const x = getRectX(d);
      const y = getRectY(d.cellmates ? d.cellmates[0] : d);
      if (clusterRenderer) clusterRenderer.rowcolline(d, x, y);
      //}

      currColTexts
        .attr("font-weight", colTextWeight)
        .attr("font-size", colTextSize)
        .style("fill", colTextColor);

      //resizeCaller.hide()
      //}
    } else {
      currCell = emptyObj;
      //resizeCaller.show()
      if (clusterRenderer) clusterRenderer.rowcolline();
      currRowTexts
        .attr("font-weight", rowTextWeight)
        .attr("font-size", rowTextSize)
        .style("fill", rowTextColor);
      currColTexts
        .attr("font-weight", colTextWeight)
        .attr("font-size", colTextSize)
        .style("fill", colTextColor);
    }

    hm.handlers.series.mouseover(d);
  }

  function seriesMouseOut() {
    event.stopPropagation();
    //currRowTexts.attr('font-weight','').attr('font-size',hm.rowfontsize).style('fill','')
    currColTexts
      .attr("font-weight", "")
      .attr("font-size", hm.colfontsize)
      .style("fill", "");
    //resizeCaller.show()
    currCell = emptyObj;
    if (hm.handlers.series.mouseout) hm.handlers.series.mouseout();
  }

  function colLabelMouseover() {
    const d = event.target.__data__;
    if (!d) return;
    const r = hm.col2name[d];
    const cell = { colId: r.name };
    cell[hm.colkey] = r.name;
    cell[hm.colgrpkey] = r.grp;
    //seriesMouseOver(cell)

    if (hm.handlers.colLabel.mouseover) hm.handlers.colLabel.mouseover();
  }

  function colLabelMouseout() {
    currCell = emptyObj;
    //resizeCaller.show()
    if (clusterRenderer) clusterRenderer.rowcolline();
    if (hm.handlers.colLabel.mouseout) hm.handlers.colLabel.mouseout();
  }

  function seriesClick() {
    const d = event.target.__data__
    barsapp.handlers.series.click(d)
  }

  function setLegend() {
    if (!hm.hidelegend && barsapp.terms.term2 && barsapp.term2toColor) {
      const colors = {}
      const legendData = {
        name: barsapp.terms.term2.name,
        items: hm.rows.map(d => {
          return {
            text: d,
            color: barsapp.term2toColor[d]
          }
        }).sort((a,b) => a.text < b.text ? -1 : 1)
      }
      legendRenderer([legendData]);
    }
  }

  main.hm = hm;

  main.styles = () => {
    const styles = {};
    for (const key in defaults) {
      styles[key] = hm[key];
    }
    if (clusterRenderer) {
      for (const key in clusterRenderer.defaults) styles[key] = hm[key];
    }
    if (legendRenderer) {
      for (const key in legendRenderer.defaults) styles[key] = hm[key];
    }
    return styles;
  };

  return main;
}
