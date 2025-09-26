import { TwRouter } from '../../TwRouter.ts'
import type { TwBase } from '../../TwBase.ts'
import type { TermWrapper } from '#types'
import type { FakeTw } from './types'
import { FakeCatValues, FakeCatPredefinedGS, FakeCatCustomGS } from './xtw/categorical.ts'
import { addons } from './xtw/addons.ts'

export class FakeApp {
	#opts: any
	#xtws: FakeTw[]
	#dom: {
		svg: string
	}

	constructor(opts) {
		this.#opts = opts
		this.#dom = { svg: '<svg></svg>' }
		this.#xtws = []
	}

	main(data) {
		this.#xtws = []
		for (const tw of this.#opts.twlst) {
			this.#xtws.push(this.#getxtw(tw))
		}
		this.#render(data)
		//console.log(40, this.#xtws, JSON.parse(JSON.stringify(this.#xtws)))
	}

	#getxtw(tw: TermWrapper): FakeTw | TwBase {
		const opts = { vocabApi: this.#opts.vocabApi }
		/* 
			Below are examples of using a discriminant property at the object root,
			it passes compiler checks and the code is simpler to write. To understand
			why there are compiler errors in the preceding examples, and why the code
			below works, see the detailed examples and explanations in
			https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
		*/
		if (!tw.$id) tw.$id = 'test.$id'
		if (!tw.type) throw `missing tw.type`
		if (tw.type in addons) {
			// example using addons
			return TwRouter.init(tw, { vocabApi: this.#opts.vocabApi, addons })
		} else {
			// example using extended subclass
			if (tw.type == 'QualTWValues') return new FakeCatValues(tw, opts)
			else if (tw.type == 'QualTWPredefinedGS') return new FakeCatPredefinedGS(tw, opts)
			else if (tw.type == 'QualTWCustomGS') return new FakeCatCustomGS(tw, opts)
			else throw `no fakeApp extended class for tw.type=${tw.type}`
		}
	}

	#render(data) {
		const svgElems: string[] = []
		for (const xtw of this.#xtws) {
			const arg = { data }
			svgElems.push(xtw.render(arg))
		}
		this.#dom.svg = `<svg>${svgElems.join('')}</svg>`
	}

	getInner() {
		return {
			dom: this.#dom,
			xtws: this.#xtws
		}
	}
}
