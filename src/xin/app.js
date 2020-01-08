import * as rx from '../common/rx.core'
import * as client from '../client'

class App {
	constructor(nouse, opts) {
		this.type = 'app'
		this.opts = opts
		this.api = rx.getAppApi(this)
		this.run()
	}
	async run() {
		try {
			const data = await client.dofetch2(
				'/termdb?density=1&genome=' + this.opts.genome + '&dslabel=' + this.opts.dslabel + '&termid=' + this.opts.id
			)
			if (data.error) throw data.error
			/*
			width
			height
			xpad
			ypad
			minvalue
			maxvalue
			densitymax
			samplecount
			*/
			this.opts.holder
				.append('div')
				.text('min: ' + data.minvalue + ' max: ' + data.maxvalue + ' densityMax: ' + data.densitymax)
			this.opts.holder
				.append('img')
				.style('width', data.width + 'px')
				.style('height', data.height + 'px')
				.attr('src', data.img)
		} catch (e) {
			client.sayerror(this.opts.holder, e)
		}
	}
}

exports.appInit = rx.getInitFxn(App)
