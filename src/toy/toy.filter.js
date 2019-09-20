import {Component, getInitFxn} from "../rx.core"
import {select} from "d3-selection"

class ToyFilter extends Component {
	constructor(app, holder) {
		super()
		this.app = app
		this.dom = {holder}
		// set closured methods to use the correct "this" context
		this.yesThis()
		this.notThis(this)
		this.render()
	}

	reactsTo(action, acty) {
		if (acty[0] == "term") return true
	}

	main(action) {
		const rows = this.dom.holder.selectAll('.row_div')
			.data(this.app.state().controls.rows, this.getRowName)

		rows.exit().remove()
		rows.each(this._updateRow)
		rows.enter()
			.append('div')
			.attr('class', 'row_div')
			.each(this._addRow)
	}

	render() {
		const div = this.dom.holder
		.attr('class','filter_div')
		.style('width', 'fit-content')
		.style('padding', '5px')
		.style('margin-top', '5px')
		.style("display", "block")
		.style('font-size','.9em')
		.style("border", "solid 1px #ddd")

		div.append("div")
			.style("display", "inline-block")
			.style('text-transform', 'uppercase')
			.style('color','#bbb')
			.style('margin-right','10px')
			.html('Rows')
	}

	addRow(row, div) {
		div.style('display','inline-block')
			.style('position', 'relative')
			.style('margin', '5px')
			.style('padding', '3px')

		const label = div.append('label')
			.attr('class','checkbox-inline')
			
		this.input = label.append('input')
			.attr('type','checkbox')
			.datum(row)
			.attr('value',row.name)
			.property("checked", row.hide? false:true)
			.on('click', this.hideRow)

		label
			.append("span")
			.datum(row)
			.style('margin', '5px')
			.text(row.name)
	}

	updateRow(row,div){
		const label = div.select('label').datum(row)

		this.input = label
			.select('input').property("checked", row.hide? false:true)
			.on('click', this.hideRow)
		
		label.select('span').text(row.name)
	}

	getRowName(row) {
		return row.name
	}

	yesThis() {
		this.hideRow = row => this.app.dispatch({type: "term_row_hide", row_name: row.name})
	}

	notThis(self){
		self._addRow = function(row) {
			self.addRow(row, select(this))
		}
		self._updateRow = function(row) {
			self.updateRow(row, select(this))
		}
	}
}

export const filterInit = getInitFxn(ToyFilter)

