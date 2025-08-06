export default interface Settings {
	project?: {
		name: string
		id?: number
		type: 'new' | 'edit'
	}
}
