/********************************************
Unit Test for isMsgToUser() (server/src/chat/scaffoldTypes.ts)
Run with:  node server/src/test/chat.unit.spec.ts
*********************************************/

import tape from 'tape'
import { isMsgToUser } from '../chat/scaffoldTypes.ts'

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
