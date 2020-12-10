import React from 'react'
import { runproteinpaint } from '../../src/app'

export default class ProteinPaint extends React.Component {
	constructor(props) {
		super(props)
		this.state = { data: JSON.parse(localStorage.getItem(this.props.dataKey)) }
		this.ppHolderRef = React.createRef()
	}
	componentDidMount() {
		const pp_holder = this.ppHolderRef.current
		this.runpp(pp_holder)
	}
	static getDerivedStateFromProps(props) {
		return { data: JSON.parse(localStorage.getItem(props.dataKey)) }
	}
	shouldComponentUpdate(nextProps, nextState) {
		return (
			this.state.data.gene != nextState.data.gene || this.state.data.tracks[0].set_id != nextState.data.tracks[0].set_id
		)
	}
	componentDidUpdate() {
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
		const ppdata = JSON.parse(JSON.stringify(this.state.data))
		// console.log(29, ppdata)
		runproteinpaint(Object.assign({ holder, noheader: true, nobox: true }, ppdata))
	}
}
