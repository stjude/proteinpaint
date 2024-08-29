import { CatValues, CatPredefinedGS, CatCustomGS } from '../../../index.ts'
import { DiscreteBase, DiscreteTWTypes } from '../../../composite.ts'

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

// example of extending a composite class, instead of
// having to extend multiple classes with highly specialized code
export class FakeDiscrete extends DiscreteBase implements FakeTw {
	#tw: DiscreteTWTypes

	constructor(tw, opts) {
		super(tw, opts)
		this.#tw = tw
	}

	render(arg: PlotTwRenderOpts): void {
		const t = this.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, no need for string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue

			// If there a lot of these if-else branches when extending DiscreteBase,
			// it may be simpler and clearer to extend the "atomic" tw subclass directly.
			// Code readability and type safety should dictate which class to extend.
			let shape = '',
				valueText = ''
			if (this.q.type == 'values') {
				shape = `<circle r=${d[t.id]}></cicle></svg>`
				valueText = '' + t.values?.[d[t.id]].label || ''
			} else if (this.q.type == 'predefined-groupset' || this.q.type == 'custom-groupset') {
				shape = `<rect width=10 height=10></rect></svg>`
				valueText = '' + d[t.id]
			} else {
				shape = `<line x1=0 y1=10 x2=10 y2=0 stroke='black' stroke-width=2 /></svg>`
				valueText = '' + d[t.id]
			}

			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${valueText}</text>${shape}`)
		}
	}
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
