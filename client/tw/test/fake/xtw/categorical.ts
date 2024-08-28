import { CatValues, CatPredefinedGS, CatCustomGS } from '../../../index.ts'

// Declare argument type(s) that are specific to a method for a particulat plot, app, or component
type PlotTwRenderOpts = {
	holder: string // in real apps, would be a d3-selection HTML element
	data: {
		[sampleId: string]: {
			[termId: string]: number | string
		}
	}
}

export interface FakeTw {
	render: (arg: PlotTwRenderOpts) => void
}

export class FakeCatValues extends CatValues implements FakeTw {
	render(arg: PlotTwRenderOpts): void {
		const t = this.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, no need for string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:circle element
			// note that `this` context guarantees that the tw shape matches
			// expectations without having to do additional checks
			const shape = `<circle r=${d[t.id]}></cicle></svg>`
			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${t.values[d[t.id]].label}</text>${shape}`)

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
}

export class FakeCatPredefinedGS extends CatPredefinedGS implements FakeTw {
	render(arg: PlotTwRenderOpts) {
		// the tw is guaranteed to have term.type=categorical, q.type='predefined-groupset'
		const t = this.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, must not by influenced by string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:rect element
			const shape = `<rect width=10 height=10></rect></svg>`
			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${d[t.id]}</text>${shape}`)
		}
	}
}

export class FakeCatCustomGS extends CatCustomGS implements FakeTw {
	render(arg: PlotTwRenderOpts) {
		// the tw is guaranteed to have term.type=categorical, q.type='predefined-groupset'
		const t = this.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, must not by influenced by string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:rect element
			const shape = `<rect width=10 height=10></rect></svg>`
			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${d[t.id]}</text>${shape}`)
		}
	}
}
