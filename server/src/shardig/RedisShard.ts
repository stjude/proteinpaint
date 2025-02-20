export class RedisShard {
	public url: string
	public secret: string

	constructor(url: string, secret: string) {
		this.url = url
		this.secret = secret
	}
}
