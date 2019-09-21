import {Component, getInitFxn} from "../rx.core"
import {Menu,dofetch2} from '../client'
import {event} from 'd3-selection'

class ToySearch extends Component {
	constructor(app, holder) {
		super()
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
		.on('keyup', async ()=>{
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
			data.lst.forEach( term=> {
				this.dom.tip.d
				.append('div')
				.text(term.name)
				.attr('class','sja_menuoption')
				.on('click', async ()=>{
					this.app.dispatch({type:'term_add',term})
					this.dom.tip.hide()
				})
			})
		})

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
