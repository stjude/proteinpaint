import { ClientHolder } from '#src/caching/ClientHolder.ts'
import { KeyValueStorage } from '#src/caching/KeyValueStorage.js'
import { TileServerShard } from '#src/shardig/TileServerShard.ts'

export class KeyValueStoragesMock implements KeyValueStorage {
	isNodeOnline(url: string, timeout: number): Promise<boolean> {
		throw new Error('Method not implemented.')
	}
	set(key: string, value: string): Promise<void> {
		throw new Error('Method not implemented.')
	}
	getClient(url: string): ClientHolder<any> | undefined {
		throw new Error('Method not implemented.')
	}
	get(key: string): Promise<string | null | undefined> {
		throw new Error('Method not implemented.')
	}
	getAll(key: string): Promise<string[]> {
		throw new Error('Method not implemented.')
	}
	update(key: string, sessions: any, tileServerShard: TileServerShard): Promise<void> {
		throw new Error('Method not implemented.')
	}
	delete(key: string): Promise<number | undefined> {
		throw new Error('Method not implemented.')
	}
	exists(key: string): Promise<boolean> {
		throw new Error('Method not implemented.')
	}
}
