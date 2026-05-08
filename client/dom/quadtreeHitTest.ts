import type { Quadtree } from 'd3-quadtree'

/**
 * Searches a quadtree for all points within a specified radius of target coordinates.
 *
 * Generic over the point type T. By default reads `pixel_x`/`pixel_y` from each
 * datum (matching ManhattanPoint); pass `getX`/`getY` to use other coordinate
 * fields (e.g. `x`/`y` for the volcano plot).
 *
 * @param qt - D3 quadtree containing T-typed point data
 * @param mx - Target x coordinate (in pixels, in quadtree-local space)
 * @param my - Target y coordinate (in pixels, in quadtree-local space)
 * @param hitRadius - Search radius (in pixels)
 * @param getX - Optional accessor for the point's x coord (default: d.pixel_x)
 * @param getY - Optional accessor for the point's y coord (default: d.pixel_y)
 * @returns Array of points within radius with their distances
 */
export function findPointsInRadius<T>(
	qt: Quadtree<T>,
	mx: number,
	my: number,
	hitRadius: number,
	getX: (d: T) => number = (d: any) => d.pixel_x,
	getY: (d: T) => number = (d: any) => d.pixel_y
): Array<{ point: T; distance: number }> {
	const candidates: Array<{ point: T; distance: number }> = []

	qt.visit((node, x1, y1, x2, y2) => {
		// Skip this node if it's outside the search radius
		if (x1 > mx + hitRadius || x2 < mx - hitRadius || y1 > my + hitRadius || y2 < my - hitRadius) {
			return true // Skip this branch
		}

		// If this is a leaf node, check ALL points (including coincident ones)
		if (!node.length) {
			// Traverse the linked list of coincident points
			let current: any = node
			while (current) {
				const point = current.data as T | undefined
				if (point) {
					const px = getX(point)
					const py = getY(point)
					const distance = Math.sqrt((mx - px) ** 2 + (my - py) ** 2)

					if (distance <= hitRadius) {
						candidates.push({ point, distance })
					}
				}
				current = current.next // Move to next coincident point
			}
		}

		return false // Don't stop early - check all nodes in radius
	})

	return candidates
}
