import React from 'react'
import { runproteinpaint } from '../../src/app'

export default class ProteinPaint extends React.Component {
	constructor(props) {
		super(props)
		this.state = {}
		this.ppHolderRef = React.createRef()
	}
	componentDidMount() {
		const pp_holder = this.ppHolderRef.current
		this.runpp(pp_holder)
	}
	componentDidUpdate() {
		if (this.state.set_id_editing) return
		const pp_holder = this.ppHolderRef.current
		pp_holder.querySelector('.sja_root_holder').remove()
		this.runpp(pp_holder)
	}
	render() {
		return (
			<div style={{ display: 'block' }}>
				<div ref={this.ppHolderRef} />
			</div>
		)
	}
	runpp(holder) {
		const data = JSON.parse(localStorage.getItem(this.props.dataKey))
		console.log(26, data.gene)
		runproteinpaint(Object.assign({ holder, noheader: true, nobox: true }, data))
	}
}
