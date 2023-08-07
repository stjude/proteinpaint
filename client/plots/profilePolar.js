import { downloadSingleSVG } from '../common/svg.download.js'
import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import * as d3 from 'd3'
import { getSampleFilter } from '#termsetting/handlers/samplelst'

class profilePolar {
	constructor() {
		this.type = 'profilePolar'
	}
	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder
		}
		this.opts.header.text('Polar plot')
		this.arcGenerator = d3.arc().innerRadius(0)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			termfilter: appState.termfilter
		}
	}

	filterBySample(sampleId) {
		const filter = getSampleFilter(sampleId)
		filter.tag = 'filterUiRoot'
		console.log(filter)
		this.app.dispatch({
			type: 'filter_replace',
			filter
		})
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		const twLst = []
		for (const [i, tw] of this.config.terms.entries()) {
			if (tw.id) {
				twLst.push(tw)
			}
		}
		twLst.push(this.config.typeTW)

		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: twLst,
			filter: this.state.termfilter.filter
		})
		this.regions = [
			{ key: '', label: '' },
			{ key: 'Global', label: 'Global' }
		]
		this.incomes = ['']
		this.incomes.push(...this.config.incomes)

		for (const region of this.config.regions) {
			this.regions.push({ key: region.name, label: region.name })
			for (const country of region.countries) this.regions.push({ key: country, label: `-- ${country}` })
		}
		this.sampleData = null
		for (const k in this.data.samples) {
			const sample = this.data.samples[k]
			if (this.config.region && sample.sampleName == this.config.region) {
				this.sampleData = sample
				break
			}
			if (this.config.income && sample.sampleName == this.config.income) {
				this.sampleData = sample
				break
			}
		}
		this.region = this.config.region || this.regions[0]
		this.income = this.config.income || this.incomes[0]
		this.plot()
	}

	plot() {
		const config = this.config
		this.dom.holder.selectAll('*').remove()

		const holder = this.dom.holder.append('div')
		const div = holder.append('div').style('margin-left', '50px').style('margin-top', '20px')

		div.append('label').style('margin-left', '15px').html('Region:').style('font-weight', 'bold')
		const regionSelect = div.append('select').style('margin-left', '5px')
		regionSelect
			.selectAll('option')
			.data(this.regions)
			.enter()
			.append('option')
			.property('selected', d => d.key == config.region)
			.attr('value', d => d.key)
			.html((d, i) => d.label)

		regionSelect.on('change', () => {
			config.region = regionSelect.node().value
			config.income = ''
			this.filterBySample(12)
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})

		div.append('label').style('margin-left', '15px').html('Income Group:').style('font-weight', 'bold')
		const incomeSelect = div.append('select').style('margin-left', '5px')
		incomeSelect
			.selectAll('option')
			.data(this.incomes)
			.enter()
			.append('option')
			.property('selected', d => d == config.income)
			.html((d, i) => d)

		incomeSelect.on('change', () => {
			config.income = incomeSelect.node().value
			config.region = ''
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})

		if (!this.sampleData) return
		div
			.append('button')
			.style('margin-left', '15px')
			.text('Download SVG')
			.on('click', () => downloadSingleSVG(svg, `polar-plot-${this.region}-${this.income}.svg`.split(' ').join('')))

		const svg = holder.append('svg').attr('width', 1200).attr('height', 600)

		// Create a polar grid.
		const radius = 250
		const x = 400
		const y = 300
		const polarG = svg.append('g').attr('transform', `translate(${x},${y})`)
		const legendG = svg.append('g').attr('transform', `translate(${x + 350},${y + 150})`)

		for (let i = 0; i <= 10; i++) addCircle(i * 10)

		const angle = (Math.PI * 2) / config.terms.length
		let i = 0
		for (const d of config.terms) {
			const percentage = this.sampleData[d.$id]?.value

			polarG
				.append('g')
				.append('path')
				.attr('fill', d.term.color)
				.attr(
					'd',
					this.arcGenerator({
						outerRadius: (percentage / 100) * radius,
						startAngle: i * angle,
						endAngle: (i + 1) * angle
					})
				)
			i++
		}

		addCircle(50, 'C')
		addCircle(75, 'B')
		addCircle(100, 'A')
		for (let i = 0; i <= 10; i++) {
			const percent = i * 10
			polarG
				.append('text')
				.attr('transform', `translate(-10, ${(-percent / 100) * radius + 5})`)
				.attr('text-anchor', 'end')
				.style('font-size', '0.8rem')
				.text(`${percent}%`)
		}
		legendG
			.append('text')
			.attr('text-anchor', 'left')
			.style('font-weight', 'bold')
			.text('Overall Score')
			.attr('transform', `translate(0, -10)`)

		addLegendItem('A', 'More than 75% of possible scorable items', 1)
		addLegendItem('B', '50-75% of possible scorable items', 2)
		addLegendItem('C', 'Less than 50% of possible scorable items', 3)

		function addCircle(percent, text = null) {
			const circle = polarG
				.append('circle')
				.attr('r', (percent / 100) * radius)
				.style('fill', 'none')
				.style('opacity', '0.5')
			if (percent != 50) circle.style('stroke', '#aaa')
			if (text) {
				if (percent != 100) circle.style('stroke-dasharray', '5, 5').style('stroke-width', '2').style('stroke', 'black')

				polarG
					.append('text')
					.attr('transform', `translate(15, ${-(percent / 100 - 0.125) * radius + 10})`)
					.attr('text-anchor', 'middle')
					.text(text)
					.style('font-weight', 'bold')
					.style('font-size', '24px')
			}
		}

		function addLegendItem(category, description, index) {
			const text = legendG
				.append('text')
				.attr('transform', `translate(0, ${index * 20})`)
				.attr('text-anchor', 'left')
			text.append('tspan').attr('font-weight', 'bold').text(category)
			text.append('tspan').text(`: ${description}`)
		}
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profilePolar
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profilePolar'
		const config = copyMerge(structuredClone(defaults), opts)
		for (const t of config.terms) {
			if (t.id) await fillTermWrapper(t, app.vocabApi)
		}
		config.typeTW = await fillTermWrapper({ id: 'sampleType' }, app.vocabApi)
		return config
	} catch (e) {
		throw `${e} [profilePolar getPlotConfig()]`
	}
}

export const profilePolarInit = getCompInit(profilePolar)
// this alias will allow abstracted dynamic imports
export const componentInit = profilePolarInit
