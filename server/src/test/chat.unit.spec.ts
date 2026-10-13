/********************************************
Unit Test for isMsgToUser() (server/src/chat/scaffoldTypes.ts)
Run with:  node server/src/test/chat.unit.spec.ts
*********************************************/

import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { isMsgToUser } from '../chat/scaffoldTypes.ts'
import { getChatRelatedPlotTypes } from '../chat/utils.ts'
import { resolveToPlotState } from '../chat/scaffold2state.ts'
import { init as initTestDs } from '#src/test/load.testds.js'
import { server_init_db_queries } from '#src/termdb.server.init.ts'
import { getAuthApi, authApi } from '#src/auth.js'

tape('scaffoldTypes.ts  - isMsgToUser - valid MsgToUser object', async t => {
	const testCase = { type: 'text', text: 'This is a test message.' }
	const result = isMsgToUser(testCase)
	t.ok(result, 'Should return true for valid MsgToUser object')
	t.equal(typeof result, 'boolean', 'Result should be a boolean')
	t.equal(result, true, 'Should be true')
})

tape('scaffoldTypes.ts  - isMsgToUser - invalid object1: message field instead of text', async t => {
	const invalidCase = { type: 'text', message: 'This is an invalid message.' }
	const result = isMsgToUser(invalidCase)
	t.equal(typeof result, 'boolean', 'Result should be a boolean')
	t.equal(result, false, 'Should be false')
})

tape('scaffoldTypes.ts  - isMsgToUser - invalid object2: type plot instead of text', async t => {
	const invalidCase = { type: 'plot', text: 'This is an invalid message.' }
	const result = isMsgToUser(invalidCase)
	t.equal(typeof result, 'boolean', 'Result should be a boolean')
	t.equal(result, false, 'Should be false')
})

tape('chat utils - keeps Cox as a supported chat plot type', t => {
	t.ok(getChatRelatedPlotTypes(['regression', 'cox']).includes('cox'), 'Cox should remain available to chat')
	t.end()
})

tape('scaffold2state - converts Cox input to regression plot state', async t => {
	const state = await resolveToPlotState(
		{
			outcome: { id: 'os', type: 'survival', q: { mode: 'cox' } },
			independent: [{ id: 'agedx', type: 'integer', q: { mode: 'continuous' } }]
		},
		'cox',
		{}
	)
	t.deepEqual(
		state,
		{
			type: 'plot',
			plot: {
				chartType: 'regression',
				regressionType: 'cox',
				outcome: { id: 'os', type: 'survival', q: { mode: 'cox' } },
				independent: [{ id: 'agedx', type: 'integer', q: { mode: 'continuous' } }]
			}
		},
		'Cox should produce the client regression plot state'
	)
	t.end()
})

tape('scaffold2state - a differential expression plot state gives its groups as filters', async t => {
	// assign the shared open-access api once, as the other unit specs do
	if (!authApi) {
		const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
		await getAuthApi(app, {}, {}, true)
	}
	const tdb = await initTestDs('termdb.test.ts')
	server_init_db_queries(tdb.ds)
	// the cache subdir that CacheManager creates when a server launches
	fs.mkdirSync(path.join(serverconfig.cachedir, 'samplelst'), { recursive: true })
	const filter = (key: string) => ({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [{ type: 'tvs', tvs: { term: { id: 'diaggrp', type: 'categorical' }, values: [{ key }] } }]
	})
	const input = { filter1: filter('Acute lymphoblastic leukemia'), filter2: filter('Non-Hodgkin lymphoma') }
	const state: any = await resolveToPlotState(input, 'dge', tdb.ds)
	const groups = state.plot.samplelst.groups
	t.equal(groups.length, 2, 'should have two groups')
	t.deepEqual(
		groups.map((g: any) => g.filter),
		[input.filter1, input.filter2],
		'should define each group by its filter'
	)
	t.ok(
		groups.every((g: any) => !('values' in g) && g.sampleCount > 0),
		'should give the number of samples of each group, and list none'
	)
	t.equal(state.plot.tw.q.groups, groups, 'should use the same groups for the samplelst term')
	t.ok(
		Object.values(state.plot.tw.term.values).every((v: any) => !('list' in v)),
		'should list no sample in the term either'
	)

	t.end()
})
