import { termjson } from '../../../test/testdata/termjson'
import { TwRouter } from '../../TwRouter.ts'
import { HandlerWithAddons } from './fakeTypes'
import { CatValuesCls } from './CatValuesAddons'
import { CatPredefinedGSCls } from './CatPredefinedGSAddons.ts'

const HandlerClsMap = {
	CategoricalValues: CatValuesCls,
	CategoricalPredefinedGS: CatPredefinedGSCls
}

export class FakeAppByCls {
	#opts: any
	#handlers: HandlerWithAddons[]
	#dom: {
		svg: string
	}
	//test?: (any) => void

	constructor(opts) {
		this.#opts = opts
		this.#dom = { svg: '<svg></svg>' }
		this.#handlers = []
	}

	main(data) {
		this.#handlers = []
		for (const tw of this.#opts.twlst) {
			this.#handlers.push(this.#getHandler(tw))
		}

		this.#render(data)
	}

	#getHandler(tw): HandlerWithAddons {
		const HandlerCls = TwRouter.getCls(tw, { vocabApi: this.#opts.vocabApi })
		if (!HandlerCls) throw `no handler class for term.type='${tw.term.type}', q.type='${tw.q.type}' found`
		const clsName = HandlerCls.prototype.constructor.name
		if (!HandlerClsMap[clsName]) throw `no HandlerClsMap[${clsName}]`
		return new HandlerClsMap[clsName](tw, { vocabApi: this.#opts.vocabApi })
	}

	#render(data) {
		let svg = '<svg></svg>'
		for (const h of this.#handlers) {
			const arg = { holder: svg, data }
			h.render(arg)
			svg = arg.holder
		}
		this.#dom.svg = svg
	}

	getInner() {
		return {
			dom: this.#dom,
			handlers: this.#handlers
		}
	}
}
