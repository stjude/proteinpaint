// import Data from '#plots/disco/data/Data.ts'

export class PercentileMapper {
	map(data: Array<number>, percentile: number) {
		return this.calculatePercentileForPositivesAndNegatives(data, percentile)
	}

	private calculatePercentileForPositivesAndNegatives(
		data: Array<number>,
		percentile: number
	): {
		positive: number
		negative: number
	} {
		// Filter positive and negative numbers
		const positives = data.filter(x => x > 0)
		const negatives = data.filter(x => x < 0).map(x => -1 * x)

		let positive = NaN
		let negative = NaN

		if (positives.length > 0) {
			positive = this.calculatePercentile(positives, percentile)
		}

		if (negatives.length > 0) {
			negative = -1 * this.calculatePercentile(negatives, percentile)
		}

		return { positive: positive, negative: negative }
	}

	private calculatePercentile(data: Array<number>, percentile: number): number {
		if (data.length === 0) {
			throw new Error('Array must contain at least one element.')
		}

		const sortedValues = data.sort((a, b) => a - b)
		const index = (percentile / 100) * (sortedValues.length - 1)

		const lowerIndex = Math.floor(index)
		const upperIndex = Math.ceil(index)
		const fraction = index - lowerIndex

		if (lowerIndex === upperIndex) {
			return sortedValues[lowerIndex]
		}

		return sortedValues[lowerIndex] + fraction * (sortedValues[upperIndex] - sortedValues[lowerIndex])
	}
}
