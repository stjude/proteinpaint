export class AppBase {
	//type: string
	//id: string
	opts: any
	id: string
	state: any
	// dom: any
	// config: any

	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.id = opts.id
	}

	validateOpts(o: any = {}) {
		if (!o.holder) throw `missing opts.holder in the app constructor argument`
		if (!o.callbacks) o.callbacks = {}
		if (o.state) {
			if (!o.state.vocab) o.state.vocab = {}
			if (typeof o.state.vocab != 'object') throw 'opts.state.vocab{} is not an object'
			if (o.state.genome) {
				o.state.vocab.genome = o.state.genome
				delete o.state.genome
			}
			if (o.state.dslabel) {
				o.state.vocab.dslabel = o.state.dslabel
				delete o.state.dslabel
			}
		}
		if (o.app) {
			for (const [k, v] of Object.entries(o.app)) {
				o[k] = v
			}
			delete o.app
		}
		return o
	}
}
