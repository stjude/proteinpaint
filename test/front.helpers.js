const serverconfig = require('../serverconfig')
const host = 'http://localhost:' + serverconfig.port

const serverData = {}
exports.serverData = serverData

exports.getRunPp = function getRunPp(appname = '', defaultArgs = {}) {
	/*
		Wrap runproteinpaint() to make repeated calls to it more
		convenient and easier to read
		
		Usage example: 
		// initialize with default arguments for all tests
		const runpp = getRunPp('termdb', {
		    state: {
		        dslabel: 'SJLife',
		        genome: 'hg38'
		    },
		    debug: 1,
		    fetchOpts: {
		    	serverData: helpers.serverData
		    }
		}) 

		// supply argument key-values that are 
		// specific to a test section or assertion
		runpp({
			callbacks: {
				app: {
					'postRender.test': testWrongGenome
				}
			}
		})
	*/
	const arg = {
		host,
		noheader: 1,
		nobox: true,
		serverData,
		debug: 1
	}

	// initialize default argument values for all tests
	// if there is an appname, set it's initial config to defaultArgs
	if (appname) arg[appname] = defaultArgs
	// if there is no appname, apply the defaultArgs
	// to the argument root object
	else copyMerge(arg, defaultArgs)

	// set argument as string for creating fresh copy
	const argStr = JSON.stringify(arg)

	// will apply overrides or other argument key-values
	// during tests
	return function runpp(overrides = {}) {
		// create a fresh arg copy to prevent conflicts when
		// the arg is reused in different tests
		const argCopy = JSON.parse(argStr)
		if (appname) copyMerge(argCopy[appname], overrides)
		else copyMerge(argCopy, overrides)
		runproteinpaint(argCopy)
	}
}

function copyMerge(base, ...args) {
	/*
		BORROWED FROM rx.core - to avoid import/export keyword issue

		base: 
		- either an state object or its JSON-stringified equivalent 

		args
		- full or partial state object(s). if base is a string, then
		  the arg object will be converted to/from JSON to
		  create a copy for merging
	*/
	const target = typeof base == 'string' ? JSON.parse(base) : base
	for (const arg of args) {
		if (arg) {
			const source = typeof base == 'string' ? JSON.parse(JSON.stringify(arg)) : arg
			for (const key in source) {
				if (!target[key] || Array.isArray(target[key]) || typeof target[key] !== 'object') target[key] = source[key]
				else copyMerge(target[key], source[key])
			}
		}
	}
	return target
}

exports.copyMerge = copyMerge

exports.rideInit = function(opts = {}) {
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
	const priv = new Ride(opts)

	const ride = {
		// ride on the default event bus
		to(callback, after, sub = {}) {
			/*
			callback()

			after()
			- optional function to call before callback

			sub {}
			- optional substitute values when attaching
			  an event listener. the options are
			.wait      // delay before calling event callback 
			.bus       // attach the callback to this bus 
			           // instead of the rideInit(opts.bus)
			.eventType // attach the callback to this eventType 
			           // instead of the rideInit(opts.eventType) 

		*/
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
			if (opts.bus) priv.resolved.then(() => opts.bus.on(opts.eventType, null))
			if (callback) priv.resolved.then(callback)
			priv.resolved.catch(console.log)
			return ride
		}
	}

	return Object.freeze(ride)
}

class Ride {
	// mutable but private access props and methods
	// when used inside rideInit()

	constructor(opts) {
		this.validateOpts(opts)
		Object.freeze(opts)
		this.resolved = Promise.resolve()
	}

	validateOpts(opts) {
		try {
			if (opts.eventType && !opts.bus) {
				if (!opts.arg) throw 'must specify opts.bus or opts.arg for rideInit() argument'
				opts.bus = opts.arg
			}
			if (opts.bus) {
				if (typeof opts.eventType !== 'string') throw 'invalid default.eventType'
				opts.bus.on(opts.eventType, null)
				return opts
			}
		} catch (e) {
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
		if (typeof after == 'number') {
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
