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
