import { debounce } from 'debounce'
import { Menu } from '#dom/menu'
import { select } from 'd3-selection'
import { keyupEnter } from '../src/client'

export class InputSearch {
	constructor(opts) {
		this.holder = opts.holder
		this.tip = opts.tip || new Menu({ border: '', padding: '0px' })
		this.style = opts.style || {}
		this.placeholder = opts.placeholder || ''
		this.title = opts.title || ''
		this.searchItems = opts.searchItems
		this.app = opts.app
	}

	initUI() {
		this.holder.style('padding', 'padding' in this.style ? this.style.padding : '5px').style('display', 'inline-block')
		this.input = this.holder
			.append('input')
			.attr('class', 'sjpp-input-search')
			.style('border', 'border' in this.style ? this.style.border : '5px')
			.attr('size', 20)
			.attr('placeholder', this.placeholder || '')
			.attr('title', this.title || '')
			.on('keyup', async event => {
				if (keyupEnter(event)) this.enterSearch()
				debounce(this.addSearchItems(), 400)
			})
	}

	async addSearchItems() {
		if (!this.input.property('value')) {
			this.tip.hide()
			return
		}
		this.tip.clear().showunder(this.input.node())

		const resultsWrapper = this.tip.d.append('div')
		const results = await this.searchItems()

		await resultsWrapper
			.append('div')
			.style('display', 'flex')
			.selectAll()
			.data(results.filter(r => r.items.length >= 1))
			.enter()
			.append('div')
			.style('display', 'block')
			.style('border-left', '0.5px solid lightgrey')
			.each(this.showResultsList)
	}

	async showResultsList(result) {
		result.wrapper = select(this)
		result.wrapper.style('padding', '5px')
		result.titleDiv = result.wrapper
			.append('span')
			.style('padding', '3px 0px 5px')
			.style('opacity', 0.65)
			.style('font-size', '0.8em')
			.text(result.title)

		await result.wrapper
			.append('div')
			.classed('sjpp-result-wrapper', true)
			.selectAll('div')
			.data(result.items)
			.enter()
			.append('div')
			.classed('sja_menuoption', true)
			.classed('sjpp-search-result', true)
			.style('display', 'block')
			.style('padding-left', '10px')
			.style('background-color', result.color || '')
			.text(d => d.name || d.label || d)
			.on('click', item => {
				result.callback(item)
			})
	}

	enterSearch() {
		if (!this.input.property('value').trim()) return
		const wrapper = this.tip.d.select('.sjpp-result-wrapper').node()
		const result = this.tip.d.select('.sjpp-search-result').node()
		wrapper.__data__.callback(result.__data__)
		this.input.property('value', '')
		this.tip.hide()
	}
}
