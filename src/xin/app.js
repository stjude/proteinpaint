import * as rx from '../common/rx.core'
import * as client from '../client'

const width = 500,
	height = 100,
	xpad = 10,
	ypad = 10
// width/height is the dimension of the actual plotting area

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
				'/termdb?density=1&genome=' +
					this.opts.genome +
					'&dslabel=' +
					this.opts.dslabel +
					'&termid=' +
					this.opts.id +
					'&width=' +
					width +
					'&height=' +
					height +
					'&xpad=' +
					xpad +
					'&ypad=' +
					ypad +
					(this.opts.filter ? '&filter=' + JSON.stringify(this.opts.filter) : '')
			)
			if (data.error) throw data.error
			/*
			minvalue: x axis
			maxvalue: x axis
			densitymax: y axis max
			samplecount
			*/
			this.opts.holder.append('div').text('min: ' + data.minvalue)
			this.opts.holder.append('div').text('max: ' + data.maxvalue)
			this.opts.holder.append('div').text('densityMax: ' + data.densitymax)
			this.opts.holder.append('div').text('samples: ' + data.samplecount)
			this.opts.holder
				.append('img')
				.style('width', width + xpad * 2 + 'px')
				.style('height', height + ypad * 2 + 'px')
				.attr('src', data.img)
		} catch (e) {
			client.sayerror(this.opts.holder, e)
		}
	}
}

exports.appInit = rx.getInitFxn(App)
