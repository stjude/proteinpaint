export class NumericRangeInput {
	constructor(holder, range, callback) {
		this.input = holder
			.append('input')
			.attr('name', 'rangeInput')
			.attr('title', `leave blank for the allowed minimum value`)
			.style('width', '180px')
			.style('margin', '3px 5px')
			//.style('font-size', '20px')
			.on('change', () => {
				try {
					this.applyRange()
				} catch (ex) {
					alert(ex)
					this.setRange()
				}
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
		this.callback(new_range)
	}

	getRange() {
		return this.range
	}

	setRange(range) {
		if (!range) range = this.range
		//When an error is thrown the previous range is restored
		else this.range = range

		const start = 'start' in range ? `${range.start} <=` : 'min' in range ? `${range.min} <=` : ''
		const stop = 'stop' in range ? `<= ${range.stop}` : 'max' in range ? `<= ${range.max}` : ''
		this.input.node().value = `${start} x ${stop}`
	}

	parseRange() {
		const str = this.input.node().value
		if (!str) throw 'Empty range'
		const tokens = str.replace(/\s/g, '').split('x')
		let start, stop, startinclusive, stopinclusive

		if (tokens[0]) parseRangeToken(tokens[0])
		if (tokens[1]) parseRangeToken(tokens[1])

		const startunbounded = start === undefined
		const stopunbounded = stop === undefined

		if (!startunbounded && !stopunbounded && start > stop) throw 'start must be lower than stop'

		return { start, stop, startinclusive, stopinclusive, startunbounded, stopunbounded }

		function parseRangeToken(rangeToken) {
			const floatExpr = '[+-]?\\d+(\\.\\d+)?'

			if (new RegExp(`^${floatExpr}<$`).test(rangeToken) || new RegExp(`^>${floatExpr}$`).test(rangeToken)) {
				start = parseFloat(rangeToken.match(floatExpr))
				startinclusive = false
			} else if (new RegExp(`^${floatExpr}<=$`).test(rangeToken) || new RegExp(`^>=${floatExpr}$`).test(rangeToken)) {
				start = parseFloat(rangeToken.match(floatExpr))
				startinclusive = true
			} else if (new RegExp(`^${floatExpr}>$`).test(rangeToken) || new RegExp(`^<${floatExpr}$`).test(rangeToken)) {
				stop = parseFloat(rangeToken.match(floatExpr))
				stopinclusive = false
			} else if (new RegExp(`^${floatExpr}>=$`).test(rangeToken) || new RegExp(`^<=${floatExpr}$`).test(rangeToken)) {
				stop = parseFloat(rangeToken.match(floatExpr))
				stopinclusive = true
			} else if (new RegExp(`^${floatExpr}=$`).test(rangeToken) || new RegExp(`^=${floatExpr}$`).test(rangeToken)) {
				start = stop = parseFloat(rangeToken.match(floatExpr))
				stopinclusive = true
				startinclusive = true
			} else throw `Could not parse expression '${rangeToken}'`
		}
	}
}
