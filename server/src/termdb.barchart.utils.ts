/** Reconstruct the term wrappers encoded by the barsql request. */
export function getTermWrapperMap(q: any) {
	const map = new Map<number, any>()
	for (let i = 0; i <= 2; i++) {
		let tw: any = null
		if (q[`term${i}_id`]) {
			const id = q[`term${i}_id`]
			tw = {
				id,
				type: q[`term${i}_type`],
				q: q[`term${i}_q`],
				term: { id },
				$id: q[`term${i}_$id`]
			}
		} else if (q[`term${i}`]) {
			tw = {
				type:
					q[`term${i}_type`] ||
					(q[`term${i}`].type === 'termCollection' && Array.isArray(q[`term${i}_q`]?.denominators)
						? 'TermCollectionTWFraction'
						: undefined),
				term: q[`term${i}`],
				q: q[`term${i}_q`],
				$id: q[`term${i}_$id`]
			}
		}
		if (tw) map.set(i, tw)
	}
	return map
}
