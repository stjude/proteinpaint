import { TwRouter } from '../../TwRouter.ts'
import { TermWrapper } from '#updated-types'
import { FakeTw, FakeCatValues, FakeCatPredefinedGS, FakeCatCustomGS } from './xtw/categorical.ts'

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
			this.#xtws.push(this.#getExtTws(tw))
		}
		this.#render(data)
		//console.log(40, this.#xtws, JSON.parse(JSON.stringify(this.#xtws)))
	}

	#getExtTws(tw: TermWrapper): FakeTw {
		const opts = { vocabApi: this.#opts.vocabApi }
		/* 
			Below are examples of using a discriminant property at the object root,
			it passes compiler checks and the code is simpler to write. To understand
			why there are compiler errors in the preceding examples, and why the code
			below works, see the detailed examples and explanations in
			https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
		*/
		if (!tw.type) throw `missing tw.type`
		if (tw.type == 'CatTWValues') return new FakeCatValues(tw, opts)
		else if (tw.type == 'CatTWPredefinedGS') return new FakeCatPredefinedGS(tw, opts)
		else if (tw.type == 'CatTWCustomGS') return new FakeCatCustomGS(tw, opts)
		else throw `no fakeApp extended class for tw.type=${tw.type}`
	}

	#render(data) {
		let svg = '<svg></svg>'
		for (const xtw of this.#xtws) {
			const arg = { holder: svg, data }
			xtw.render(arg)
			svg = arg.holder
		}
		this.#dom.svg = svg
	}

	getInner() {
		return {
			dom: this.#dom,
			xtws: this.#xtws
		}
	}
}
