import { select, event } from "d3-selection";
import { scaleLinear as d3Linear } from "d3-scale";
import { axisLeft, axisBottom } from "d3-axis";
import Partjson from "../modules/partjson";
//import colorbrewer from "colorbrewer";
//import { tooltip } from "./utils.js";

//const colors = colorbrewer.Dark2[8].slice(0, 6).concat(colorbrewer.Paired[12]);

export default function scatter(opts) {
/*
  opts: {
    holder
  }

  returns self
*/
  
  const defaultSettings = {
    orderChartsBy: "organ-system", // top-burden | organ-system
    currLine: 0,
    svgw: 400,
    svgh: 400,
    svgPadding: {
      top: 10,
      left: 80,
      right: 10,
      bottom: 50
    },
    chartMargin: 5,
    chartTitleDivHt: 30,
    radius: 5,
    axisTitleFontSize: 14,
    scale: "byChart", // byGroup | byChart
    ciVisible: true,
    fillOpacity: 0.2,
    duration: 1000
  }

  // any property of self will be exposed
  const self = {
    dom: {
      div: opts.holder.append('div')
    },
    settings: Object.assign(defaultSettings, opts.settings ? opts.settings : {}),
    main: (plot, data) => {
      if (!plot.settings.currViews.includes('scatter')) {
        self.dom.div.style('display','none')
        return
      }
      self.dom.div.style('display','block')
      if (data) self.currData = data;
      self.plot = plot
      self.pj.refresh({ data: self.currData.rows })

      const chartDivs = self.dom.div
        .selectAll(".pp-scatter-chart")
        .data(self.pj.tree.charts, d => d.chartId)

      chartDivs.exit().remove();
      chartDivs.each(updateCharts);
      chartDivs.enter().each(addCharts);

      self.dom.div.on("mouseover", mouseover).on("mouseout", mouseout);
    }
  }

  self.pj = getPj(self)

  function getChartLayout(data) {
    const s = self.settings;
    const bbox = self.dom.div.node().getBoundingClientRect();
    const chartHeight = s.svgh + s.chartTitleDivHt + 4 * s.chartMargin;
    const chartWidth = s.svgw + 2 * 25 + 3 * s.chartMargin;
    const chartsPerRow = Math.floor(bbox.width / chartWidth);
    const leftOffset = (bbox.width - chartsPerRow * chartWidth) / 2;
  }

  function addCharts(d) {
    const s = self.settings;
    const div = select(this)
      .append("div")
      .attr("class", "pp-scatter-chart")
      .style("opacity", 0)
      //.style("position", "absolute")
      .style("width", s.svgw + 50 + "px")
      .style("display", "inline-block")
      .style("margin", s.chartMargin+"px")
      .style("top", 0) //layout.byChc[d.chc].top)
      .style("left", 0) //layout.byChc[d.chc].left)
      .style("text-align", "left")
      .style("border", "1px solid #eee")
      .style("box-shadow", "0px 0px 1px 0px #ccc")
      .style(
        "background",
        1 || s.orderChartsBy == "organ-system" ? d.color : ""
      );

    div
      .append("div")
      .attr("class", "sjpcb-scatter-chart-title")
      .style("text-align", "center")
      .style("width", s.svgw + 50 + "px")
      .style("height", s.chartTitleDivHt + "px")
      .style("font-weight", "600")
      .style("margin", "5px")
      .datum(d.chartId)
      .html(d.chartId)
      //.on("click", viz.chcClick);

    renderSVG(div.append("svg"), d, s, 0);

    div
      .transition()
      .duration(s.duration)
      .style("opacity", 1);
  }

  function updateCharts(d) {
    const s = self.settings;
    const div = select(this);

    div
      .transition()
      .duration(s.duration)
      .style("width", s.svgw + 50 + "px")
      //.style("top", layout.byChc[d.chc].top)
      //.style("left", layout.byChc[d.chc].left)
      .style(
        "background",
        1 || s.orderChartsBy == "organ-system" ? d.color : ""
      );

    div
      .select(".sjpcb-scatter-chart-title")
      .style("width", s.svgw + 50)
      .style("height", s.chartTitleDivHt + "px")
      .datum(d.chartId)
      .html(d.chartId);

    div
      .selectAll(".sjpcb-lock-icon")
      .style("display", s.scale == "byChart" ? "block" : "none");

    div
      .selectAll(".sjpcb-unlock-icon")
      .style("display", s.scale == "byChart" ? "none" : "block");

    renderSVG(div.select("svg"), d, s, s.duration);
  }

  function renderSVG(svg, chart, s, duration) {
    svg
      .transition()
      .duration(duration)
      .attr("width", s.svgw)
      .attr("height", s.svgh)
      .style("overflow", "visible")
      .style("padding-left", "20px");

    /* eslint-disable */
    const [mainG, axisG, xAxis, yAxis, xTitle, yTitle] = getSvgSubElems(svg);
    /* eslint-enable */
    //if (d.xVals) computeScales(d, s);

    mainG.attr(
      "transform",
      "translate(" + s.svgPadding.left + "," + s.svgPadding.top + ")"
    );
    const serieses = mainG
      .selectAll(".sjpcb-scatter-chart-series")
      .data(chart.serieses, d => (d && d[0] ? d[0].seriesId : ""));

    serieses.exit().remove();
    serieses.each(function(series, i) {
      renderSeries(select(this), chart, series, i, s, s.duration);
    });
    serieses
      .enter()
      .append("g")
      .attr("class", "sjpcb-scatter-chart-series")
      .each(function(series, i) {
        renderSeries(select(this), chart, series, i, s, duration);
      });

    renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart);
  }

  function getSvgSubElems(svg) {
    let mainG, axisG, xAxis, yAxis, xTitle, yTitle;
    if (!svg.select(".sjpcb-scatter-chart-mainG").size()) {
      mainG = svg.append("g").attr("class", "sjpcb-scatter-chart-mainG");
      axisG = mainG.append("g").attr("class", "sjpcb-scatter-chart-axis");
      xAxis = axisG.append("g").attr("class", "sjpcb-scatter-chart-x-axis");
      yAxis = axisG.append("g").attr("class", "sjpcb-scatter-chart-y-axis");
      xTitle = axisG.append("g").attr("class", "sjpcb-scatter-chart-x-title");
      yTitle = axisG.append("g").attr("class", "sjpcb-scatter-chart-y-title");
    } else {
      mainG = svg.select(".sjpcb-scatter-chart-mainG");
      axisG = mainG.select(".sjpcb-scatter-chart-axis");
      xAxis = axisG.select(".sjpcb-scatter-chart-x-axis");
      yAxis = axisG.select(".sjpcb-scatter-chart-y-axis");
      xTitle = axisG.select(".sjpcb-scatter-chart-x-title");
      yTitle = axisG.select(".sjpcb-scatter-chart-y-title");
    }
    return [mainG, axisG, xAxis, yAxis, xTitle, yTitle];
  }

  function renderSeries(g, chart, series, i, s, duration) {
    // remove all circles as there is no data id for privacy
    g.selectAll("circle").remove()

    const circles = g.selectAll("circle").data(series.data, b => b.x);

    circles.exit().remove();

    circles
      .transition()
      .duration(duration)
      .attr("r", s.radius)
      .attr("cx", c => c.scaledX)
      .attr("cy", c => c.scaledY)
      //.style("fill", color)
      .style("fill-opacity", s.fillOpacity)
      //.style("stroke", color);

    circles
      .enter()
      .append("circle")
      .attr("r", s.radius)
      .attr("cx", c => c.scaledX)
      .attr("cy", c => c.scaledY)
      //.style("opacity", 0)
      //.style("fill", color)
      .style("fill-opacity", s.fillOpacity)
      //.style("stroke", color)
      .transition()
      .duration(duration);
  }

  function renderAxes(xAxis, xTitle, yAxis, yTitle, s, d) {
    xAxis
      .attr(
        "transform",
        "translate(0," + (s.svgh - s.svgPadding.top - s.svgPadding.bottom) + ")"
      )
      .call(axisBottom(d.xScale).ticks(5));

    yAxis.call(
      axisLeft(
        d3Linear()
          .domain(d.yScale.domain())
          .range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
      ).ticks(5)
    );

    xTitle.select("text, title").remove();
    const xTitleLabel = self.plot.term.name.length > 24 ? self.plot.term.name.slice(0,20) + "..." : self.plot.term.name
    const xText = xTitle
      .attr(
        "transform",
        "translate(" +
          (s.svgw - s.svgPadding.left - s.svgPadding.right) / 2 +
          "," +
          (s.svgh - s.axisTitleFontSize) +
          ")"
      )
      .append("text")
      .style("text-anchor", "middle")
      .style("font-size", s.axisTitleFontSize + "px")
      .text(xTitleLabel + (self.plot.term.unit ? ', '+ self.plot.term.unit : ''));

    xText.append('title').text(self.plot.term.name)


    const yTitleLabel = self.plot.term2.name.length > 24 ? self.plot.term2.name.slice(0,20) + "..." : self.plot.term2.name
    yTitle.select("text, title").remove();
    const yText = yTitle
      .attr(
        "transform",
        "translate(" +
          (-s.svgPadding.left / 2 - s.axisTitleFontSize) +
          "," +
          (s.svgh - s.svgPadding.top - s.svgPadding.bottom) / 2 +
          ")rotate(-90)"
      )
      .append("text")
      .style("text-anchor", "middle")
      .style("font-size", s.axisTitleFontSize + "px")
      .text(yTitleLabel + (self.plot.term2.unit ? ', '+ self.plot.term2.unit : ''));

    yText.append('title').text(self.plot.term2.name)
  }

  function mouseover() {
    if (event.target.tagName == "circle") {
      const d = event.target.__data__
      const rows = [
        `<tr><td style='padding:3px; color:#aaa'>X:</td><td style='padding:3px; text-align:center'>${d.x}</td></tr>`,
        `<tr><td style='padding:3px; color:#aaa'>Y:</td><td style='padding:3px; text-align:center'>${d.y}</td></tr>`
      ]
      self.plot.tip.show(event.clientX, event.clientY).d.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`);
    } 
    else {
      self.plot.tip.hide();
    }
  }

  function mouseout() {
    self.plot.tip.hide();
  }

  return self;
}


function getPj(self) {
  const s = self.settings

  const pj = new Partjson({
    template: {
      //"__:charts": "@.byChc.@values",
      yMin: ">$val2",
      yMax: "<$val2",
      charts: [{
        chartId: "@key",
        chc: "@key",
        xMin: ">$val1",
        xMax: "<$val1",
        yMin: ">$val2",
        yMax: "<$val2",
        "__:xScale": "=xScale()",
        "__:yScale": "=yScale()",
        serieses: [{
          chartId: "@parent.@parent.@key",
          seriesId: "@key",
          data: [{
            "__:chc": "@parent.@parent.chc",
            "__:seriesId": "@parent.@parent.seriesId",
            //color: "$color",
            x: "$val1",
            y: "$val2",
            "_1:scaledX": "=scaledX()",
            "_1:scaledY": "=scaledY()"
          }, "$val2"],
        }, "-"], 
      }, "$val0"],
    },
    "=": {
      xScale(row, context) {
        return d3Linear()
          .domain([context.self.xMin, context.self.xMax])
          .range([0, s.svgw - s.svgPadding.left - s.svgPadding.right]);
      },
      scaledX(row, context) { 
        return context.context.context.context.parent.xScale(context.self.x)
      },
      scaledY(row, context) {
        return context.context.context.context.parent.yScale(context.self.y)
      },
      yScale(row, context) {
        const yMax = context.self.yMax
        const domain = s.scale == "byChart"
            ? [yMax, 0]
            : [context.root.yMax, 0];
        return d3Linear()
          .domain(domain)
          .range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom]);
      }
    }
  });

  return pj;
}


