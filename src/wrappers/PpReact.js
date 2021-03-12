import React from 'react'
import { runproteinpaint } from '../app'
import { getLolliplotTrack } from './gdc.views'

export function getPpReact(getTrack) {
	if (!React) return

	class PpReact extends React.Component {
		constructor(props) {
			super(props)
			this.state = {}
		}
		componentDidMount() {
			this.window = this.props.window ? this.props.window : window
			this.runpp()
		}
		componentDidUpdate() {
			this.runpp()
		}
		render() {
			// avoid jsx syntax to simplify bundling requirements
			// since this is only a very minimal wrapper
			return React.createElement('div', { ref: 'ppHolderRef' }, '')
		}
		runpp() {
			const data = this.getTrack()
			// do not cause unnecessary re-render if the track argument
			// is the same as the last render
			if (deepEqual(data, this.currentData)) return
			this.currentData = data
			const pp_holder = this.refs.ppHolderRef.querySelector('.sja_root_holder')
			if (pp_holder) pp_holder.remove()
			runproteinpaint(
				Object.assign({ holder: this.refs.ppHolderRef, noheader: true, nobox: true }, JSON.parse(JSON.stringify(data)))
			)
		}
		/* 
			TODO: delete getUrlParams() once all 
		  required input are passed via props 
		  by the gdc portal app
		*/
		getUrlParams() {
			const loc = this.window.location
			const params = {}
			loc.search
				.substr(1)
				.split('&')
				.forEach(kv => {
					const [key, value] = kv.split('=')
					params[key] = value
				})
			if (params.filters) {
				params['filters'] = JSON.parse(decodeURIComponent(params.filters))
			}
			if (loc.pathname) {
				const url_split = loc.pathname.split('/')
				// do not hardcode the position of /genes/ in the pathname
				const i = url_split.findIndex(d => d === 'genes')
				if (i !== -1) params.gene = url_split[i + 1]
			}
			return params
		}
	}

	if (typeof getTrack == 'function') {
		PpReact.prototype.getTrack = getTrack
	} else {
		throw 'The second argument to getPpReact must be a function that returns runproteinpaint() arguments'
	}
	PpReact.React = React
	return PpReact
}

function deepEqual(x, y) {
	if (x === y) {
		return true
	} else if (typeof x == 'object' && x != null && (typeof y == 'object' && y != null)) {
		if (Object.keys(x).length != Object.keys(y).length) {
			return false
		}

		for (var prop in x) {
			if (y.hasOwnProperty(prop)) {
				if (!deepEqual(x[prop], y[prop])) return false
			} else {
				return false
			}
		}
		return true
	} else return false
}

export { getLolliplotTrack }
export const PpLolliplot = getPpReact(getLolliplotTrack)
