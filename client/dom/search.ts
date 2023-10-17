import { debounce } from 'debounce'
import { Menu } from '#dom/menu'
import { select, Selection } from 'd3-selection'
import { keyupEnter } from '../src/client'
import { throwMsgWithFilePathAndFnName } from './sayerror'

type SearchGroupEntry = {
	/** Text appearing above the search results group */
	title: string
	/** Array items to search. Maybe string char, objs, etc.
	 * Buttons text determined by either item.name || item.label if an object
	 * or as item, if item is a string
	 */
	items: any[]
	/** Default color for buttons is light grey. Specify color for the group */
	color?: string
	/** Callback for onclick or onenter */
	callback: (f: any) => any
}

type InputSearchOpts = {
	holder: Selection<any, any, any, any>
	searchItems: () => SearchGroupEntry[]
	app: any
	/** Menu tip. If not provided, created by default */
	tip?: any
	/** Add any css style here */
	style?: any
	placeholder?: string
	title?: string
}

export class InputSearch {
	holder: Selection<HTMLDivElement, any, any, any>
	input: Selection<HTMLInputElement, any, any, any>
	tip: any
	searchItems: () => SearchGroupEntry[]
	style: any
	placeholder: string
	/** Title for input, not title above each group */
	title: string
	app: any

	constructor(opts: InputSearchOpts) {
		this.holder = opts.holder
		this.input = opts.holder.append('input')
		this.tip = opts.tip || new Menu({ border: '', padding: '0px' })
		this.style = opts.style || {}
		this.placeholder = opts.placeholder || ''
		this.title = opts.title || ''
		this.searchItems = opts.searchItems
		this.app = opts.app
	}

	initUI() {
		this.holder.style('padding', 'padding' in this.style ? this.style.padding : '5px').style('display', 'inline-block')
		this.input
			.attr('class', 'sjpp-input-search')
			.style('border', 'border' in this.style ? this.style.border : '5px')
			.attr('size', 20)
			.attr('placeholder', this.placeholder)
			.attr('title', this.title)
			.on('keyup', async (event: KeyboardEvent) => {
				if (keyupEnter(event)) this.enterSearch()
				debounce(this.addSearchItems(), 400)
			})
	}

	async addSearchItems() {
		if (!this.input.property('value')) {
			this.tip.hide()
			return
		}
		try {
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
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			else throwMsgWithFilePathAndFnName(e)
		}
	}

	async showResultsList(
		this: Element,
		result: SearchGroupEntry & {
			wrapper: Selection<Element, any, any, any>
			titleDiv: Selection<HTMLSpanElement, any, any, any>
		}
	) {
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
			.text((d: any) => d.name || d.label || d)
			.on('click', (event: MouseEvent, item: any) => {
				event.stopPropagation()
				result.callback(item)
			})
	}

	enterSearch() {
		if (!this.input.property('value')) return
		const wrapper = this.tip.d.select('.sjpp-result-wrapper').node()
		const result = this.tip.d.select('.sjpp-search-result').node()
		wrapper.__data__.callback(result.__data__)
		this.input.property('value', '')
		this.tip.hide()
	}
}
