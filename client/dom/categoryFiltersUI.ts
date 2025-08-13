import { getCategoricalTermFilter } from '#filter'

/*
 *  component to display a group of select filters in a plot header
 */
export class CategoryFiltersUI {
	holder: any
	selectMenus: any[] = []
	plot: any
	config: any

	constructor(holder: any, plot: any, config: any) {
		holder
			.style('padding', '10px')
			.style('display', 'flex')
			.style('flex-direction', 'row')
			.style('flex-wrap', 'wrap')
			.style('width', '100vw')
		this.plot = plot
		this.holder = holder
		this.config = config
		for (const tw of this.plot.config.filterTWs) {
			const div = this.holder.append('div').style('padding', '5px').attr('class', 'dropdown')

			div
				.append('button')
				.text(` ${tw.term.name}: `)
				.attr('type', 'button')
				.attr('id', `dropdown-${tw.term.id}`)
				.attr('class', 'btn btn-secondary dropdown-toggle')
				.attr('data-bs-toggle', 'dropdown')
				.attr('data-bs-auto-close', 'outside')
				.attr('aria-expanded', 'false')
			const menu = div.append('div').attr('class', 'dropdown-menu').attr('aria-labelledby', `dropdown-${tw.term.id}`)

			this.selectMenus.push(menu)
		}
	}

	async fillFilters() {
		if (!this.config.filterTWs) {
			return
		}
		let index = 0
		for (const tw of this.config.filterTWs) {
			let filterValues = this.plot.settings[tw.term.id] || ''
			if (!Array.isArray(filterValues))
				//User may have set a single value
				filterValues = [filterValues] //ensure filterValues is an array
			const filters: any = {}
			for (const tw of this.config.filterTWs)
				filters[tw.term.id] = getCategoricalTermFilter(this.config.filterTWs, this.plot.settings, tw)
			const data = await this.plot.app.vocabApi.filterTermValues({
				terms: this.config.filterTWs,
				filters,
				showAll: false
			})
			const selectMenu = this.selectMenus[index]
			selectMenu.selectAll('*').remove()

			for (const value of data[tw.term.id]) {
				if (value.label == '') continue //skip empty labels
				const option = selectMenu.append('div').attr('class', 'dropdown-item')
				const checkbox = option
					.append('input')
					.attr('type', 'checkbox')
					.attr('id', `filter-${tw.term.id}-${value.value}`)
					.attr('value', value.value)
				const label = option.append('label').text(value.label).attr('for', `filter-${tw.term.id}-${value.value}`)

				let timeoutId

				option.on('click', async () => {
					clearTimeout(timeoutId)
					timeoutId = setTimeout(() => {
						const chBoxes = selectMenu.selectAll('input[type="checkbox"]')
						const values = Array.from(chBoxes.nodes())
							.filter((c: any) => c.checked)
							.map((c: any) => c.value)
						this.plot.settings[tw.term.id] = values
						this.replaceFilter()
					}, 1000)
				})

				//option.append('span').text(value.label)
				checkbox.property('disabled', value.disabled)
				label.style('color', value.disabled ? 'gray' : '')
				for (const filterValue of filterValues) {
					if (value.value == filterValue) {
						checkbox.attr('checked', true)
					}
				}
			}
			index++
		}
	}

	getFilter() {
		return getCategoricalTermFilter(this.plot.config.filterTWs, this.plot.settings)
	}

	async replaceFilter() {
		const filter = this.getFilter() //read by child plots
		this.plot.app.dispatch({
			type: 'plot_edit',
			id: this.plot.id,
			config: { filter, settings: { [this.plot.type]: this.plot.settings } } //update country and site in the report settings
		})
	}
}
