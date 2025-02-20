import type { ClientHolder } from '#src/caching/ClientHolder.ts'
import type { KeyValueStorage } from '#src/caching/KeyValueStorage.ts'
import type { TileServerShard } from '#src/sharding/TileServerShard.ts'
import type { SessionData } from '../SessionManager.ts'

/*
 * This class is a mock class for the KeyValueStorage interface.
 *
 * It's used just for unit tests.
 */
export class KeyValueStoragesMock implements KeyValueStorage {
	constructor(private readonly keyValueStorages: Map<string, string> = new Map<string, string>()) {}

	async getAllKeyValues(key: string): Promise<{ key: string; sessionData: SessionData | undefined }[]> {
		const keys = await this.getAllKeys(key)
		const results: { key: string; sessionData: SessionData | undefined }[] = []

		for (const key of keys) {
			const value = await this.get(key)
			let sessionData: SessionData | undefined = undefined

			if (value) {
				try {
					sessionData = JSON.parse(value) as SessionData
				} catch (e) {
					console.error(`Error parsing JSON for key: ${key}`, e)
				}
			}

			results.push({ key, sessionData })
		}

		return results
	}

	isNodeOnline(_url: string, _timeout: number): Promise<boolean> {
		throw new Error('Method not implemented.')
	}

	async set(key: string, value: string): Promise<void> {
		this.keyValueStorages.set(key, value)
	}

	getClient(_url: string): ClientHolder<any> | undefined {
		throw new Error('Method not implemented.')
	}

	async get(key: string): Promise<string | null | undefined> {
		return this.keyValueStorages.get(key)
	}

	async getAllKeys(_key: string): Promise<string[]> {
		return Array.from(this.keyValueStorages.keys())
	}

	async update(_key: string, _sessions: any, _tileServerShard: TileServerShard): Promise<void> {
		// do nothing
	}

	async delete(key: string): Promise<number | undefined> {
		if (this.keyValueStorages.delete(key)) {
			return 1
		} else {
			return 0
		}
	}

	exists(_key: string): Promise<boolean> {
		throw new Error('Method not implemented.')
	}
}
