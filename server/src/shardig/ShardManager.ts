import serverconfig from '#src/serverconfig.js'
import { TileServerShard } from '#src/shardig/TileServerShard.js'
import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.js'

export class ShardManager {
	map: Map<string, ShardingAlgorithm<any>> | undefined
}
