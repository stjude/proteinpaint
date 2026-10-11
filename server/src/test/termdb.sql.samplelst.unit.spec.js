import tape from 'tape'
import { sampleLstSql } from '#src/termdb.sql.samplelst.js'

/*
test sections:

getCTE() makes a CTE from groups that list their samples
getCTE() throws on a group that lists no samples
*/

function getDs() {
	return {
		cohort: { db: { tableColumns: { sampleidmap: ['id', 'name'] } } },
		sampleId2Type: new Map()
	}
}

tape('\n', t => {
	t.comment('-***- termdb.sql.samplelst specs -***-')
	t.end()
})

tape('getCTE() makes a CTE from groups that list their samples', t => {
	const tw = {
		term: { name: 'groups', type: 'samplelst' },
		q: {
			groups: [
				{ name: 'A', values: [{ sampleId: 1 }, { sampleId: 2 }] },
				{ name: 'B', values: [{ sample: 3 }] }
			]
		}
	}
	const cte = sampleLstSql.getCTE(getDs(), 'samplelst_0', tw)
	t.equal(cte.tablename, 'samplelst_0', 'Should return the table name')
	t.ok(cte.sql, 'Should return the sql of the CTE')
	t.deepEqual(
		tw.q.groups.map(g => g.in),
		[true, true],
		'Should default group.in to true'
	)
	t.end()
})

tape('getCTE() throws on a group that lists no samples', t => {
	// a group that came with neither values[] nor a filter
	const tw = {
		term: { name: 'groups', type: 'samplelst' },
		q: { groups: [{ name: 'A', values: [{ sampleId: 1 }] }, { name: 'B' }] }
	}
	t.throws(
		() => sampleLstSql.getCTE(getDs(), 'samplelst_0', tw),
		/a samplelst group lists no samples and has no filter/,
		'Should throw an error that names the problem'
	)
	t.end()
})
