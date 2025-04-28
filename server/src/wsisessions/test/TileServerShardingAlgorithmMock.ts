import type { ShardingAlgorithm } from '#src/sharding/ShardingAlgorithm.ts'
import { TileServerShard } from '#src/sharding/TileServerShard.js'

export class TileServerShardingAlgorithmMock implements ShardingAlgorithm<any> {
	private tileServerShard = new TileServerShard('url')

	async getShard(_: string): Promise<TileServerShard> {
		return this.tileServerShard
	}
}
