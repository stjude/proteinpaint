exports.serverData = {}

/*
	The exported rideInit() test helper function tries to 
	reliably sequence UI tests primarily via postRender
	callbacks as emitted by an event bus. 

	The idea is to minimize the dependency on less reliable,
	timeout-based triggers of when to test UI elements, whereas
	a postRender event would only be called when the
	component of interest has been reached. If it is not
	called, then the issue is either due a missing event
	emitter or an upstream component not getting to the point
	of triggering the re-render of the current component.
*/

/*
	rideInit with publicly accessible props and methods
	opts {}        
	.bus         optional event bus returned by client.get_event_bus()
	.eventType   optional eventType for the bus argument, required if bus is provided
	.arg         optional argument to supply to the to() callback
	.wait        optional wait time before reacting to emitted bus.event
*/
exports.rideInit = function(opts) {
	"use strict"

	const priv = new Ride(Object.freeze(opts))

	const ride = {
		// ride on the default event bus
		to(callback, after, sub = {}) {
			priv.addToThen(callback, after, Object.assign({}, opts, sub))
			return ride
		},

		// run callback without using bus, with or without timeout
		run(callback, after = 0) {
			priv.addRunThen(callback, after, opts)
			return ride
		},

		// close the event bus
		done(callback = null) {
			priv.resolved.then(() => opts.bus.on(opts.eventType, null))
			if (callback) priv.resolved.then(callback)
			priv.resolved.catch(console.log)
			return ride
		}
	}

	return Object.freeze(ride)
}

// mutable but private access props and methods
// when used, as intended, inside rideInit()
class Ride {
	constructor(opts) {
		this.validateOpts(opts)
		this.resolved = Promise.resolve()
	}

	validateOpts(opts) {
		try {
			if (opts.bus) {
				if (typeof opts.eventType !== "string") throw "invalid default.eventType"
				opts.bus.on(opts.eventType, null)
				return opts
			}
		} catch {
			console.log(e)
		}
	}

	addToThen(callback, after, opts = {}) {
		if (opts.wait) {
			this.resolved = this.resolved.then(() => {
				return new Promise((resolve, reject) => {
					opts.bus.on(opts.eventType, () => {
						setTimeout(() => {
							opts.bus.on(opts.eventType, null)
							callback(opts.arg)
							resolve()
						}, opts.wait)
					})
					after(opts.arg)
				})
			})
		} else {
			this.resolved = this.resolved.then(() => {
				return new Promise((resolve, reject) => {
					opts.bus.on(opts.eventType, () => {
						opts.bus.on(opts.eventType, null)
						callback(opts.arg)
						resolve()
					})
					after(opts.arg)
				})
			})
		}
	}

	addRunThen(callback, after, opts) {
		if (typeof after == "number") {
			this.resolved = this.resolved.then(() => {
				return new Promise((resolve, reject) => {
					setTimeout(() => {
						callback(opts.arg)
						resolve()
					}, after)
				})
			})
		} else {
			this.resolved = this.resolved.then(() => {
				callback(opts.arg)
			})
		}
	}
}
