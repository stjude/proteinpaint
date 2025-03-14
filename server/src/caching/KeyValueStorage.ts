import { TileServerShard } from '#src/shardig/TileServerShard.ts'
import { ClientHolder } from '#src/caching/ClientHolder.js'

export interface KeyValueStorage {
	isNodeOnline(url: string, timeout: number): Promise<boolean>

	set(key: string, value: string): Promise<void>

	getClient(url: string): ClientHolder<any> | undefined

	get(key: string): Promise<string | null | undefined>

	getAll(key: string): Promise<string[]>

	update(key: string, sessions: any, tileServerShard: TileServerShard): Promise<void>

	delete(key: string): Promise<number | undefined>

	exists(key: string): Promise<boolean>
}
