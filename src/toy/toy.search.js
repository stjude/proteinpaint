import {Component, getInitFxn} from "../rx.core"

class ToySearch extends Component {
	constructor(app, holder) {
		super()
		this.app = app
		this.dom = {holder}
		// set closured methods to use the correct "this" context
		this.yesThis()
		// this.notThis(this)
		this.render()
	}

	main(action) {
		// clear search input entry
		this.input.property('value', '')
	}

	render() {
		this.dom.holder
		.style('width', 'fit-content')
		.style('padding', '5px')
		.style('background-color', '#ececec')
		.style("display", "block")
		.append("div")
		.style("display", "inline-block")

		const div = this.dom.holder
			.style("display", "block")
			.append("div")
			.style("display", "inline-block")

		this.input = div
			.append("input")
			.attr("type", "search")
			.attr("class", "tree_search")
			.style("width", "100px")
			.style("display", "block")
			.attr("placeholder", "Search")
			.on('keydown', this.setTerm)
		
		this.input.node().focus() // always focus
	}

	yesThis() {
		this.setTerm = () => {
			if(event.key !== 'Enter') return
			this.app.dispatch({type: "term_add", termid: this.input.property('value')})
		}
	}
}

export const searchInit = getInitFxn(ToySearch)

