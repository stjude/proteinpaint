// postcss-escape-fix.mjs
function escapeFixPlugin() {
	return {
		postcssPlugin: 'postcss-escape-fix',
		Once(root) {
			root.walkDecls(decl => {
				decl.value = decl.value.replace(/\\([0-7]{1,3})/g, (match, octal) => {
					return String.fromCharCode(parseInt(octal, 8))
				})
			})
		}
	}
}

escapeFixPlugin.postcss = true

export default escapeFixPlugin
