import tape from 'tape'
import { dynamicSubplotInit } from '../subplots/DynamicSubplot'

/**
 * Tests
 *   - init() should set data-testid and build expected dom for non-summary plots
 *   - init() should skip dom creation for summary plots
 *   - getState() should return the matching plot config
 *   - getState() should throw when plot id is missing from state
 *   - main() should call setComponents only once
 *   - destroy() should remove sandbox dom and clear this.dom entries
 */

/* ---- helpers ---- */

function makeSelection() {
	const self: any = {
		attrs: {},
		styles: {},
		children: [],
		appendCalls: [],
		removed: false,
		selectAllArg: undefined,
		selectAllRemoved: false
	}

	self.attr = (name: string, value: any) => {
		self.attrs[name] = value
		return self
	}

	self.style = (name: string, value?: any) => {
		if (value !== undefined) self.styles[name] = value
		return self
	}

	self.append = (tag: string) => {
		self.appendCalls.push(tag)
		const child = makeSelection()
		self.children.push(child)
		return child
	}

	self.selectAll = (selector: string) => {
		self.selectAllArg = selector
		return {
			remove: () => {
				self.selectAllRemoved = true
				return self
			}
		}
	}

	self.remove = () => {
		self.removed = true
		return self
	}

	return self
}

function getMockHolder() {
	return {
		app_div: makeSelection(),
		header: makeSelection(),
		body: makeSelection()
	}
}

function getMockApp(stateOverrides: any = {}) {
	const state = {
		plots: [],
		...stateOverrides
	}
	return {
		debug: true,
		opts: { debug: true },
		vocabApi: {},
		dispatch: (_action: any) => {},
		getState: () => state,
		isAbortError: (_e: any) => false
	} as any
}

async function getInner(overrides: any = {}) {
	const holder = overrides.holder || getMockHolder()
	const app = overrides.app || getMockApp(overrides.state || {})
	const api = await dynamicSubplotInit({
		app,
		holder,
		chartType: overrides.chartType || 'umap',
		id: overrides.id || 'subplot1',
		parentId: overrides.parentId || 'parent1',
		isMetaResult: overrides.isMetaResult || false,
		debug: true
	})
	return { inner: (api as any).Inner, holder, app }
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/subplots/DynamicSubplot -***-')
	test.end()
})

tape('init() should set test id and build dom for non-summary plots', async test => {
	const { inner, holder } = await getInner({ chartType: 'umap' })

	test.equal(
		holder.app_div.attrs['data-testid'],
		'sjpp-sc-subplot-sandbox-umap',
		'Should set chart-specific data-testid on sandbox'
	)
	test.equal(inner.dom.holder, holder, 'Should store holder on this.dom')
	test.equal(holder.body.appendCalls.length, 2, 'Should append viz and error divs to body')
	test.equal(holder.header.appendCalls.length, 2, 'Should append title and filter divs to header')
	test.equal(inner.dom.viz.styles.position, 'relative', 'Should set relative positioning for viz div')
	test.end()
})

tape('init() should skip dom creation for summary plots', async test => {
	const { inner, holder } = await getInner({ chartType: 'summary' })

	test.equal(
		holder.app_div.attrs['data-testid'],
		'sjpp-sc-subplot-sandbox-summary',
		'Should still set data-testid for summary sandbox'
	)
	test.deepEqual(inner.dom, {}, 'Should not create dom nodes for summary plot')
	test.equal(holder.body.appendCalls.length, 0, 'Should not append body children for summary')
	test.equal(holder.header.appendCalls.length, 0, 'Should not append header children for summary')
	test.end()
})

tape('getState() should return config for matching plot id', async test => {
	const appState = {
		plots: [
			{ id: 'subplot1', chartType: 'umap' },
			{ id: 'other', chartType: 'summary' }
		]
	}
	const { inner } = await getInner({ state: appState, id: 'subplot1' })
	const result = inner.getState(appState)

	test.equal(result.config.id, 'subplot1', 'Should return matching config object')
	test.equal(result.config.chartType, 'umap', 'Should preserve config contents')
	test.end()
})

tape('getState() should throw if plot id is not found', async test => {
	const { inner } = await getInner({ id: 'missing', state: { plots: [] } })

	test.throws(
		() => inner.getState({ plots: [] }),
		/No plot with id='missing' found/,
		'Should throw a helpful missing-plot error'
	)
	test.end()
})

tape('main() should call setComponents only once when components are unset', async test => {
	const { inner } = await getInner({ chartType: 'umap' })
	let calls = 0
	inner.components = undefined
	inner.setComponents = async () => {
		calls++
		inner.components = { chart: {} }
	}

	await inner.main()
	await inner.main()

	test.equal(calls, 1, 'Should initialize components only on first main() call')
	test.ok(inner.components, 'Should keep initialized components')
	test.end()
})

tape('destroy() should remove sandbox and clear dom map', async test => {
	const { inner, holder } = await getInner({ chartType: 'umap' })

	inner.destroy()

	test.equal(holder.app_div.selectAllArg, '*', 'Should clear all sandbox children first')
	test.equal(holder.app_div.selectAllRemoved, true, 'Should remove selected sandbox children')
	test.equal(holder.app_div.removed, true, 'Should remove sandbox root div')
	test.equal(Object.keys(inner.dom).length, 0, 'Should delete all dom references after destroy')
	test.end()
})
