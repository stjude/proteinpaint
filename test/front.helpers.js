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
	bus         an event bus returned by client.get_event_bus()
	eventType   a valid eventType for the bus argument
	arg         the argument to supply to the do() callback
	wait        optional wait time before callback on bus.event
*/
	bus.on(eventType, null)
	let resolved = Promise.resolve()

	const ride = {
		do(callback, after, wwait = 0) {
			/*
			callback	function to be supplied with (arg)
			after     integer timeout OR a callback function for bus eventType
		*/
			if (typeof after == "number") {
				resolved = resolved.then(() => {
					bus.on(eventType, null)
					return new Promise((resolve, reject) => {
						setTimeout(() => {
							//console.log('---- timeout --- ', after, after.name, callback.name)
							callback(arg)
							resolve()
						}, after)
					})
				})
			} else if (typeof after == "function") {
				if (wwait || wait) {
					resolved = resolved.then(() => {
						return new Promise((resolve, reject) => {
							bus.on(eventType, () => {
								setTimeout(() => {
									//console.log('---- on emit --- ', wait, after.name, callback.name)
									bus.on(eventType, null)
									callback(arg)
									resolve()
								}, wwait || wait)
							})
							after(arg)
						})
					})
				} else {
					resolved = resolved.then(() => {
						return new Promise((resolve, reject) => {
							bus.on(eventType, () => {
								//console.log('----- on emit --- ', after.name, callback.name)
								bus.on(eventType, null)
								callback(arg)
								resolve()
							})
							after(arg)
						})
					})
				}
			} else {
				resolved = resolved.then(() => {
					bus.on(eventType, null)
					callback(arg)
				})
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
