import * as rx from '../common/rx.core'
import { Menu, dofetch3 } from '../client'
import { event } from 'd3-selection'

class ToySearch {
	constructor(app, opts) {
		this.type = 'search'
		// need to supply this.api to callbacks
		// supply optional argument to getComponentApi(),
		// so no need to attach it as an instance method
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = {
			holder: opts.holder,
			tip: new Menu({ padding: '' })
		}
		// set closured methods to use the correct "this" context
		this.yesThis()
		// this.notThis(this)
		this.render()
		this.eventTypes = ['postInit', 'postRender']
	}

	getState(appState) {
		return {
			genome: appState.genome,
			dslabel: appState.label
		}
	}

	main() {
		// clear search input entry
		this.input.property('value', '')
	}

	render() {
		this.dom.holder
			.style('width', 'fit-content')
			.style('padding', '5px')
			.style('background-color', '#ececec')
			.style('display', 'block')
			.append('div')
			.style('display', 'inline-block')

		const div = this.dom.holder
			.style('display', 'block')
			.append('div')
			.style('display', 'inline-block')

		this.input = div
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
			.on('keyup', this.displaySearchResults)

		this.input.node().focus() // always focus
	}

	/*
		To-do: reorganize into 
		setRenderers(self), setInteractivity(self) instead
	*/
	yesThis() {
		this.setTerm = () => {
			if (event.key !== 'Enter') return
			this.app.dispatch({ type: 'term_add', termid: this.input.property('value') })
		}

		this.displaySearchResults = async () => {
			const value = this.input.property('value').trim()
			if (value.length < 2) {
				this.dom.tip.hide()
				return
			}
			const o = this.app.opts
			const data = await dofetch3(
				`termdb?genome=${o.genome}&dslabel=${o.dslabel}&findterm=${value}&cohortStr=${o.cohortStr}`
			)
			// ready to show query result
			this.dom.tip.clear().showunder(this.input.node())
			if (!data.lst || data.lst.length == 0) {
				this.dom.tip.d
					.append('div')
					.style('margin', '6px')
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
				.attr('class', 'sja_menuoption')
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
			this.app.dispatch({ type: 'term_add', term })
			this.dom.tip.hide()
		}

		/*
		by having term data bound to an element,
		you can attach the same mouseover callback to 
		similar rendered elements
		
		this.showElementInfo = term => {
			this.dom.tip.clear()
			this.dom.tip.d.append('div')
				.html(term.name + '<br/>' + term....)
		}
		
		then
		
		elem.on('mouseover', this.showElementInfo)
		*/
	}
}

export const searchInit = rx.getInitFxn(ToySearch)
