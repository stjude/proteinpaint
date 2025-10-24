import { keyupEnter } from '#src/client'
import type { NumSpline } from '#tw'
import type { NumericHandler } from './NumericHandler.ts'
import type { BoundaryOpts, LineData } from './NumericDensity.ts'
import type { SplineNumericQ, Handler } from '#types'
import { HandlerBase } from '../HandlerBase.ts'

export class NumSplineEditor extends HandlerBase implements Handler {
	tw: NumSpline
	q!: SplineNumericQ
	handler: NumericHandler
	//termsetting: TermSetting
	opts: any
	dom: {
		[elemName: string]: any
	} = {}

	default_knots_count: number = 4

	constructor(opts, handler) {
		super(opts)
		this.opts = opts
		this.handler = handler
		this.tw = handler.tw
	}

	async getDefaultQ() {
		//const q00 = tw.q
		// TODO *** validate this.q ***//
		const tw = this.termsetting.tw as NumSpline
		if (tw.q.mode == 'spline') {
			return JSON.parse(JSON.stringify(tw.q))
		}
		// create default knots when menu renderes for first time
		return await this.getKnots(this.default_knots_count)
		//*** validate this.q ***//
	}

	async getKnots(knot_count: any) {
		// qnery knots from backend
		// knots are calcualted by node backend, 1st knot at 5 percentile,
		// last knot at 95, and inbetween knots at equidistance
		const middle_knot_count = knot_count - 2
		const t = this.tw.term
		const knots: { value: number }[] = []
		const percentile_lst = [5]
		const second_knot_perc: any = (90 / (middle_knot_count + 1)).toFixed(0)
		for (let i = 1; i < middle_knot_count + 1; i++) {
			percentile_lst.push(i * second_knot_perc)
		}
		percentile_lst.push(95)
		const values: any = await this.getPercentile2Value(percentile_lst)
		for (const val of values) {
			knots.push({ value: val.toFixed(t.type == 'integer' ? 0 : 2) })
		}

		return {
			mode: 'spline',
			knots
		}
	}

	async getPercentile2Value(percentile_lst: any) {
		const vocabApi = this.termsetting.vocabApi
		const data = await vocabApi.getPercentile(this.tw.term, percentile_lst, vocabApi.state?.termfilter)
		if (data.error || !data.values.length || !data.values.every(v => Number.isFinite(v)))
			throw 'cannot get median value: ' + (data.error || 'no data')
		const perc_values = [...new Set(data.values)]
		return perc_values
	}

	async showEditMenu(div) {
		if (this.dom.density_div) {
			if (this.handler.dom.editDiv?.node().contains(this.dom.density_div.node())) return
			else {
				this.dom.density_div.remove()
				delete this.dom.density_div
			}
		}
		this.q = await this.getDefaultQ()
		this.dom.density_div = div.append('div')
		await this.handler.density.showViolin(this.dom.density_div)
		await this.handler.density.setBinLines(this.getBoundaryOpts())
		this.dom.knots_div = div.append('div').style('padding', '5px')
		this.renderCustomSplineInputs()
		this.renderAutoSplineInputs()
	}

	getBoundaryOpts(): BoundaryOpts {
		return {
			values: this.q.knots.map(k => {
				return {
					//this.q.lst[0].map(bin => ({ x: bin.startunbounded ? bin.stop : bin.start, isDraggable: true })),
					x: k.value,
					isDraggable: true
				}
			}),
			callback: (d: LineData, value) => {
				this.q.knots[d.index].value = value
				this.dom.customKnotsInput.property('value', this.q.knots.map(k => k.value).join('\n'))
				//this.renderCustomSplineInputs()
				//this.renderAutoSplineInputs()
			}
		}
	}

	/******************* Functions for Custom Spline knots *******************/
	renderCustomSplineInputs() {
		this.dom.custom_knots_div = this.dom.knots_div.append('div')

		this.dom.custom_knots_div
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('padding', '3px 15px')
			.style('font-weight', 'normal')
			.style('color', 'rgb(136, 136, 136)')
			.html('Knots')

		this.dom.customKnotsInput = this.dom.custom_knots_div
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '3px 15px')
			.style('padding-left', '5px')
			.append('textarea')
			.style('height', '100px')
			.style('width', '100px')
			.text(this.q.knots.map((d: any) => d.value).join('\n'))
			.on('change', () => {
				this.q.knots = this.processKnotsInputs()
				this.handler.density.setBinLines(this.getBoundaryOpts())
			})
			.on('keyup', async (event: any) => {
				// enter or backspace/delete
				// i don't think backspace works
				if (!keyupEnter(event) && event.key != 8) return
				this.q.knots = this.processKnotsInputs()
				this.handler.density.setBinLines(this.getBoundaryOpts())
			})

		this.dom.custom_knots_div
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('font-size', '.7em')
			.style('padding', '3px 15px')
			.style('padding-left', '5px')
			.style('color', 'rgb(136, 136, 136)').html(`Enter knot values, one knot per line.</br> 
				Adjust knot by dragging on the vertical line.</br>
			 	Or autocompute knots from below.`)
	}

	// apply custom knots if changed from density plot to textarea
	updateCustomSplineInputs() {
		this.dom.customKnotsInput.property('value', this.q.knots.map((d: any) => d.value).join('\n'))
	}

	// apply custom knots to this.q.knots
	processKnotsInputs() {
		const data = this.dom.customKnotsInput
			.property('value')
			.split('\n')
			.filter((d: any) => d != '')
			.map((d: any) => +d)
			.sort((a: any, b: any) => a - b)
			.map((d: any) => {
				const knot = {
					value: +d
				}
				return knot
			})
		return data
	}

	/******************* Functions for Auto Spline knots *******************/
	renderAutoSplineInputs() {
		const div = this.dom.knots_div
		const knot_count = 4
		const default_knot_count = knot_count
		this.dom.knot_select_div = div.append('div')

		this.dom.knot_select_div
			.append('div')
			.style('display', 'inline-block')
			.style('margin-left', '15px')
			.style('color', 'rgb(136, 136, 136)')
			.html('Autocompute')

		const knot_ct_select = this.dom.knot_select_div
			.append('select')
			.style('margin-left', '10px')
			.style('margin-bottom', '7px')

		for (let i = default_knot_count - 1; i < default_knot_count + 5; i++) {
			knot_ct_select.append('option').attr('value', i).html(i)
		}

		knot_ct_select.node().value = this.q.knots?.length || this.default_knots_count

		this.dom.knot_select_div
			.append('div')
			.style('display', 'inline-block')
			.style('margin-left', '10px')
			.style('color', 'rgb(136, 136, 136)')
			.html('knots')

		this.dom.knot_select_div
			.append('button')
			.style('margin', '15px')
			// .property('disabled', knot_count == knot_ct_select.node().value)
			.html('Compute')
			.on('click', async () => {
				const desired_knots_ct = Number.parseInt(knot_ct_select.node().value)
				let requested_knots_ct = Number.parseInt(knot_ct_select.node().value)
				// request knots util desired_knots are available
				while (this.q.knots.length != desired_knots_ct) {
					await this.getKnots(requested_knots_ct)
					requested_knots_ct = requested_knots_ct + 1
				}
				this.updateCustomSplineInputs()
			})

		this.dom.knot_select_div
			.append('div')
			.style('display', 'inline-block')
			.style('font-size', '.7em')
			.style('padding', '3px 15px')
			.style('padding-left', '5px')
			.style('color', 'rgb(136, 136, 136)')
			.html('Will overwrite existing values.')
	}

	getEditedQ(destroyDom: boolean = true): SplineNumericQ {
		const knots = this.processKnotsInputs()
		if (destroyDom) {
			for (const name of Object.keys(this.dom)) {
				this.dom[name].remove()
				delete this.dom[name]
			}
		}
		return {
			mode: 'spline',
			knots
		}
	}

	async undoEdits() {
		this.q = await this.getDefaultQ()
		this.dom.knots_div.selectAll('*').remove()
		await this.handler.density.setBinLines(this.getBoundaryOpts())
		this.renderCustomSplineInputs()
		this.renderAutoSplineInputs()
	}
}
