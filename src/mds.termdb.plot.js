import * as client from "./client"
import * as common from "./common"
import { TermdbBarchart } from "./mds.termdb.barchart"
import { init as table_init } from "./mds.termdb.table"
import { init as boxplot_init } from "./mds.termdb.boxplot"
import { init as stattable_init } from "./mds.termdb.stattable"
import scatter from "./mds.termdb.scatter"
import { init as controls_init } from "./mds.termdb.plot.controls"
import { to_parameter as tvslst_to_parameter } from "./mds.termdb.termvaluesetting.ui"

/*
THE PLOT OBJECT

.term{}
.term0{}
.term1{}
.main()

.bus{}

*/

export function init(arg) {
	/*
arg: 
.obj      required, tree-object
.genome   required
.dslabel  required
.term     required, term to be rendered as bars
.holder   required, dom element to hold the control panel and rendered views

+ see the overridable key-values of the plot object below
*/

	// initiating the plot object
	const plot = {
		// main() is the gatekeeper function to protect the shared state
		// among the different views and controls
		main(updatedKeyVals = {}) {
			nestedUpdate(plot, null, updatedKeyVals)
			coordinateState(plot)
			if (!plot.obj.expanded_term_ids.includes(plot.term.term.id)) return
			requestData(plot)
		},
		tip: new client.Menu({ padding: "18px" })
	}

	plot.bus = client.get_event_bus(["postRender"], arg.obj.callbacks.plot, plot)

	// fill-in the REQUIRED argument keys
	Object.assign(plot, {
		obj: arg.obj,
		genome: arg.genome,
		dslabel: arg.dslabel,
		term: { term: arg.term, q: arg.term.q ? arg.term.q : {} },
		// set the parent DOM elements for viz and controls
		dom: {
			holder: arg.holder
				.style("margin-top", "-1px")
				.style("white-space", "nowrap")
				.style("overflow-x", "scroll"),

			// will hold no data notice or the page title in multichart views
			banner: arg.holder.append("div").style("display", "none"),

			// dom.controls will hold the config input, select, button elements
			controls: arg.holder
				.append("div")
				.attr("class", "pp-termdb-plot-controls")
				.style("display", "inline-block"),

			// dom.viz will hold the rendered view
			viz: arg.holder
				.append("div")
				.attr("class", "pp-termdb-plot-viz")
				.style("display", "inline-block")
				.style("min-width", "300px")
				.style("margin-left", "50px")
		}
	})

	// fill-in the OPTIONAL argument keys
	Object.assign(plot, {
		// data
		term0: arg.term0 ? { term: arg.term0, q: arg.term0.q ? arg.term0.q : {} } : null,
		term2: arg.term2
			? { term: arg.term2, q: arg.term2.q ? arg.term2.q : {} }
			: arg.obj.modifier_ssid_barchart
			? { mname: arg.obj.modifier_ssid_barchart.mutation_name }
			: null,
		unannotated: arg.unannotated ? arg.unannotated : ""
	})

	// namespaced configuration settings to indicate
	// the scope affected by a setting key-value
	// set the default settings
	plot.settings = {
		// currViews: ["barchart" | "table" | "boxplot"]
		// + auto-added ["stattable"] if barchart && plot.term.isfloat or .isinteger
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

	// override the default settings if arg.settings key-values are supplied
	if (arg.settings && typeof arg.settings == "object") {
		for (const key in arg.settings) {
			const val = arg.settings[key]
			if (!val || Array.isArray(val) || typeof val !== "object") plot.settings[key] = val
			else Object.assign(plot.settings[key], val)
		}
	}

	// set view functions or objects
	plot.components = {
		controls: controls_init({
			plot,
			holder: plot.dom.controls,
			isVisible: plot.settings.controls.isVisible
		}),
		banner: banner_init(plot.dom.banner),
		barchart: new TermdbBarchart({
			holder: plot.dom.viz,
			settings: {},
			term1: arg.term,
			obj: arg.obj
		}),
		boxplot: boxplot_init(plot.dom.viz),
		stattable: stattable_init(plot.dom.viz),
		table: table_init(plot.dom.viz),
		scatter: scatter({ holder: plot.dom.viz })
	}
	plot.main()
	return plot
}

/* note for rewrite
function reactsTo(action) {
	const prefix = action.split("_")
	if (prefix == 'termfilter') return true
	if (prefix != 'plot') return false
  if (app.state.syncPlots == true) return true
	// id == index of plot in app.state.plots[]
	if (action.id == plot.id) return true
	return false
}
*/

function nestedUpdate(obj, key, value, keylineage = []) {
	const maxDepth = 7 // harcoded maximum depth allowed for processing nested object values
	if (keylineage.length >= maxDepth) {
		obj[key] = value
	} else if (key == "term" || key == "term2" || key == "term0") {
		if (!value) obj[key] = value
		else if (typeof value == "object") {
			obj[key] = {}
			if (value.term) obj[key].term = Object.assign({}, value.term)
			if (value.q) obj[key].q = Object.assign({}, value.q)
		}
	} else if (key !== null && (!value || typeof value != "object")) {
		obj[key] = value
	} else {
		for (const subkey in value) {
			nestedUpdate(key == null ? obj : obj[key], subkey, value[subkey], keylineage.concat(subkey))
		}
	}
}

function coordinateState(plot) {
	/*
  Enforce the coordinated updates of interdependent state key-values
*/
	if (plot.term2) {
		if (plot.settings.currViews.includes("boxplot")) {
			if (!plot.term2.term.isfloat) plot.settings.currViews = ["barchart"]
		}

		if (plot.term2.term.iscondition) {
			if (plot.term2.q && plot.term2.term.id == plot.term.term.id) {
				if (
					(plot.term2.q.bar_by_children && (!plot.term.q || !plot.term.q.bar_by_grade)) ||
					(plot.term2.q.bar_by_grade && (!plot.term.q || !plot.term.q.bar_by_children))
				)
					plot.term2 = undefined
			}

			if (plot.term2 && plot.term2.term.id == plot.term.term.id) {
				if (!plot.term2.q) plot.term2.q = {}
				for (const param of ["value_by_max_grade", "value_by_most_recent", "value_by_computable_grade"]) {
					delete plot.term2.q[param]
					if (plot.term.q[param]) plot.term2.q[param] = 1
				}
			}
		}

		if (plot.settings.currViews.includes("scatter")) {
			if (!plot.term.term.isfloat || !plot.term2.term.isfloat) {
				plot.settings.currViews = ["barchart"]
			}
		}
	} else if (!plot.settings.currViews.length) {
		// allow empty view
	} else if (!plot.settings.currViews.includes("barchart")) {
		plot.settings.currViews = ["barchart"]
	}

	const i = plot.settings.currViews.indexOf("stattable")
	if (i == -1) {
		if (plot.settings.currViews.includes("barchart") && plot.term.term.isfloat /*|| plot.term.term.isinteger*/) {
			// FIXME invalid assumption of not showing stattable for isinteger term;
			// solution is to detect .nostattable from a numeric term: if true, no table; otherwise, always show table
			plot.settings.currViews.push("stattable")
		}
	} else if (
		!plot.settings.currViews.includes("barchart") ||
		!plot.term.term.isfloat /*&& !plot.term.term.isinteger*/
	) {
		plot.settings.currViews.splice(i, 1)
	}
}

// the same route + request payload/URL parameters
// should produce the same response data, so the
// results of the server request can be cached in the
// client
const serverData = {}

function requestData(plot) {
	const dataName = getDataName(plot)
	if (serverData[dataName]) {
		syncParams(plot, serverData[dataName])
		render(plot, serverData[dataName])
	} else {
		const route = plot.settings.currViews.includes("scatter") ? "/termdb" : "/termdb-barsql"
		// TODO may use await, any benefit?
		client.dofetch2(route + dataName, {}, plot.obj.do_query_opts).then(chartsData => {
			serverData[dataName] = chartsData
			syncParams(plot, serverData[dataName])
			render(plot, chartsData)
		})
	}
}

// creates URL search parameter string, that also serves as
// a unique request identifier to be used for caching server response
function getDataName(plot) {
	const obj = plot.obj
	const params = ["genome=" + obj.genome.name, "dslabel=" + (obj.dslabel ? obj.dslabel : obj.mds.label)]

	const isscatter = plot.settings.currViews.includes("scatter")
	if (isscatter) params.push("scatter=1")
	;["term", "term2", "term0"].forEach(_key => {
		// "term" on client is "term1" at backend
		const term = plot[_key]
		if (!term) return
		const key = _key == "term" ? "term1" : _key
		params.push(key + "_id=" + encodeURIComponent(term.term.id))
		if (isscatter) return
		if (term.term.iscondition && !term.q) term.q = {}
		if (term.q && typeof term.q == "object") {
			let q = {}
			if (term.term.iscondition) {
				q = Object.keys(term.q).length ? Object.assign({}, term.q) : { bar_by_grade: 1, value_by_max_grade: 1 }
			}
			if (term.q.binconfig) {
				q = Object.assign({}, term.q)
				delete q.binconfig.results
			}
			params.push(key + "_q=" + encodeURIComponent(JSON.stringify(q)))
		}
	})

	if (!isscatter) {
		if (obj.modifier_ssid_barchart) {
			params.push(
				"term2_is_genotype=1",
				"ssid=" + obj.modifier_ssid_barchart.ssid,
				"mname=" + obj.modifier_ssid_barchart.mutation_name,
				"chr=" + obj.modifier_ssid_barchart.chr,
				"pos=" + obj.modifier_ssid_barchart.pos
			)
		}
	}

	if (obj.termfilter && obj.termfilter.terms && obj.termfilter.terms.length) {
		params.push("tvslst=" + encodeURIComponent(JSON.stringify(tvslst_to_parameter(obj.termfilter.terms))))
	}

	return "?" + params.join("&")
}

function syncParams(plot, data) {
	if (!data || !data.refs) return
	for (const [i, key] of ["term0", "term", "term2"].entries()) {
		const term = plot[key]
		if (!term || term == "genotype") continue
		term.bins = data.refs.bins[i]
		if (data.refs.q && data.refs.q[i]) {
			if (!term.q) term.q = {}
			const q = data.refs.q[i]
			if (q !== term.q) {
				for (const key in term.q) delete term.q[key]
				Object.assign(term.q, q)
			}
		}
	}
	// when the server response includes default parameters
	// that was not in the request parameters, the dataName
	// will be different even though the plot state is technically
	// the same except now with explicit defaults. So store
	// the response data under the alternative dataname
	// that includes the defaults.
	const altDataName = getDataName(plot)
	if (!(altDataName in serverData)) {
		serverData[altDataName] = data
	}
}

function render(plot, data) {
	for (const name in plot.components) {
		plot.components[name].main(plot, data)
	}
	plot.bus.emit("postRender")
}

function banner_init(div) {
	div.style("text-align", "center").style("padding", "10px")

	return {
		main(plot, data) {
			if (!data || ((!data.charts || !data.charts.length) && !data.rows)) {
				div.html("No data to display.").style("display", "block")
			} else {
				div.style("display", "none")
			}
		}
	}
}
