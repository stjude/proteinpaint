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

exports.promiser = function(bus, eventType, arg) {
	let resolved = Promise.resolve()
	const promiser = {
		listenAndTrigger(listener, trigger) {
			return () => {
				return new Promise((resolve, reject) => {
					bus.on(eventType, () => {
						listener(arg)
						resolve()
					})
					trigger(arg)
				})
			}
		},
		chain(listener, trigger) {
			if (listener) {
				if (trigger) {
					resolved = resolved.then(promiser.listenAndTrigger(listener, trigger))
				} else {
					resolved = resolved.then(() => {
						listener(arg)
					})
				}
			} else {
				resolved = resolved.then(() => {
					bus.on(eventType, null)
					if (trigger) trigger()
				})
			}
			return promiser
		},
		catch() {
			resolved.catch(e => console.log(e))
		}
	}

	return promiser
}
