exports.getChain = () => {
	const steps = []
	return (chain = {
		next(callback, opts = {}) {
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
		start(arg) {
			const next = steps.shift()
			if (!next) return
			setTimeout(
				() => {
					next.fxn(arg)
					chain.start(arg)
				},
				next.opts.timeout ? next.opts.timeout : 0
			)
		}
	})
	return chain
}
