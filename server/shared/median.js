export function median(arr0) {
	let arr = arr0
	if (typeof arr0[0] == 'string') {
		// somehow the values can be string but not numbers
		// must cast to numbers to properly compute median
		arr = arr0.map(Number)
	}

	const mid = Math.floor(arr.length / 2),
		nums = [...arr].sort((a, b) => a - b)
	let median = arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
	median = Math.abs(median) < 1 ? median.toPrecision(1) : median.toFixed(1)
	return median
}
