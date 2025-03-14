import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.js'

export class TileServerShardingAlgorithmMock implements ShardingAlgorithm<any> {
	getShard(key: string): Promise<any> {
		throw new Error('Method not implemented.')
	}
}
