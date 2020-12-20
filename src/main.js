import { runproteinpaint } from './app'
import { deepEqual } from './common/rx.core'
import { getLolliplotData } from './gdc/gdc.views'

export function getPpReact(React, viewType) {
	class ProteinPaint extends React.Component {
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
			if (window.location.pathname) {
				const url_split = window.location.pathname.split('/')
				// do not hardcode the position of /genes/ in the pathname
				const i = url_split.findIndex(d => d === 'genes')
				if (i !== -1) params.gene = url_split[i + 1]
			}
			return params
		}
	}

	if (dataFxn == 'gdc-lolliplot') {
		ProteinPaint.prototype.getData = getLolliplotData
	}

	return ProteinPaint
}
