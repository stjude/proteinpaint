import { createClient, RedisClientType } from 'redis'

export default class RedisClientHolder {
	private static instances: Map<string, RedisClientHolder> = new Map()
	private readonly client: RedisClientType

	private constructor(redisUrl: string, secret: any) {
		this.client = createClient({
			url: redisUrl,
			password: secret
		})

		this.client.on('error', (err: any) => {
			console.error('Redis Client Error:', err)
		})

		this.client.on('connect', () => {
			console.log('Redis client connected')
		})

		this.client.on('ready', () => {
			console.log('Redis client ready')
		})

		this.client.connect()
	}

	public static getInstance(redisUrl: string, secret: any): RedisClientHolder {
		let instance = RedisClientHolder.instances.get(redisUrl)
		if (!instance) {
			instance = new RedisClientHolder(redisUrl, secret)
			RedisClientHolder.instances.set(redisUrl, instance)
		}
		return instance
	}

	public getClient(): RedisClientType {
		return this.client
	}

	public async set(key: string, value: string): Promise<void> {
		await this.client.set(key, value)
	}

	public async get(key: string): Promise<string | null> {
		return this.client.get(key)
	}

	public async getAll(): Promise<string[]> {
		return this.client.keys('*')
	}

	public async delete(key: string): Promise<number> {
		return this.client.del(key)
	}

	public async exists(key: string): Promise<boolean> {
		const result = await this.client.exists(key)
		return result === 1
	}
}
