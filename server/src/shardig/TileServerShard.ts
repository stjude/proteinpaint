export class TileServerShard {
	public url: string
	public mount: string

	constructor(url: string, mount: string) {
		this.url = url
		this.mount = mount
	}
}
