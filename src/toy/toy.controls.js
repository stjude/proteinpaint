import {Component, getInitFxn} from "../rx.core"
import {searchInit} from './toy.search'

class ToyControls extends Component {
	constructor(app, holder) {
		super()
		this.app = app
		this.opts = holder
		this.dom = {holder}
		this.components = {
			search: searchInit(app, holder.append("div"))
		}
	}

	main(action) {
		this.notifyComponents(action)
	}
}

export const controlsInit = getInitFxn(ToyControls)
