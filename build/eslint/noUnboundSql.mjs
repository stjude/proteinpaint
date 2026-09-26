/*
ESLint rule: sql text that is built with template interpolation or string concatenation,
instead of the sql`` tag from server/src/sql.ts that binds the values as parameters.

The text of a template literal or a + / += concatenation is reconstructed as a whole, with 'x' in place
of each dynamic part, before it is tested against the sql regexes below. This way a sql phrase that is
split by a dynamic part is still detected, such as `select ${column} from users` -> 'select x from users'.

Local variables are resolved to their static string text, including any static += appends, so that
	let q = 'select * from t where id='
	q += userId
is detected. A concatenation of only static strings is allowed, since there is no value to bind.
Only the sql`` tag is exempt, since it binds the values as parameters; other tagged templates such as
String.raw`...` are checked like an untagged template.
*/

// uppercase keywords, case-sensitive so that ordinary text such as 'from' or 'where' does not match
const sqlKeywords = /\b(SELECT|FROM|WHERE|JOIN|UNION|INSERT INTO|DELETE FROM|GROUP BY|ORDER BY)\b/
// case-insensitive multi-word sql phrases, to also match lowercase sql without matching
// ordinary text such as 'error from server'
const sqlPhrases =
	/\bselect\s+[\w*.,()\s]+\s+from\b|\binsert\s+(or\s+\w+\s+)?into\b|\bdelete\s+from\b|\bupdate\s+\w+\s+set\b|\bwhere\s+[\w."]+\s*(=|!=|<>|<=|>=|<|>|\bin\b|\blike\b|\bis\b|\bbetween\b|\bglob\b)|\b(group|order)\s+by\s+\w|\bvalues\s*\(/i

export function isSqlLike(text) {
	return sqlKeywords.test(text) || sqlPhrases.test(text)
}

// placeholder for a dynamic part in the reconstructed text
const DYNAMIC = 'x'

export default {
	meta: {
		type: 'problem',
		docs: { description: 'disallow sql text built with interpolation or concatenation, use the sql`` tag' },
		schema: [],
		messages: {
			template: 'Sql-like template with ${} interpolation, use the sql`` tag from server/src/sql.ts to bind values',
			concat: 'Sql-like string concatenation, use the sql`` tag from server/src/sql.ts to bind values'
		}
	},
	create(context) {
		const sourceCode = context.sourceCode

		/*
		returns {text, dynamic} for an expression, where text is the reconstructed string text with DYNAMIC
		in place of each dynamic part, and dynamic is true if any part is not a static string;
		seen is the set of variables that are being resolved in the current branch, to guard against cycles,
		and is not modified so that sibling operands such as part + part are resolved independently
		*/
		function getText(node, seen = new Set()) {
			if (!node) return { text: DYNAMIC, dynamic: true }
			if (node.type == 'Literal') {
				return typeof node.value == 'string' ? { text: node.value, dynamic: false } : { text: DYNAMIC, dynamic: true }
			}
			if (node.type == 'TemplateLiteral') {
				let text = node.quasis[0].value.cooked ?? ''
				for (let i = 0; i < node.expressions.length; i++) {
					text += getText(node.expressions[i], seen).text + (node.quasis[i + 1].value.cooked ?? '')
				}
				// an interpolated expression is dynamic even if it resolves to static text
				return { text, dynamic: node.expressions.length > 0 }
			}
			if (node.type == 'TaggedTemplateExpression') {
				// the text of a sql`` fragment is not known here; another tag such as String.raw returns the template text
				return isSqlTag(node) ? { text: DYNAMIC, dynamic: true } : getText(node.quasi, seen)
			}
			if (node.type == 'BinaryExpression' && node.operator == '+') {
				const left = getText(node.left, seen)
				const right = getText(node.right, seen)
				return { text: left.text + right.text, dynamic: left.dynamic || right.dynamic }
			}
			if (node.type == 'Identifier') {
				const text = resolveVariableText(node, seen)
				// a variable with static string text is not a value to bind
				return text === null ? { text: DYNAMIC, dynamic: true } : { text, dynamic: false }
			}
			return { text: DYNAMIC, dynamic: true }
		}

		/* the static text of a local variable: its initializer plus any static += appends, or null */
		function resolveVariableText(identifier, seen) {
			const variable = findVariable(identifier)
			if (!variable || seen.has(variable) || variable.defs.length != 1) return null
			const def = variable.defs[0]
			if (def.type != 'Variable' || def.node.id.type != 'Identifier') return null
			// a copy, so that the caller's set is not modified
			const branch = new Set(seen).add(variable)
			let text = ''
			if (def.node.init) {
				const init = getText(def.node.init, branch)
				if (init.dynamic) return null
				text = init.text
			}
			for (const ref of variable.references) {
				const p = ref.identifier.parent
				if (p.type != 'AssignmentExpression' || p.left != ref.identifier) continue
				// any other assignment makes the value unknown at a given point
				if (p.operator != '+=') return null
				const appended = getText(p.right, branch)
				if (appended.dynamic) continue // reported where it is appended, see AssignmentExpression below
				text += appended.text
			}
			return text
		}

		function findVariable(identifier) {
			let scope = sourceCode.getScope(identifier)
			while (scope) {
				const v = scope.set.get(identifier.name)
				if (v) return v
				scope = scope.upper
			}
			return null
		}

		function isNestedConcat(node) {
			return node.parent?.type == 'BinaryExpression' && node.parent.operator == '+'
		}

		/* only the sql`` tag from server/src/sql.ts binds the interpolated values as parameters */
		function isSqlTag(node) {
			return node.tag.type == 'Identifier' && node.tag.name == 'sql'
		}

		return {
			TemplateLiteral(node) {
				if (!node.expressions.length) return
				// the quasi of a tagged template, such as String.raw`...`, is checked unless the tag is sql``
				const tagged = node.parent?.type == 'TaggedTemplateExpression' ? node.parent : null
				if (tagged && isSqlTag(tagged)) return
				// a template that is part of a concatenation is checked as part of the whole concatenation
				if (isNestedConcat(tagged || node)) return
				const { text } = getText(node)
				if (isSqlLike(text)) context.report({ node, messageId: 'template' })
			},
			BinaryExpression(node) {
				// only check the outermost + of a concatenation, which covers the whole concatenation
				if (node.operator != '+' || isNestedConcat(node)) return
				const { text, dynamic } = getText(node)
				if (dynamic && isSqlLike(text)) context.report({ node, messageId: 'concat' })
			},
			AssignmentExpression(node) {
				if (node.operator != '+=') return
				const appended = getText(node.right)
				if (!appended.dynamic) return
				// a sql-like template or concatenation on the right side is already reported by itself
				if (
					isSqlLike(appended.text) &&
					['TemplateLiteral', 'TaggedTemplateExpression', 'BinaryExpression'].includes(node.right.type)
				)
					return
				// the variable's static text before this append, if it can be resolved
				const base = node.left.type == 'Identifier' ? resolveVariableText(node.left, new Set()) ?? '' : ''
				if (isSqlLike(base + appended.text)) context.report({ node, messageId: 'concat' })
			}
		}
	}
}
