export class NumericRangeInput {
	constructor(holder, range, callback) {
		this.input = holder
			.append('input')
			.attr('class', 'start_input')
			.attr('title', `leave blank for the allowed minimum value`)
			.style('width', '120px')
			.style('margin', '3px 5px')
			//.style('font-size', '20px')
			.on('change', () => {
				this.applyRange()
			})
		this.setRange(range)
		this.callback = callback
	}

	getInput() {
		return this.input
	}

	applyRange() {
		const str = this.input.node().value
		const new_range = this.parseRange(str)
		if (this.range?.min && (new_range.startunbounded || this.range?.min > new_range.start)) {
			throw 'Invalid start value < minimum allowed'
		}
		if (this.range?.max && (new_range.stopunbounded || this.range?.max < new_range.stop)) {
			throw 'Invalid stop value > maximum allowed'
		}
		this.range = new_range
		console.log(this.callback)
		this.callback(new_range)
	}

	getRange() {
		return this.range
	}

	setRange(range) {
		if (!range) return
		const start = 'start' in range ? `${range.start} <=` : 'min' in range ? `${range.min} <=` : ''
		const stop = 'stop' in range ? `<= ${range.stop}` : 'max' in range ? `<= ${range.max}` : ''
		this.input.attr('value', `${start} x ${stop}`)
		this.range = range
	}

	parseRange() {
		const range = this.range
		const str = this.input.node().value
		if (!str) throw 'Empty range'
		const tokens = str.replace(/\s/g, '').split('x')
		let start, stop, startinclusive, stopinclusive

		if (tokens[0]) parseRangeToken(tokens[0])
		if (tokens[1]) parseRangeToken(tokens[1])

		const startunbounded = start === undefined
		const stopunbounded = stop === undefined

		if (!startunbounded && !stopunbounded && start >= stop) throw 'start must be lower than stop'

		return { start, stop, startinclusive, stopinclusive, startunbounded, stopunbounded }

		function parseRangeToken(range) {
			const floatExpr = '[+-]?\\d+(\\.\\d+)?'

			if (new RegExp(`^${floatExpr}<$`).test(range) || new RegExp(`^>${floatExpr}$`).test(range)) {
				start = parseFloat(range.match(floatExpr))
				startinclusive = false
			} else if (new RegExp(`^${floatExpr}<=$`).test(range) || new RegExp(`^>=${floatExpr}$`).test(range)) {
				start = parseFloat(range.match(floatExpr))
				startinclusive = true
			} else if (new RegExp(`^${floatExpr}>$`).test(range) || new RegExp(`^<${floatExpr}$`).test(range)) {
				stop = parseFloat(range.match(floatExpr))
				stopinclusive = false
			} else if (new RegExp(`^${floatExpr}>=$`).test(range) || new RegExp(`^<=${floatExpr}$`).test(range)) {
				stop = parseFloat(range.match(floatExpr))
				stopinclusive = true
			} else throw `Could not parse expression '${range}'`
		}
	}
}
