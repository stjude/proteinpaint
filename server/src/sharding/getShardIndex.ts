import * as crypto from 'crypto'

export function getShardIndex(key: string, numShards: number): number {
	const hash = crypto.createHash('sha256').update(key).digest('hex')
	const hashCut = parseInt(hash.slice(0, 8), 16)
	return hashCut % numShards
}
