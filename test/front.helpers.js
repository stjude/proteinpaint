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
		listenAndTrigger(listeners, trigger) {
			return () => {
				return new Promise((resolve, reject) => {
					bus.on(eventType, () => {
						for (const fxn of listeners) fxn(arg)
						resolve()
					})
					trigger(arg)
				})
			}
		},
		chain(listeners, trigger) {
			if (trigger) {
				resolved = resolved.then(promiser.listenAndTrigger(listeners, trigger))
			} else if (!listeners) {
				bus.on(eventType, null)
				if (trigger) trigger()
			} else {
				resolved = resolved.then(() => {
					for (const fxn of listeners) fxn(arg)
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
