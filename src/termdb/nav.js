import * as rx from '../common/rx.core'
import { searchInit } from './search'

class TdbNav {
	constructor(app, opts) {
		this.app = app
		this.opts = opts
		this.type = 'barchart'
		this.id = opts.id
		this.api = rx.getComponentApi(this)
		const header = opts.holder.append('div')
		this.dom = {
			holder: opts.holder.style('border-bottom', '1px solid #000'),
			searchDiv: header
				.append('div')
				.style('display', 'inline-block')
				.style('width', '300px')
				.style('margin', '10px'),
			tabDiv: header.append('div').style('display', 'inline-block'),
			sessionDiv: header.append('div'),
			subheader: opts.holder.append('div')
		}

		setInteractivity(this)
		setRenderers(this)
		this.activeTab = 0
		this.initUI()

		this.components = {
			/*search: searchInit(
				this.app,
				{ holder: this.dom.searchDiv },
				this.app.opts.search
			)*/
		}
	}
	getState(appState) {
		return appState
	}
	main() {
		if (!this.opts.enabled) return
	}
}

export const navInit = rx.getInitFxn(TdbNav)

function setRenderers(self) {
	self.initUI = () => {
		const table = self.dom.tabDiv.append('table').style('border-collapse', 'collapse')
		self.tabs = [
			{ top: 'COHORT', mid: 'SJLIFE', btm: '' },
			{ top: 'FILTER', mid: '+NEW', btm: '' },
			{ top: 'CART', mid: 'NONE', btm: '' }
		]
		table
			.selectAll('tr')
			.data(['top', 'mid', 'btm'])
			.enter()
			.append('tr')
			.style('color', (d, i) => (i == 0 ? '#aaa' : '#000'))
			.style('font-size', (d, i) => (i == 1 ? '20px' : '12px'))
			.selectAll('td')
			.data((key, i) =>
				self.tabs.map(row => {
					return { i, label: row[key] }
				})
			)
			.enter()
			.append('td')
			.style('width', '100px')
			.style('padding', '5px 12px')
			.style('text-align', 'center')
			.style('border-left', '1px solid #ccc')
			.style('border-right', '1px solid #ccc')
			.style('color', (d, j) => (d.i == 1 && j == self.activeTab ? '#000' : '#aaa'))
			.style('cursor', 'pointer')
			.html(d => d.label)
	}
}

function setInteractivity(self) {}
