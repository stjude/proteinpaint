// TODO: use expressjs routing instead of this payload parameter
export type AIProjectAdminForValues = 'list' | 'admin' | 'filterImages' | 'images'

export type AIProjectAdminRequest = {
	genome: string
	dslabel: string
	/** list: get entire list of projects from db
	 * admin: edit, add, or delete projects from db
	 * filterImages: filter metadata for images
	 * images: get images for a project
	 */
	for: AIProjectAdminForValues // TODO: use expressjs routing instead of this payload parameter
	/** required for 'project' and 'selection' requests */
	project?: AIProjectAdminProject
}

export type AIProjectAdminProject = {
	name: string
	id?: number
	filter?: string
	classes?: any[]
	images?: string[]
	type?: string
	users?: string[]
}

export type AIProjectAdminResponse = {
	status: 'ok' | 'error'
	projectId?: number
	images: string[]
	error?: string
	data?: { cols: any[]; rows: any[]; images?: string[]; selectedImages?: string[] }
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
