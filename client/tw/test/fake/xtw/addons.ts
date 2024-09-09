import { PlotTwRenderOpts } from '../types'
import { DiscreteXTW, ContinuousXTW } from '../../../../tw/composite'

const discreteAddons = {
	render: {
		value: function (this: DiscreteXTW, arg: PlotTwRenderOpts): string {
			const t = this.term
			const svgElems: string[] = []
			for (const [sampleId, d] of Object.entries(arg.data)) {
				const keys = Object.keys(d)
				// lots of terms indicate benchmark testing, no need for string-based svg simulated render
				if (keys.length > 10 || !keys.includes(t.id)) continue

				// If there are a lot of these if-else branches when extending DiscreteBase,
				// it may be simpler and clearer to extend the "atomic" tw subclass directly.
				// Code readability and type safety should dictate which class to extend.js
				const shape = `<line x1=0 y1=10 x2=10 y2=0 stroke='black' stroke-width=2 />`
				const valueText = '' + d[t.id]
				svgElems.push(`<text>${sampleId}, ${valueText} (${this.q.mode})</text>${shape}`)
			}
			return svgElems.join('')
		}
	}
}

const continuousAddons = {
	render: {
		value: function (this: ContinuousXTW, arg: PlotTwRenderOpts): string {
			const t = this.term
			const svgElems: string[] = []
			for (const [sampleId, d] of Object.entries(arg.data)) {
				const keys = Object.keys(d)
				// lots of terms indicate benchmark testing, no need for string-based svg simulated render
				if (keys.length > 10 || !keys.includes(t.id)) continue

				// If there a lot of these if-else branches when extending DiscreteBase,
				// it may be simpler and clearer to extend the "atomic" tw subclass directly.
				// Code readability and type safety should dictate which class to extend.

				const shape = `<line x1=0 y1=0 x2=10 y2=10 stroke='black' stroke-width=2 />`
				const valueText = '' + d[t.id]
				svgElems.push(`<text>${sampleId}, ${valueText} (${this.q.mode})</text>${shape}`)
			}
			return svgElems.join('')
		}
	}
}

export const addons = {
	NumTWRegularBin: discreteAddons,
	NumTWCustomBin: discreteAddons,
	NumTWCont: continuousAddons
}
