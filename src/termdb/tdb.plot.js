import * as rx from "../rx.core"
import {select, event} from "d3-selection"
import {dofetch2} from "../client"
//import { TdbBarchart } from "./tdb.barchart"

class TdbPlot {
	constructor(app, holder, arg) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.id = arg.id; 
		
		this.dom = {
			holder: holder
				.style("margin-top", "-1px")
				.style("white-space", "nowrap")
				.style("overflow-x", "scroll"),

			// will hold no data notice or the page title in multichart views
			banner: holder.append("div").style("display", "none"),

			// dom.controls will hold the config input, select, button elements
			controls: holder
				.append("div")
				.attr("class", "pp-termdb-plot-controls")
				.style("display", "inline-block"),

			// dom.viz will hold the rendered view
			viz: holder
				.append("div")
				.attr("class", "pp-termdb-plot-viz")
				.style("display", "inline-block")
				.style("min-width", "300px")
				.style("margin-left", "50px")
		}

		this.config = {
			id: this.id,
			term: { term: arg.term, q: arg.term.q ? arg.term.q : {} },
			term0: arg.term0 ? { term: arg.term0, q: arg.term0.q ? arg.term0.q : {} } : null,
			term2: arg.term2
				? { term: arg.term2, q: arg.term2.q ? arg.term2.q : {} }
				//: arg.obj.modifier_ssid_barchart
				//? { mname: arg.obj.modifier_ssid_barchart.mutation_name }
				: null,
			//unannotated: arg.unannotated ? arg.unannotated : "" // not needed?
			settings: {
				currViews: ["barchart"],
				controls: {
					isVisible: false // control panel is hidden by default
				},
				common: {
					use_logscale: false, // flag for y-axis scale type, 0=linear, 1=log
					use_percentage: false,
					barheight: 300, // maximum bar length
					barwidth: 20, // bar thickness
					barspace: 2 // space between two bars
				},
				boxplot: {
					toppad: 20, // top padding
					yaxis_width: 100,
					label_fontsize: 15,
					barheight: 400, // maximum bar length
					barwidth: 25, // bar thickness
					barspace: 5 // space between two bars
				},
				bar: {
					orientation: "horizontal",
					unit: "abs",
					overlay: "none",
					divideBy: "none"
				}
			}
		}

		/*
		this.components = {
			barchart: barInit(this.app, plot.dom.viz.append('div'), this.config)
		}
		*/

		this.app.dispatch({
			type: "plot_add",
			id: this.id, 
			config: this.config
		})

		this.bus = new rx.Bus('plot', ['postInit', 'postNotify'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		return acty[0].startsWith("plot_") && action.id == this.id
	}

	main(action) {
		console.log(action)
	}
}

exports.plotInit = rx.getInitFxn(TdbPlot)
