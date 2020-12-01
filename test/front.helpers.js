const serverconfig = require('../serverconfig')
const host = 'http://localhost:' + serverconfig.port
const serverData = Object.create(null)

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
			app: {
				callbacks: {
					'postRender.test': testWrongGenome
				}
			}
		})
	*/
	const arg = {
		host,
		noheader: 1,
		nobox: true,
		debug: 1,
		norecover: true
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
		// !!! but REUSE the same serverData !!!
		const argCopy = JSON.parse(argStr)
		if (appname) copyMerge(argCopy[appname], overrides)
		else copyMerge(argCopy, overrides)

		// reuse the same serverData to share
		// cached response across tests
		if (appname && defaultArgs.fetchOpts) {
			argCopy[appname].fetchOpts = defaultArgs.fetchOpts
		}
		runproteinpaint(Object.assign(argCopy, { serverData }))
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
		reliably sequence UI tests using chained Promises, with
		each Promise either (a) riding on an event bus (such as
		tree postRender), or (b) riding just on the Promise
		chain itself (without using an event bus). 

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
	const self = new Ride(opts)

	const rideApi = {
		// ride on the default event bus

		/*
			temporary second argument flexibility to support legacy test code
			while also enabling the new usage pattern where, moving forward,
			the second argument should always be sub{} (never a function)
		*/
		to(callback, afterOrSub = null, _sub = {}) {
			/*
			callback()

			afterOrSub: // temporary flexibility to support legacy code
			- optional, either 
			  trigger function to call before callback
			  - OR -
			  sub{}

			sub {}
			- optional substitute values when attaching
			  an event listener, *** just for this 1 step ***. 
			  the options are wait, bus, eventType
			  as listed for the rideInit() opts{} argument

		*/
			const after = typeof afterOrSub === 'function' ? afterOrSub : null

			const sub = typeof afterOrSub === 'function' ? _sub : afterOrSub ? afterOrSub : {}

			self.addToThen(callback, Object.assign({}, opts, sub), after)
			return rideApi
		},

		use(triggerFxn, sub = {}) {
			/*
				will supply the triggerFxn for use in the next 
				Promise.then(), so that it can trigger the event
				that the bus listener is waiting for
			*/
			self.addUseThen(triggerFxn, Object.assign({}, opts, sub))
			return rideApi
		},

		change(sub = {}) {
			/*
			change the opts for *** ALL subsequent steps ***

			sub {}
			- optional substitute values when attaching
			  an event listener. the options are wait, bus, eventType
			  as listed for the rideInit() opts{} argument
			*/
			Object.assign(opts, sub)
			return rideApi
		},

		// run callback without using bus, with or without timeout
		run(callback, after = 0) {
			self.addRunThen(callback, after, opts)
			return rideApi
		},

		// close the event bus
		done(test) {
			// cancel event listener after the tests so that
			// in-browser behavior is "normal" when inspecting
			// the displayed UI
			if (opts.bus) self.resolved.then(() => opts.bus.on(opts.eventType, null))
			self.resolved.then(() => test.end()).catch(console.log)
			return rideApi
		}
	}

	return Object.freeze(rideApi)
}

class Ride {
	// mutable but private access props and methods
	// when used inside rideInit()

	constructor(opts) {
		this.validateOpts(opts)
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

	/*
		temporarily allow third argument to support legacy test code
	*/
	addToThen(callback, opts, after) {
		if (!after) {
			this.resolved = this.resolved.then(async triggerFxn => {
				opts.bus.on(opts.eventType, null)
				return new Promise(async (resolve, reject) => {
					opts.bus.on(opts.eventType, async () => {
						await sleep(opts.wait)
						callback(opts.arg)
						resolve()
					})
					if (triggerFxn) await triggerFxn()
				})
			})
		} else if (opts.wait) {
			this.resolved = this.resolved.then(async () => {
				return new Promise((resolve, reject) => {
					opts.bus.on(opts.eventType, () => {
						setTimeout(async () => {
							opts.bus.on(opts.eventType, null)
							await callback(opts.arg)
							resolve()
						}, opts.wait)
					})
					if (typeof after == 'function') after(opts.arg)
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
					if (typeof after == 'function') after(opts.arg)
				})
			})
		}
	}

	// prepare a trigger function for use in the pattern
	// rideInit().use(triggerFxn).to(...)
	//
	// .use() enables setting a different opts.arg to be used for triggerFxn
	//
	addUseThen(triggerFxn, opts) {
		//Promise(resolve => setTimeout(resolve, ms))
		this.resolved = this.resolved.then(async () => {
			console.log('triggerFxn', triggerFxn.name)
			// supply a trigger function as argument to the next .then()
			await sleep(isNaN(opts.wait) ? 0 : opts.wait)
			return () => triggerFxn(opts.arg)
		})
	}

	addRunThen(callback, after, opts) {
		this.resolved = this.resolved.then(async () => {
			await sleep(typeof after == 'number' ? after : 0)
			callback(opts.arg)
		})
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/*
let visualCheckIsActive = false
exports.visualCheck = function renderingTest() {
	if (visualCheckIsActive) return
	visualCheckIsActive = true
	const d3s = require('d3-selection')
	const d3t = require('d3-transition')
	
	const v= {i:0, j:0}
	for(const k in v) {
		const div = d3s.select('body')
			.append('div')
			.attr('class', 'test-div')
			.style('position','fixed')
			.style('height', '50px')
			.style('top', k=='i' ? '50px' : '70px')
			.style('font-size', '36px')
			.style('color','#f00')
			.style('background', k=='i' ? '#ccc' : '#3f3f3f')
			.style('z-index', 100)
		
		setInterval(()=>div
			.text(v[k]+=1)
			.transition()
			.duration(200)
			.style('width', (k=='i' && v[k]%2 == 0) || (k=='j' && v[k]%2 != 0) ? '500px' : '100px'), 500)
	}
}
*/
