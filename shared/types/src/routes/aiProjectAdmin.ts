// TODO: use expressjs routing instead of this payload parameter
// You need to update allowedAIProjectForStrings in proteinpaint/server/src/routes/aiProjectAdmin.ts when ading for values
export type AIProjectAdminForValues = 'list' | 'admin' | 'filterImages' | 'images' | 'logout' | 'auth'
export type AIProjectAdminActions =
	| 'listAllProjects'
	| 'addProject'
	| 'editProject'
	| 'deleteProject'
	| 'getImages'
	| 'filterImages'
	| 'logOut'
	| 'annotate'
	| 'required'
export type AIProjectUserRoles = 'annotator' | 'admin'
export type AIProjectAuthInfo = { role?: AIProjectUserRoles | ''; email?: string } | undefined
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
	auth?: AIProjectAdminActions[]
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
