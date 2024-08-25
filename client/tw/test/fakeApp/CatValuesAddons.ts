import { Addons, PlotTwRenderOpts } from './fakeTypes'
import { CategoricalValues } from '../../CategoricalValues'

type ThisType = CategoricalValues & Addons

// For each specialized handler class, identified by its constructor name,
// create a addons object that define all of the specific handler methods
// and properties that will be needed in the consumer code
export const CatValuesAddons: Addons = {
	x: 1,
	// since these addons are appended to an object instance instead of the class/object prototype,
	// the `this` context must be set
	render: function (this: ThisType, arg: PlotTwRenderOpts): void {
		// the tw is guaranteed to have term.type=categorical, q.type='values'
		const t = this.tw.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, no need for string-based svg simulated render
			if (keys.length > 100 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:circle element
			// note that `this` context guarantees that the tw shape matches
			// expectations without having to do additional checks
			const shape = `<circle r=${d[t.id]}></cicle></svg>`
			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${t.values[d[t.id]].label}</text>${shape}`)
		}

		/*
			*** List of benefits (the goal of this tw routing and handler refactor) ***
			
			All code inside this function can be coded safely againt the type of `this`,
			no need for if-else branches, type casting, or other workarounds.
			
			Consumer code can easily call these added methods easily, without the need
			for static or runtime checks for tw type.
			
			Common methods, for example counting samples by categorical values or groups,
			can also be inherited by specialized handler from a base handler class, therefore
			keeping related logic close together instead of being spread out or duplicated.
		*/
	}
}

export class CatValuesCls extends CategoricalValues implements ThisType {
	x = 1
	// since these addons are appended to an object instance instead of the class/object prototype,
	// the `this` context must be set
	render(arg: PlotTwRenderOpts): void {
		const t = this.tw.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, no need for string-based svg simulated render
			if (keys.length > 100 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:circle element
			// note that `this` context guarantees that the tw shape matches
			// expectations without having to do additional checks
			const shape = `<circle r=${d[t.id]}></cicle></svg>`
			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${t.values[d[t.id]].label}</text>${shape}`)
		}
	}
}
