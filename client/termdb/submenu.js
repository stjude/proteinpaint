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
			.style('margin', '10px')
			.append('span')
			.html('&laquo; ' + (self.app.opts.tree?.backToSelectionText || 'Back to variable selection'))
			.attr('class', 'sja_clbtext')
			.attr('data-testid', 'sja_treesubmenu_backprompt')
			.on('click', () => self.app.dispatch({ type: 'submenu_set', submenu: {} }))

		self.dom.holder
			.style('display', 'block')
			.append('div')
			.style('margin', '15px 0px 5px 10px')
			.style('font-weight', 'bold')
			.style('font-size', '.9em')
			.text(term.name)

		showTvsMenu({
			term,
			filter: self.state.termfilter.filter,
			holder: self.dom.holder.append('div'),
			vocabApi: self.app.vocabApi,
			debug: self.app.debug,
			getCategoriesArguments: self.app.opts.getCategoriesArguments,
			callback: self.app.opts.tree.click_term2select_tvs
		})
	}
}
