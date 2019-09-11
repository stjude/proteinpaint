import * as client from "./client"
import { event as d3event } from "d3-selection"
import { scaleLinear, scaleLog, scaleOrdinal, schemeCategory10, schemeCategory20 } from "d3-scale"
import { format as d3format } from "d3-format"
import { axisLeft } from "d3-axis"

// init is similar to a Class constructor
// in that it returns an object "instance"
export function init(holder) {
	/*
  holder: a d3 selection
*/
	const svg = holder
		.append("svg")
		//.style('margin-left', '20px')
		.style("margin-right", "20px")
	const self = {
		dom: {
			svg,
			yaxis_g: svg.append("g"), // for y axis
			graph_g: svg.append("g") // for bar and label of each data item
		},
		// main() remembers the self "instance" via closure
		// so that self does not need to be passed to it
		// as an argument
		main(plot, data) {
			self.plot = plot
			const isVisible = plot.settings.currViews.includes("boxplot")
			if (!isVisible) {
				self.dom.svg.style("display", "none")
				return
			}
			processData(self, plot, data)
		},
		download() {
			if (!this.plot.settings.currViews.includes("boxplot")) return
			const svg_name = self.plot.term.term.name + " boxplot"
			client.to_svg(self.dom.svg.node(), svg_name, { apply_dom_styles: true })
		}
	}
	return self
}

function processData(self, plot, data) {
	const column_keys = data.refs.rows
	let binmax = 0
	const lst = data.refs.cols.map(t1 => {
		const d = data.charts[0].serieses.find(d => d.seriesId == t1)
		if (!d) return null
		if (binmax < d.max) binmax = d.max
		return {
			label: t1,
			vvalue: t1,
			value: d.total,
			boxplot: d.boxplot
		}
	})
	render(self, plot, lst.filter(d => d != null), binmax)
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
	self.dom.svg.style("display", "inline-block")
	const max_label_height = get_max_labelheight(self, plot, s)

	// space for boxplot
	// let box_plot_space = (plot.boxplot) ?  30 : 4
	const box_plot_space = 4
	// define svg height and width
	const svg_width = plot.items.length * (s.barwidth + s.barspace) + s.yaxis_width
	const svg_height = s.toppad + s.barheight + max_label_height + box_plot_space
	self.y_scale = scaleLinear()
		.domain([s.yscale_max, 0])
		.range([0, s.barheight])

	self.dom.svg
		.transition()
		.attr("width", svg_width)
		.attr("height", svg_height)

	// Y axis
	self.dom.yaxis_g
		.attr("transform", "translate(" + (s.yaxis_width - 2) + "," + s.toppad + ")")
		.transition()
		.call(
			axisLeft()
				.scale(self.y_scale)
				// .tickFormat(d3format('d'))
				.ticks(10, d3format("d"))
		)

	client.axisstyle({
		axis: self.dom.yaxis_g,
		showline: true,
		fontsize: s.barwidth * 0.8,
		color: "black"
	})

	// if is stacked-bar, need to get color mapping for term2 values
	let term2valuecolor
	if (plot.items[0].lst) {
		// may need a better way of deciding if it is two-term crosstabulate
		// to get all values for term2
		const term2values = new Set()
		for (const i of plot.items) {
			for (const j of i.lst) {
				term2values.add(j.label)
			}
		}
		if (term2values.size > 10) {
			term2valuecolor = scaleOrdinal(schemeCategory20)
		} else {
			term2valuecolor = scaleOrdinal(schemeCategory10)
		}
	}

	// plot each bar
	let x = s.yaxis_width + s.barspace + s.barwidth / 2

	self.dom.graph_g
		.attr("transform", "translate(" + x + "," + (s.toppad + s.barheight) + ")")
		.selectAll("*")
		.remove()

	plot.items.forEach((item, itemidx) => {
		if (!item.boxplot) return
		const g = self.dom.graph_g
			.append("g")
			.datum(item)
			.attr("transform", "translate(" + itemidx * (s.barwidth + s.barspace) + ",0)")

		// X axis labels
		const xlabel = g
			.append("text")
			.text(item.label)
			.attr("transform", "translate(0," + box_plot_space + ") rotate(-65)")
			.attr("text-anchor", "end")
			.attr("font-size", s.label_fontsize)
			.attr("font-family", client.font)
			.attr("dominant-baseline", "central")

		let x_lab_tip = ""

		//this is for boxplot for 2nd numerical term
		if ("w1" in item.boxplot) {
			g.append("line")
				.attr("x1", 0)
				.attr("y1", self.y_scale(item.boxplot.w1) - s.barheight)
				.attr("x2", 0)
				.attr("y2", self.y_scale(item.boxplot.w2) - s.barheight)
				.attr("stroke-width", 2)
				.attr("stroke", "black")

			g.append("rect")
				.attr("x", -s.barwidth / 2)
				.attr("y", self.y_scale(item.boxplot.p75) - s.barheight)
				.attr("width", s.barwidth)
				.attr(
					"height",
					s.barheight -
						self.y_scale(sc.use_logscale ? item.boxplot.p75 / item.boxplot.p25 : item.boxplot.p75 - item.boxplot.p25)
				)
				.attr("fill", "#901739")
				.on("mouseover", () => {
					plot.tip
						.clear()
						.show(d3event.clientX, d3event.clientY)
						.d.append("div")
						.html(
							`<table class='sja_simpletable'>
                <tr>
                  <td style='padding: 3px; color:#aaa'>${plot.term.term.name}</td>
                  <td style='padding: 3px'>${item.label}</td>
                </tr>
                <tr>
                  <td style='padding: 3px; color:#aaa'>Mean</td>
                  <td style='padding: 3px'>${item.boxplot.mean.toPrecision(4)}</td>
                </tr>
                <tr>
                  <td style='padding: 3px; color:#aaa'>Median</td>
                  <td style='padding: 3px'>${item.boxplot.p50.toPrecision(4)}</td>
                </tr>
                <tr>
                  <td style='padding: 3px; color:#aaa'>1st to 3rd Quartile</td>
                  <td style='padding: 3px'>${item.boxplot.p25.toPrecision(4)} to ${item.boxplot.p75.toPrecision(4)}</td>
                </tr>
                <tr>
                  <td style='padding: 3px; color:#aaa'>Std. Deviation</td>
                  <td style='padding: 3px'>${item.boxplot.sd.toPrecision(4)}</td>
                </tr>
              </table>`
						)
				})
				.on("mouseout", () => {
					plot.tip.hide()
				})

			g.append("line")
				.attr("x1", -s.barwidth / 2.2)
				.attr("y1", self.y_scale(item.boxplot.w1) - s.barheight)
				.attr("x2", s.barwidth / 2.2)
				.attr("y2", self.y_scale(item.boxplot.w1) - s.barheight)
				.attr("stroke-width", 2)
				.attr("stroke", "black")

			g.append("line")
				.attr("x1", -s.barwidth / 2.2)
				.attr("y1", self.y_scale(item.boxplot.p50) - s.barheight)
				.attr("x2", s.barwidth / 2.2)
				.attr("y2", self.y_scale(item.boxplot.p50) - s.barheight)
				.attr("stroke-width", 1.5)
				.attr("stroke", "white")

			g.append("line")
				.attr("x1", -s.barwidth / 2.2)
				.attr("y1", self.y_scale(item.boxplot.w2) - s.barheight)
				.attr("x2", s.barwidth / 2.2)
				.attr("y2", self.y_scale(item.boxplot.w2) - s.barheight)
				.attr("stroke-width", 2)
				.attr("stroke", "black")
		}

		for (const outlier of item.boxplot.out) {
			g.append("circle")
				.attr("cx", 0)
				.attr("cy", self.y_scale(outlier.value) - s.barheight)
				.attr("r", 2)
				.attr("fill", "#901739")
				.on("mouseover", () => {
					plot.tip
						.clear()
						.show(d3event.clientX, d3event.clientY)
						.d.append("div")
						.html(plot.term2.term.name + " " + outlier.value.toPrecision(4))
				})
				.on("mouseout", () => {
					plot.tip.hide()
				})
		}
		// x-label tooltip
		if (item.lst) {
			xlabel
				.on("mouseover", () => {
					plot.tip
						.clear()
						.show(d3event.clientX, d3event.clientY)
						.d.append("div")
						.html(plot.term.term.name + ": " + item.label + "<br>" + "# patients: " + item.value + "<br>" + x_lab_tip)
				})
				.on("mouseout", () => {
					plot.tip.hide()
				})
		} else {
			xlabel
				.on("mouseover", () => {
					plot.tip
						.clear()
						.show(d3event.clientX, d3event.clientY)
						.d.append("div")
						.html(plot.term.term.name + ": " + item.label + "<br>" + "# patients: " + item.value)
				})
				.on("mouseout", () => {
					plot.tip.hide()
				})
		}
	})
}

function get_max_labelheight(self, plot, s) {
	let textwidth = 0
	for (const i of plot.items) {
		self.dom.svg
			.append("text")
			.text(i.label)
			.attr("font-family", client.font)
			.attr("font-size", s.label_fontsize)
			.each(function() {
				textwidth = Math.max(textwidth, this.getBBox().width)
			})
			.remove()
	}

	return textwidth
}
