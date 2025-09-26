import { QualValues, QualPredefinedGS, QualCustomGS } from '../../../index.ts'
import type { PlotTwRenderOpts, FakeTw } from '../types'

export class FakeCatValues extends QualValues implements FakeTw {
	render(arg: PlotTwRenderOpts): string {
		const t = this.term
		const svgElems: string[] = []
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, no need for string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:circle element
			// note that `this` context guarantees that the tw shape matches
			// expectations without having to do additional checks
			const shape = `<circle r=${d[t.id]}></cicle>`
			svgElems.push(`<text>${sampleId}, ${t.values[d[t.id]].label}</text>${shape}`)
		}
		return svgElems.join('')
	}
}

export class FakeCatPredefinedGS extends QualPredefinedGS implements FakeTw {
	render(arg: PlotTwRenderOpts): string {
		// the tw is guaranteed to have term.type=categorical, q.type='predefined-groupset'
		const t = this.term
		const svgElems: string[] = []
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, must not by influenced by string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:rect element
			const shape = `<rect width=10 height=10></rect>`
			svgElems.push(`<text>${sampleId}, ${d[t.id]}</text>${shape}`)
		}
		return svgElems.join('')
	}
}

export class FakeCatCustomGS extends QualCustomGS implements FakeTw {
	render(arg: PlotTwRenderOpts): string {
		// the tw is guaranteed to have term.type=categorical, q.type='predefined-groupset'
		const t = this.term
		const svgElems: string[] = []
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, must not by influenced by string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:rect element
			const shape = `<rect width=10 height=10></rect>`
			svgElems.push(`<text>${sampleId}, ${d[t.id]}</text>${shape}`)
		}
		return svgElems.join('')
	}
}
