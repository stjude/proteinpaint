import tape from 'tape'
import * as d3s from 'd3-selection'
import type { JunctionTerm } from '#types'
import {
	deleteJunction,
	deleteJunctionEvent,
	publishJunction,
	subscribeJunctions,
	type PublishedJunction
} from '../junction.broker.ts'

function makeJunction(id: string): JunctionTerm {
	return {
		type: 'junction',
		id,
		name: id,
		chr: 'chr1',
		start: 100,
		stop: 200,
		strand: '+',
		info: {}
	} as JunctionTerm
}

function publish(key: string, junctions: JunctionTerm[], eventlabel?: string) {
	const holder = d3s.select('body').append('div')
	const button = holder.append('button').node() as HTMLButtonElement
	const msgDiv = holder.append('div')
	publishJunction(key, junctions, button, msgDiv, eventlabel)
	return { holder, button, msgDiv }
}

tape('\n', test => {
	test.comment('-***- termdb/handlers/junction.broker -***-')
	test.end()
})

tape('publishJunction() publishes ungrouped junctions and updates its source UI', test => {
	const key = 'junction-broker-test:ungrouped'
	let selected: PublishedJunction[] = []
	const unsubscribe = subscribeJunctions(key, terms => {
		selected = terms
	})
	const { holder, button, msgDiv } = publish(key, [makeJunction('junction-1')])

	test.equal(selected.length, 1, 'publishes one junction')
	test.equal(selected[0].id, 'junction-1', 'publishes the expected junction')
	test.notOk(selected[0].eventlabel, 'does not add an event label')
	test.notOk(button.isConnected, 'removes the source button')
	test.ok(msgDiv.text().includes('variable selection'), 'shows a confirmation message')

	unsubscribe()
	holder.remove()
	test.end()
})

tape('publishJunction() groups junctions by event label and deduplicates members', test => {
	const key = 'junction-broker-test:event'
	let selected: PublishedJunction[] = []
	const unsubscribe = subscribeJunctions(key, terms => {
		selected = terms
	})

	publish(key, [makeJunction('junction-1'), makeJunction('junction-2')], 'Event A').holder.remove()
	publish(key, [makeJunction('junction-2')], 'Event A').holder.remove()

	test.equal(selected.length, 2, 'deduplicates a junction within the same event')
	test.ok(
		selected.every(term => term.eventlabel === 'Event A'),
		'adds the event label to every member'
	)

	unsubscribe()
	test.end()
})

tape('delete functions remove individual and event choices and notify subscribers', test => {
	const key = 'junction-broker-test:delete'
	let selected: PublishedJunction[] = []
	const unsubscribe = subscribeJunctions(key, terms => {
		selected = terms
	})

	publish(key, [makeJunction('ungrouped')]).holder.remove()
	publish(key, [makeJunction('event-1'), makeJunction('event-2')], 'Event A').holder.remove()
	deleteJunction(key, 'ungrouped')
	test.deepEqual(
		selected.map(term => term.id),
		['event-1', 'event-2'],
		'deletes only the ungrouped junction'
	)

	deleteJunctionEvent(key, 'Event A')
	test.equal(selected.length, 0, 'deletes the complete event group')

	unsubscribe()
	test.end()
})
