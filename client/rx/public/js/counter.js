import { getCompInit } from './rx.js'

class Counter {
	constructor(opts) {
		this.type = 'counter'
		this.dom = {
			holder: opts.holder,
			leftLabel: opts.holder
				.append('span')
				.style('margin-right', '10px')
				.html('Total #clicks: '),
			rightLabel: opts.holder.append('span')
		}
	}

	getState(appState) {
		// missing code
	}

	main() {
		// missing code
	}
}

export const counterInit = getCompInit(Counter)
