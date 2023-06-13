// the exported variables, accessors here may be shared and mutated at-will by other code
// best to avoid if possible

// base_zindex was moved out of src/client.js to avoid a circular import in dom/menu.js,
// which breaks the pretest:unit bundling
let base_zindex = 100

export function get_base_zindex() {
	return base_zindex
}

export function set_base_zindex(i) {
	base_zindex = i
}
