export interface ShardingAlgorithm<ShardType> {
	getShard(key: string): ShardType
}
