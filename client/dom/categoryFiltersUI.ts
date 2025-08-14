import { getCategoricalTermFilter } from '#filter'

/*
 *  component to display a group of select filters in a plot header
 */
export class CategoryFiltersUI {
	holder: any
	filterSelects: any[] = []
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
			const div = this.holder.append('div').style('padding', '5px')
			const button = div
				.append('button')
				.text(` ${tw.term.name} ▼`)
				.style('vertical-align', 'top')
				.on('click', () => {
					const display = select.style('display')
					button.text(display === 'none' ? ` ${tw.term.name} ▲` : ` ${tw.term.name} ▼`)
					select.style('display', display === 'none' ? 'block' : 'none')
				})
			let timeoutId
			const select = div
				.append('select')
				.property('multiple', true)
				.style('vertical-align', 'top')
				.style('display', 'none')
				.style('position', 'absolute')

			select.on('change', async () => {
				clearTimeout(timeoutId)
				timeoutId = setTimeout(() => {
					const selectedOptions = Array.from(select.node().selectedOptions)
					const values = selectedOptions.map((o: any) => o.value)
					this.plot.settings[tw.term.id] = values
					this.replaceFilter()
					select.style('display', 'none')
					button.text(` ${tw.term.name}: ${selectedOptions.map((o: any) => o.label).join(', ')} ▼`)
				}, 1000)
			})
			this.filterSelects.push(select)
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
			const select = this.filterSelects[index]
			select.selectAll('option').remove()
			const size = data[tw.term.id].length - 1 // -1 to remove the empty value

			select.attr('size', size)
			for (const value of data[tw.term.id]) {
				if (value.label == '') continue //skip empty labels
				const option = select.append('option').attr('value', value.value).text(value.label)
				option.property('disabled', value.disabled)
				for (const filterValue of filterValues) {
					if (value.value == filterValue) {
						option.attr('selected', 'selected')
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
