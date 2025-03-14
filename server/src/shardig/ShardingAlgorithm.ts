export interface ShardingAlgorithm<ShardType> {
	getShard(key: string): Promise<ShardType>
}
