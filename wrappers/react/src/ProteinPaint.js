import { runproteinpaint } from '../../../src/app'
import { deepEqual } from '../../../src/common/rx.core'
import { getLolliplotData } from './gdc.views'

export function getPpComponent(React) {
	return class ProteinPaint extends React.Component {
		constructor(props) {
			super(props)
			this.state = {}
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
			// avoid jsx syntax to simplify bundling requirements
			return React.createElement('div', { ref: 'ppHolderRef' }, '')
		}
		runpp() {
			const data = this.getData()
			if (deepEqual(data, this.currentData)) return
			this.currentData = data
			const pp_holder = this.refs.ppHolderRef.querySelector('.sja_root_holder')
			if (pp_holder) pp_holder.remove()
			runproteinpaint(
				Object.assign({ holder: this.refs.ppHolderRef, noheader: true, nobox: true }, JSON.parse(JSON.stringify(data)))
			)
		}
		getUrlParams() {
			const params = {}
			window.location.search
				.substr(1)
				.split('&')
				.forEach(kv => {
					const [key, value] = kv.split('=')
					params[key] = value
				})
			if (params.filters) {
				params['filters'] = JSON.parse(decodeURIComponent(params.filters))
			}
			return params
		}
	}
}

export function getGDCLolliplot(React) {
	const PpComponent = getPpComponent(React)
	PpComponent.prototype.getData = getLolliplotData
	return PpComponent
}
