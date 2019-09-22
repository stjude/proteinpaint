import {rx, getInitFxn} from "../rx.core"
import {Menu,dofetch2} from '../client'
import {event} from 'd3-selection'

class ToySearch {
	constructor(app, holder) {
		this.getApi = rx.getComponentApi
		this.app = app
		this.dom = {
			holder,
			tip:new Menu({padding:''}),
		}
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
		// Recommended: reuse an instance method as callback to
		// - avoid busy nested code
		// - more clearly indicate what the callback will do
		// - avoid reparsing anonymous functions
		// - reduce risk of memory leaks, if any
		.on('keyup', this.displaySearchResults)

		this.input.node().focus() // always focus
	}

	yesThis() {
		this.setTerm = () => {
			if(event.key !== 'Enter') return
			this.app.dispatch({type: "term_add", termid: this.input.property('value')})
		}

		this.displaySearchResults = async ()=>{
			const value = this.input.property('value').trim()
			if (value.length<2) {
				this.dom.tip.hide()
				return
			}
			const data = await dofetch2(
				'termdb?genome='+this.app.opts.genome
				+'&dslabel='+this.app.opts.dslabel
				+'&findterm='+value
			)
			// ready to show query result
			this.dom.tip.clear()
				.showunder( this.input.node() )
			if(!data.lst || data.lst.length==0) {
				this.dom.tip.d.append('div')
				.style('margin','6px')
				.text('No match')
				return
			}
			// reuse an instance method as callback 
			// - see the reasons listed for render() {on('keyup')}
			data.lst.forEach(this.displaySuggestedTerm)
		}

		this.displaySuggestedTerm = term => {
			this.dom.tip.d
			.append('div')
			.datum(term)
			.text(term.name)
			.attr('class','sja_menuoption')
			// for short anonymous functions, it's okay
			// to keep inline, but still better to reuse
			// a class method for the same reasons given
			// in render() {on('keyup')} above
			/*
			.on('click', async ()=>{
				this.app.dispatch({type:'term_add',term})
				this.dom.tip.hide()
			})
			*/
			.on('click', this.addTermByMenuClick)
		}

		// reference to specific term data,
		// as a callback argument, is made
		// possible by the line .datum(term) 
		// in displaySuggestedTerm
		// 
		// By using d3 to bind data to a DOM element,
		// it gives one more troubleshooting tool via dev tools, 
		// via right click on element
		// -> click "Inspect" 
		// -> Elements tab 
		// -> Properties 
		// -> click corrsponding tag name
		// -> scroll all the way down to see __data__ key
		// -> click __data__ to see the bound term data
		this.addTermByMenuClick = term => {
			this.app.dispatch({type:'term_add',term})
			this.dom.tip.hide()
		}
	}

	notThis(self) {
		self
	}
}

export const searchInit = getInitFxn(ToySearch)
