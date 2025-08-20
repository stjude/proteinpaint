export class AppApi {
	vocabApi: any

	// opts: any
	// constructor(opts) {
	// 	this.opts = opts
	// 	if (!opts.app) throw `missing self.opts.app in prepComponent(${self.type})`
	// 	self.app = opts.app
	// 	self.opts = getOpts(opts, self)
	// 	if (self.validateOpts) self.validateOpts(opts)
	// 	// the component type + id may be used later to
	// 	// simplify getting its state from the store
	// 	if ('id' in opts) self.id = self.opts.id
	// 	self.api = getComponentApi(self)
	// }
	// validateOpts(opts) {
	// 	if (!opts.app) throw `missing opts.app`
	// }
	getState() {
		return {}
	}

	deregister(_) {}
}
