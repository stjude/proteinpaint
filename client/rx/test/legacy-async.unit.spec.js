import tape from 'tape'
import * as rx from '../index.js'
import * as apiClass from './testInit.ts'
import { ComponentApi } from '../src/ComponentApi.ts'

/*************************
 reusable helper functions
**************************/

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

class TestPart {
	static type = 'part'

	constructor(opts = {}) {
		this.type = TestPart.type
		this.numStale = 0
	}
	getState(appState) {
		return { wait: appState.partWait || 0 }
	}
	async main() {
		try {
			const [a, stale] = await this.api.detectStale(() => sleep(this.state.wait))
			if (stale) this.numStale++
			else this.currWait = this.state.wait
		} catch (e) {
			throw e
		}
	}
}

const partInit = rx.getCompInit(TestPart)

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- rx.core (legacy comp) -***-')
	test.end()
})

tape('getCompInit - async, closured and classed', async function (test) {
	const opts = {
		app: {
			opts: {
				state: { abc: 123 },
				debug: 1
			}
		}
	}

	let part0
	{
		part0 = await partInit(structuredClone(opts))
		test.equal('type' in part0, true, 'should have an api.type property, even if undefined)')
		test.equal('id' in part0, true, 'should set an api.id property, even if undefined')
		test.equal(typeof part0.update, 'function', 'should provide an update() method')
		test.equal(typeof part0.on, 'function', 'should provide an on() method')
		test.equal(typeof part0.getComponents, 'function', 'should provide a getComponents() method')
	}

	{
		const part2 = await apiClass.partInit(structuredClone(opts))
		const missingKeys = new Set()
		for (const key of Object.keys(part0)) {
			if (part0[key] !== undefined && part2[key] === undefined) missingKeys.add(key)
		}
		for (const key in part2) {
			if (part2[key] !== undefined && part0[key] === undefined) missingKeys.add(key)
		}
		test.deepEqual(
			[...missingKeys],
			[],
			`should have the same api properties and methods between closured and classed component api's`
		)
	}

	test.end()
})
