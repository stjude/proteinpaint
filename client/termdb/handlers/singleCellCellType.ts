import type { AppApi } from '#rx'

export class SearchHandler {
	callback?: () => void
	app?: AppApi

	async init(opts) {
		this.validateOpts(opts)
		this.callback = opts.callback
		this.app = opts.app
		// const holder = opts.holder.append('div').style('padding', '10px 0px')
	}

	validateOpts(opts) {
		if (opts.callback == null) throw new Error('callback is required')
		if (opts.app == null) throw new Error('app is required')
		if (opts.holder == null) throw new Error('holder is required')
	}
}
