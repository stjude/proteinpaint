import { getCompInit } from '../../rx'
import { Menu, dofetch3 } from '../client'
import { event } from 'd3-selection'

class ToySearch {
	constructor(opts) {
		this.type = 'search'
		this.dom = {
			holder: opts.holder,
			tip: new Menu({ padding: '' })
		}
		// set methods to handle user input/interaction
		setInteractivity(this)
		// set renderer methods that affect the DOM
		setRenderers(this)
	}

	init() {
		this.render()
	}

	getState(appState) {
		return {
			genome: appState.genome,
			dslabel: appState.label
		}
	}

	main() {
		// clear search input entry
		this.dom.input.property('value', '')
	}
}

export const searchInit = getCompInit(ToySearch)

function setRenderers(self) {
	self.render = () => {
		self.dom.holder
			.style('width', 'fit-content')
			.style('padding', '5px')
			.style('background-color', '#ececec')
			.style('display', 'block')
			.append('div')
			.style('display', 'inline-block')

		const div = self.dom.holder
			.style('display', 'block')
			.append('div')
			.style('display', 'inline-block')

		self.dom.input = div
			.append('input')
			.attr('type', 'search')
			.attr('class', 'tree_search')
			.style('width', '100px')
			.style('display', 'block')
			.attr('placeholder', 'Search')
			// Recommended: reuse an instance method as callback to
			// - avoid busy nested code blocks
			// - more clearly indicate what the callback will do
			// - avoid reparsing anonymous functions
			// - reduce risk of memory leaks, if any
			// - make it easier to test since the callback
			//   will be exposed as an api.Inner method
			.on('keyup', self.displaySearchResults)

		self.dom.input.node().focus() // always focus
	}

	self.displaySearchResults = async () => {
		const value = self.dom.input.property('value').trim()
		if (value.length < 2) {
			self.dom.tip.hide()
			return
		}
		const o = self.app.opts
		const data = await dofetch3(
			`termdb?genome=${o.genome}&dslabel=${o.dslabel}&findterm=${value}&cohortStr=${o.cohortStr}`
		)
		// ready to show query result
		self.dom.tip.clear().showunder(self.dom.input.node())
		if (!data.lst || data.lst.length == 0) {
			self.dom.tip.d
				.append('div')
				.style('margin', '6px')
				.text('No match')
			return
		}
		// reuse an instance method as callback
		// - see the reasons listed for render() {on('keyup')}
		data.lst.forEach(self.displaySuggestedTerm)
	}

	self.displaySuggestedTerm = function(term) {
		self.dom.tip.d
			.append('div')
			.datum(term)
			.text(term.name)
			.attr('class', 'sja_menuoption')
			// for short anonymous functions, it's okay
			// to keep inline, but still better to reuse
			// a class method for the same reasons given
			// in render() {on('keyup')} above
			/*
			.on('click', async ()=>{
				self.app.dispatch({type:'term_add',term})
				self.dom.tip.hide()
			})
			*/
			.on('click', self.addTermByMenuClick)
	}
}

function setInteractivity(self) {
	/*
	by having term data bound to an element,
	you can attach the same mouseover callback to 
	similar rendered elements
	
	self.showElementInfo = term => {
		self.dom.tip.clear()
		self.dom.tip.d.append('div')
			.html(term.name + '<br/>' + term....)
	}
	
	then
	
	elem.on('mouseover', self.showElementInfo)
	*/
	self.setTerm = () => {
		if (event.key !== 'Enter') return
		self.app.dispatch({ type: 'term_add', termid: self.dom.input.property('value') })
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
	self.addTermByMenuClick = term => {
		self.app.dispatch({ type: 'term_add', term })
		self.dom.tip.hide()
	}
}
