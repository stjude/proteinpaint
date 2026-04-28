import tape from 'tape'
import { quadtree } from 'd3-quadtree'
import { findPointsInRadius } from '../quadtreeHitTest'

type DefaultPoint = { id: string; pixel_x: number; pixel_y: number }
type CustomPoint = { id: string; x: number; y: number }

function buildDefaultQt(points: DefaultPoint[]) {
	return quadtree<DefaultPoint>()
		.x(d => d.pixel_x)
		.y(d => d.pixel_y)
		.addAll(points)
}

tape('\n', t => {
	t.comment('-***- dom/quadtreeHitTest -***-')
	t.end()
})

tape('empty quadtree returns empty array', t => {
	const qt = buildDefaultQt([])
	const hits = findPointsInRadius(qt, 0, 0, 10)
	t.deepEqual(hits, [], 'no candidates from an empty tree')
	t.end()
})

tape('no points within radius returns empty array', t => {
	const qt = buildDefaultQt([{ id: 'a', pixel_x: 100, pixel_y: 100 }])
	const hits = findPointsInRadius(qt, 0, 0, 10)
	t.deepEqual(hits, [], 'distant point is not picked up')
	t.end()
})

tape('single point within radius returns one hit with correct distance', t => {
	const qt = buildDefaultQt([{ id: 'a', pixel_x: 3, pixel_y: 4 }])
	const hits = findPointsInRadius(qt, 0, 0, 10)
	t.equal(hits.length, 1, 'one candidate returned')
	t.equal(hits[0].point.id, 'a', 'returns the right point')
	t.equal(hits[0].distance, 5, 'Euclidean distance from (0,0) to (3,4) is 5')
	t.end()
})

tape('multiple points within radius all returned', t => {
	const qt = buildDefaultQt([
		{ id: 'a', pixel_x: 0, pixel_y: 0 },
		{ id: 'b', pixel_x: 1, pixel_y: 0 },
		{ id: 'c', pixel_x: 0, pixel_y: 2 },
		{ id: 'far', pixel_x: 100, pixel_y: 100 }
	])
	const hits = findPointsInRadius(qt, 0, 0, 5)
	const ids = hits.map(h => h.point.id).sort()
	t.deepEqual(ids, ['a', 'b', 'c'], 'three nearby points returned, distant excluded')
	t.end()
})

tape('coincident points at the same coordinates are all returned', t => {
	// Three points at the exact same x/y exercise the leaf linked-list traversal
	// (node.next loop). A naive implementation that reads only node.data would
	// miss two of them.
	const qt = buildDefaultQt([
		{ id: 'a', pixel_x: 50, pixel_y: 50 },
		{ id: 'b', pixel_x: 50, pixel_y: 50 },
		{ id: 'c', pixel_x: 50, pixel_y: 50 }
	])
	const hits = findPointsInRadius(qt, 50, 50, 1)
	const ids = hits.map(h => h.point.id).sort()
	t.deepEqual(ids, ['a', 'b', 'c'], 'all coincident points returned')
	for (const h of hits) t.equal(h.distance, 0, 'distance is 0 for coincident point')
	t.end()
})

tape('point at exactly the radius is included; just outside is excluded', t => {
	const qt = buildDefaultQt([
		{ id: 'on', pixel_x: 10, pixel_y: 0 },
		{ id: 'just_inside', pixel_x: 9.9, pixel_y: 0 },
		{ id: 'just_outside', pixel_x: 10.1, pixel_y: 0 }
	])
	const hits = findPointsInRadius(qt, 0, 0, 10)
	const ids = hits.map(h => h.point.id).sort()
	t.deepEqual(ids, ['just_inside', 'on'], 'inclusive at the boundary, excludes points outside')
	t.end()
})

tape('honors custom getX / getY accessors', t => {
	// Quadtree indexed on d.x/d.y (not the default pixel_x/pixel_y).
	const points: CustomPoint[] = [
		{ id: 'a', x: 1, y: 1 },
		{ id: 'b', x: 20, y: 20 }
	]
	const qt = quadtree<CustomPoint>()
		.x(d => d.x)
		.y(d => d.y)
		.addAll(points)
	const hits = findPointsInRadius<CustomPoint>(
		qt,
		0,
		0,
		5,
		d => d.x,
		d => d.y
	)
	t.equal(hits.length, 1, 'only the near point is returned')
	t.equal(hits[0].point.id, 'a', 'accessors point at the right field')
	t.end()
})

tape('returns Euclidean distance, not squared distance', t => {
	const qt = buildDefaultQt([{ id: 'p', pixel_x: 3, pixel_y: 4 }])
	const hits = findPointsInRadius(qt, 0, 0, 10)
	t.equal(hits[0].distance, 5, 'sqrt(9+16) = 5, not 25')
	t.end()
})
