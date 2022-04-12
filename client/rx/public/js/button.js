import { getCompInit } from './rx.js'

class MyButton {
	constructor(opts) {
		this.type = 'button'
		const button = opts.holder.append('button')
		this.dom = {
			holder: opts.holder,
			button,
			label: button.append('span').html('Number of clicks: '),
			count: button.append('span')
		}
	}

	init(appState) {
		this.dom.count.html(appState.btn.numClicks)
		this.dom.button.on('click', () => {
			console.log('test')
			this.app.dispatch({
				type: 'add_btnclicks',
				increment: 1
			})
		})
	}

	getState(appState) {
		return appState.btn
	}

	main() {
		this.dom.count.html(this.state.numClicks)
	}
}

export const myButtonInit = getCompInit(MyButton)
