import { Addons, PlotTwRenderOpts } from './fakeTypes'
import { CategoricalPredefinedGS } from '../../CategoricalPredefinedGS'

type ThisType = CategoricalPredefinedGS & Addons

// For each specialized handler class, identified by its constructor name,
// create a addons object that define all of the specific handler methods
// and properties that will be needed in the consumer code
export const CatPredefinedGSAddons: Addons = {
	x: 2,
	render: function (this: ThisType, arg: PlotTwRenderOpts) {
		// the tw is guaranteed to have term.type=categorical, q.type='predefined-groupset'\
		const t = this.tw.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			if (!Object.keys(d).includes(t.id)) continue
			// for the tw in this typed context, use a svg:rect element
			const shape = `<rect width=10 height=10></rect></svg>`
			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${d[t.id]}</text>${shape}`)
		}
	}
}
