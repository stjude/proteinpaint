import { ShardingAlgorithm } from '#src/sharding/ShardingAlgorithm.ts'
import { TileServerShard } from '#src/sharding/TileServerShard.js'

export class TileServerShardingAlgorithmMock implements ShardingAlgorithm<any> {
	private tileServerShard = new TileServerShard('url')

	async getShard(key: string): Promise<TileServerShard> {
		return this.tileServerShard
	}
}
