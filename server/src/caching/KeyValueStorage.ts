import type { TileServerShard } from '#src/sharding/TileServerShard.ts'
import type { ClientHolder } from '#src/caching/ClientHolder.ts'
import type { SessionData } from '#src/wsisessions/SessionManager.ts'

export interface KeyValueStorage {
	isNodeOnline(url: string, timeout: number): Promise<boolean>

	set(key: string, value: string): Promise<void>

	getClient(url: string): ClientHolder<any> | undefined

	get(key: string): Promise<string | null | undefined>

	getAllKeys(key: string): Promise<string[]>

	getAllKeys(key: string): Promise<string[]>

	getAllKeyValues(key: string): Promise<{ key: string; sessionData: SessionData | undefined }[]>

	update(key: string, sessions: any, tileServerShard: TileServerShard): Promise<void>

	delete(key: string): Promise<number | undefined>

	exists(key: string): Promise<boolean>
}
