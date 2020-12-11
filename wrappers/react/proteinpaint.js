import { runproteinpaint } from '../../src/app'
import { deepEqual } from '../../src/common/rx.core'

export default function getPpComponent(React) {
	return class ProteinPaint extends React.Component {
		constructor(props) {
			super(props)
			this.state = { data: JSON.parse(localStorage.getItem(this.props.dataKey)) }
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
			return React.createElement('div', { ref: 'ppHolderRef' }, '')
		}
		runpp() {
			const data = JSON.parse(localStorage.getItem(this.props.dataKey))
			if (deepEqual(data, this.data)) return
			this.data = data
			const pp_holder = this.refs.ppHolderRef.querySelector('.sja_root_holder')
			if (pp_holder) pp_holder.remove()
			runproteinpaint(
				Object.assign({ holder: this.refs.ppHolderRef, noheader: true, nobox: true }, JSON.parse(JSON.stringify(data)))
			)
		}
	}
}
