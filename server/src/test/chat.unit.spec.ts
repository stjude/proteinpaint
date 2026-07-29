/********************************************
Unit Test for isMsgToUser() (server/src/chat/scaffoldTypes.ts)
Run with:  node server/src/test/chat.unit.spec.ts
*********************************************/

import tape from 'tape'
import { isMsgToUser } from '../chat/scaffoldTypes.ts'
import { getChatRelatedPlotTypes } from '../chat/utils.ts'
import { resolveToPlotState } from '../chat/scaffold2state.ts'

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
