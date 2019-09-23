import * as rx from "../rx.core"
import {searchInit} from './toy.search'
import {filterInit} from './toy.filter'

class ToyControls {
	constructor(app, holder) {
		this.api = rx.getComponentApi(this)
		this.notifyComponents = rx.notifyComponents
		this.getComponents = rx.getComponents
		this.app = app
		this.opts = holder
		this.dom = {holder}
		this.components = {
			search: searchInit(app, holder.append("div")),
			filter: filterInit(app, holder.append("div"))
		}
	}

	main(action) {
		this.notifyComponents(action)
	}
}

export const controlsInit = rx.getInitFxn(ToyControls)
