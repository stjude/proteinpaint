import { getCompInit } from './rx.js'

class MyButton {
	constructor(opts) {
		this.type = 'button'
		const leftLabel = opts.holder.append('span').style('margin-right', '10px')
		const button = opts.holder.append('button').on('click', () => {
			this.app.dispatch({
				type: 'add_btnclicks',
				id: this.id,
				increment: 1
			})
		})

		this.dom = {
			holder: opts.holder,
			leftLabel,
			button,
			btnlabel: button.append('span').html('Number of clicks: '),
			count: button.append('span')
		}
	}

	getState(appState) {
		return appState.buttons[this.id]
	}

	main() {
		this.dom.leftLabel.html(this.state.name)
		this.dom.count.html(this.state.numClicks)
	}
}

export const myButtonInit = getCompInit(MyButton)
