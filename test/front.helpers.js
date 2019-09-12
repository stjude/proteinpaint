exports.getChain = () => {
	const steps = []
	return (chain = {
		add(callback, opts = {}) {
			if (typeof callback == "function") {
				steps.push({
					fxn: callback,
					opts
				})
			} else {
				throw "invalid callback argument to bus.chain"
			}
			return chain
		},
		next(arg) {
			const step = steps.shift()
			if (!step) return
			setTimeout(
				() => {
					step.fxn(arg)
					chain.next(arg)
				},
				step.opts.timeout ? step.opts.timeout : 0
			)
		}
	})
}

exports.serverData = {}

exports.ride = function(bus, eventType, arg, wait = 0) {
	/*
	bus         an event bus returned by client.get_event_bus
	eventType   a valid eventType for the bus argument
	arg         the default argument to supply to the do() callback
	wait        optional wait time before callback on bus.event
*/
	let resolved = Promise.resolve()

	const ride = {
		do(callback, after) {
			/*
			callback	function to be supplied with (arg)
			after     integer timeout OR a callback function for bus eventType
		*/
			if (typeof after == "number") {
				resolved = resolved.then(() => {
					return new Promise((resolve, reject) => {
						setTimeout(() => {
							callback(arg)
							resolve()
						}, after)
					})
				})
			} else if (typeof after == "function") {
				if (wait) {
					resolved = resolved.then(() => {
						return new Promise((resolve, reject) => {
							bus.on(eventType, () => {
								setTimeout(() => callback(arg), wait)
								resolve()
							})
							after(arg)
						})
					})
				} else {
					resolved = resolved.then(() => {
						return new Promise((resolve, reject) => {
							bus.on(eventType, () => {
								callback(arg)
								resolve()
							})
							after(arg)
						})
					})
				}
			} else {
				resolved = resolved.then(() => callback(arg))
			}
			return ride
		},
		off(callback) {
			resolved
				.then(() => {
					bus.on(eventType, null)
					if (callback) callback()
				})
				.catch(e => console.log(e))
		}
	}

	return ride
}
