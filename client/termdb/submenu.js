import { getCompInit } from '../rx'
import { showTvsMenu } from '../filter/tvs'

class TdbSubmenu {
	constructor(opts) {
		this.type = 'submenu'
		this.dom = { holder: opts.holder }
		setRenderers(this)
		//getCompInit(TdbSubmenu) will set this.id, .app, .opts, .api
	}

	reactsTo(action) {
		if (action.type.startsWith('submenu_')) return true
		if (action.type == 'app_refresh') return true
	}

	getState(appState) {
		return {
			type: appState.submenu.type,
			term: appState.submenu.term,
			termfilter: appState.termfilter
		}
	}

	main() {
		if (!this.state.term) {
			this.dom.holder.style('display', 'none')
			return
		}
		if (this.state.type == 'tvs') this.showTvsMenu(this.state.term)
		else throw `unsupported submenu.type='${this.state.type}'`
	}
}

export const submenuInit = getCompInit(TdbSubmenu)

function setRenderers(self) {
	self.showTvsMenu = function (term) {
		self.dom.holder.selectAll('*').remove()

		self.dom.holder
			.style('display', 'block')
			.append('div')
			.style('margin', '10px 0px 15px 10px')
			.style('font-weight', 'bold')
			.text(`Variable selected: ${term.id}`)

		showTvsMenu({
			term,
			filter: self.state.termfilter.filter,
			holder: self.dom.holder.append('div'),
			vocabApi: self.app.vocabApi,
			debug: self.app.debug,
			getCategoriesArguments: self.app.opts.getCategoriesArguments,
			callback: self.app.opts.tree.click_term2select_tvs
		})

		self.dom.holder
			.style('display', 'block')
			.append('div')
			.style('margin', '10px')
			.append('span')
			.html('&laquo; Back to variable selection')
			.attr('class', 'sja_clbtext')
			.on('click', () => self.app.dispatch({ type: 'submenu_set', submenu: {} }))
	}
}
