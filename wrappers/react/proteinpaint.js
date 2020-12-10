import React from 'react'
import { runproteinpaint } from '../../src/app'
import { deepEqual } from '../../src/common/rx.core'

export default class ProteinPaint extends React.Component {
	constructor(props) {
		super(props)
		this.state = { data: JSON.parse(localStorage.getItem(this.props.dataKey)) }
		this.ppHolderRef = React.createRef()
	}
	componentDidMount() {
		this.runpp()
	}
	static getDerivedStateFromProps(props) {
		return { data: JSON.parse(localStorage.getItem(props.dataKey)) }
	}
	componentDidUpdate() {
		this.runpp()
	}
	render() {
		return (
			<div style={{ display: 'block' }}>
				<div ref={this.ppHolderRef} />
			</div>
		)
	}
	runpp() {
		const data = JSON.parse(localStorage.getItem(this.props.dataKey))
		if (deepEqual(data, this.data)) return
		this.data = data
		const pp_holder = this.ppHolderRef.current.querySelector('.sja_root_holder')
		if (pp_holder) pp_holder.remove()
		runproteinpaint(
			Object.assign({ holder: this.ppHolderRef.current, noheader: true, nobox: true }, JSON.parse(JSON.stringify(data)))
		)
	}
}
