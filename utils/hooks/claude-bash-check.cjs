#!/usr/bin/env node

/*
	Claude Code PreToolUse hook for the Bash tool, see .claude/settings.json:
	- blocks a git command that skips the git hooks or the text check
	- checks the text of git and gh commands that will be public, and the files that
	  the gh commands read such as with --body-file, with check-text.sh

	The command is split into simple commands without running it, to find each git and gh
	invocation, its working directory, environment, and target repos. The whole command text
	is checked when any of them may target a public repo, with the config of each such
	invocation's checkout.

	Exits with 2 to block the command, which shows the stderr message to the agent.
*/

const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

const PRIVATE_REPOS = new Set(['stjude/sjpp'])
// commits in a private repo that change these subrepos are synced to other repos
const SUBREPOS = /(^|[^\w-])(ppgdc|ppmmrf)([^\w-]|$)/
const GIT_SUBCMDS = new Set(['commit', 'checkout', 'switch', 'branch', 'worktree', 'push', 'tag', 'subrepo', 'merge'])
const GH_SUBCMDS = new Set(['pr', 'issue', 'release', 'label'])
const GH_ACTIONS = new Set(['create', 'edit', 'comment', 'review', 'close', 'merge'])
// the words before a command, such as shell keywords and command wrappers
const PREFIX_WORDS = new Set([
	'if',
	'then',
	'else',
	'elif',
	'do',
	'while',
	'until',
	'!',
	'{',
	'time',
	'nohup',
	'env',
	'command',
	'exec',
	'sudo'
])
// git commit options that take the next word as a value
const COMMIT_VALUE_OPTS = new Set([
	'--message',
	'--file',
	'--author',
	'--date',
	'--template',
	'--reuse-message',
	'--reedit-message',
	'--fixup',
	'--squash',
	'--cleanup',
	'--trailer'
])
// git commit short options that take the rest of the word, or else the next word, as a value
const COMMIT_SHORT_VALUE_OPTS = 'mFCct'
// git commit short options that take only an attached value
const COMMIT_SHORT_OPTIONAL_OPTS = 'Su'
const SKIP_MSG =
	'Do not skip the git hooks or the text check. If the check flags a false positive, or the fix is already deployed to prod, ask the user to run the command.'
const STDIN_MSG =
	'The gh command reads text from stdin, which this hook cannot check. Pass the text with --body, or write it to a file in a separate command first and pass the file path.'

// markers in the parsed commands for entering and leaving a subshell or command substitution
const OPEN = { scope: 'open' }
const CLOSE = { scope: 'close' }

main()

function main() {
	let input
	try {
		input = JSON.parse(fs.readFileSync(0, 'utf8'))
	} catch (e) {
		process.exit(0)
	}
	const cmd = input.tool_input?.command || ''
	const cwd = input.cwd || process.cwd()

	const result = analyze(cmd, cwd)
	if (result.block) block(result.block)
	if (!result.dirs.length) process.exit(0)

	let text = cmd
	for (const file of result.files) {
		try {
			text += '\n' + fs.readFileSync(file, 'utf8')
		} catch (e) {
			block(
				`Cannot read ${file}, which the gh command reads. Write it in a separate command first, so that this hook can check it.`
			)
		}
	}
	// check with the config of each target checkout, such as its pp.textCheckTerms
	for (const dir of result.dirs) {
		const check = spawnSync('bash', [path.join(__dirname, 'check-text.sh'), 'text', 'command text'], {
			input: text,
			cwd: fs.existsSync(dir) ? dir : undefined,
			encoding: 'utf8'
		})
		if (check.status !== 0) block(check.stderr || 'The text check failed.')
	}
	process.exit(0)
}

function block(message) {
	process.stderr.write(message.endsWith('\n') ? message : message + '\n')
	process.exit(2)
}

// returns {block: message} or {dirs: [checkout dirs to check the text with], files: [paths]}
function analyze(cmd, cwd) {
	const commands = parse(cmd)
	if (!commands) {
		// cannot be split safely, so check the whole text if it may run git or gh
		return { dirs: /(^|[^\w.-])(git|gh)\s/.test(cmd) ? [cwd] : [], files: [] }
	}

	const targets = [] // {repos, isGit, dir, files, stdin}
	let state = { dir: cwd, env: { ...process.env } }
	const scopes = []
	for (const item of commands) {
		if (item === OPEN) {
			scopes.push(state)
			state = { dir: state.dir, env: { ...state.env } }
			continue
		}
		if (item === CLOSE) {
			state = scopes.pop() || state
			continue
		}

		// remove the leading env assignments, shell keywords, and command wrappers
		let words = item
		const env = {}
		while (words.length) {
			const m = words[0].match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s)
			if (m) env[m[1]] = m[2]
			else if (!PREFIX_WORDS.has(words[0])) break
			words = words.slice(1)
		}
		if (!words.length) continue
		const name = path.basename(words[0])

		if (name === 'export') {
			for (const w of words.slice(1)) {
				if (w.startsWith('SKIP_TEXT_CHECK')) return { block: SKIP_MSG }
				const m = w.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s)
				if (m) state.env[m[1]] = m[2]
			}
			continue
		}
		if (name === 'unset') {
			for (const w of words.slice(1)) delete state.env[w]
			continue
		}
		if (name === 'cd' || name === 'pushd') {
			if (words[1] && words[1] !== '-') state.dir = resolve(state.dir, words[1])
			else if (!words[1]) state.dir = os.homedir()
			continue
		}
		if (name !== 'git' && name !== 'gh') continue
		if ('SKIP_TEXT_CHECK' in env) return { block: SKIP_MSG }
		const cmdEnv = { ...state.env, ...env }

		if (name === 'git') {
			let gitDir = state.dir
			let k = 1
			while (k < words.length && words[k].startsWith('-')) {
				const opt = words[k]
				if (opt === '-C') {
					gitDir = resolve(gitDir, words[k + 1] || '.')
					k += 2
				} else if (opt === '-c' || opt === '--git-dir' || opt === '--work-tree' || opt === '--namespace') {
					k += 2
				} else k++
			}
			const sub = words[k]
			const args = words.slice(k + 1)
			const hooksPath = w => /core\.hookspath/i.test(w)
			if (words.slice(1, k).some(hooksPath) || (sub === 'config' && args.some(hooksPath))) return { block: SKIP_MSG }
			if (args.includes('--no-verify')) return { block: SKIP_MSG }
			if (sub === 'commit' && hasCommitNoVerify(args)) return { block: SKIP_MSG }
			if (GIT_SUBCMDS.has(sub)) {
				targets.push({ repos: pushRepos(gitDir, sub === 'push' ? args : []), isGit: true, dir: gitDir, files: [] })
			}
			continue
		}

		// gh
		const isApi = words[1] === 'api'
		if (!isApi && !(GH_SUBCMDS.has(words[1]) && GH_ACTIONS.has(words[2]))) continue
		let repo = null
		let stdin = false
		const files = []
		const addFile = f => {
			if (f === '-' || f === '/dev/stdin') stdin = true
			else if (f) files.push(resolve(state.dir, f))
		}
		for (let k = 1; k < words.length; k++) {
			const w = words[k]
			const [opt, val] =
				w.startsWith('--') && w.includes('=') ? [w.slice(0, w.indexOf('=')), w.slice(w.indexOf('=') + 1)] : [w, null]
			const next = () => (val !== null ? val : words[++k])
			if (opt === '-R' || opt === '--repo') repo = next()
			else if (opt === '--body-file' || opt === '--notes-file' || opt === '--input' || (opt === '-F' && !isApi))
				addFile(next())
			else if (isApi && (opt === '-F' || opt === '--field')) {
				const m = (next() || '').match(/^[^=]*=@(.+)$/s)
				if (m) addFile(m[1])
			} else if (isApi && repo === null) {
				const m = w.match(/^\/?repos\/([^/{}]+\/[^/{}]+)/)
				if (m) repo = m[1]
			}
		}
		if (stdin) {
			// text from a heredoc or here-string is in the command text, and a file is read
			const redirect = stdinRedirect(words)
			if (redirect) files.push(resolve(state.dir, redirect))
			else if (item.piped || !(item.heredoc || words.some(w => w.startsWith('<<<')))) stdin = 'unchecked'
		}
		// like gh: the --repo option, or else GH_REPO, or else the repo from the git remotes
		repo = repo || cmdEnv.GH_REPO
		targets.push({ repos: repo ? [repoSlug(repo)] : ghRepos(state.dir), isGit: false, dir: state.dir, files, stdin })
	}

	// in a private repo, only the commits that change a subrepo will be public
	const isPublic = t => !t.repos.length || t.repos.some(r => !PRIVATE_REPOS.has(r)) || (t.isGit && SUBREPOS.test(cmd))
	const publicTargets = targets.filter(isPublic)
	if (publicTargets.some(t => t.stdin === 'unchecked')) return { block: STDIN_MSG }
	return { dirs: [...new Set(publicTargets.map(t => t.dir))], files: publicTargets.flatMap(t => t.files) }
}

// detects `git commit -n`, including in a cluster of short options such as -an or -nm"message"
function hasCommitNoVerify(args) {
	for (let k = 0; k < args.length; k++) {
		const a = args[k]
		if (a === '--') break
		if (a.startsWith('--')) {
			if (COMMIT_VALUE_OPTS.has(a)) k++
			continue
		}
		if (!a.startsWith('-')) continue
		for (let j = 1; j < a.length; j++) {
			if (a[j] === 'n') return true
			if (COMMIT_SHORT_VALUE_OPTS.includes(a[j])) {
				if (j === a.length - 1) k++
				break
			}
			if (COMMIT_SHORT_OPTIONAL_OPTS.includes(a[j]) || !/[A-Za-z]/.test(a[j])) break
		}
	}
	return false
}

// returns the file that a command reads as stdin with `< file`, or null
function stdinRedirect(words) {
	for (let k = 0; k < words.length; k++) {
		if (words[k] === '<' || words[k] === '0<') return words[k + 1] || null
		const m = words[k].match(/^0?<([^<(&].*)$/s)
		if (m) return m[1]
	}
	return null
}

function resolve(dir, p) {
	if (p === '~' || p.startsWith('~/')) p = os.homedir() + p.slice(1)
	return path.resolve(dir, p)
}

function git(dir, args) {
	const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' })
	return r.status === 0 ? r.stdout.trim() : ''
}

// returns the repos that a git command in dir will push to, like git: the <repository> argument
// of `git push`, or else the branch's push remote, remote.pushDefault, the branch's remote, or origin
function pushRepos(dir, args) {
	let dest = null
	for (let k = 0; k < args.length; k++) {
		const a = args[k]
		if (a === '--repo' || a === '--') {
			dest = args[k + 1]
			break
		}
		if (a.startsWith('--repo=')) {
			dest = a.slice(7)
			break
		}
		if (['-o', '--push-option', '--receive-pack', '--exec'].includes(a)) k++
		else if (!a.startsWith('-')) {
			dest = a
			break
		}
	}
	if (!dest) {
		const branch = git(dir, ['symbolic-ref', '-q', '--short', 'HEAD'])
		dest =
			(branch && git(dir, ['config', `branch.${branch}.pushRemote`])) ||
			git(dir, ['config', 'remote.pushDefault']) ||
			(branch && git(dir, ['config', `branch.${branch}.remote`])) ||
			'origin'
	}
	// a remote name has urls, and anything else is used as a url
	const urls = git(dir, ['remote', 'get-url', '--push', '--all', dest])
	return (urls ? urls.split('\n') : [dest]).map(repoSlug)
}

// returns the repos that gh may select from the git remotes in dir, like gh: the remote set by
// `gh repo set-default`, or else any of the remotes
function ghRepos(dir) {
	const resolved = git(dir, ['config', '--get-regexp', '^remote\\..*\\.gh-resolved$'])
	if (resolved) {
		return resolved.split('\n').flatMap(line => {
			const [key, value] = line.split(/\s+/)
			const remote = key.replace(/^remote\./, '').replace(/\.gh-resolved$/, '')
			return value === 'base' ? [repoSlug(git(dir, ['remote', 'get-url', remote]))] : [repoSlug(value)]
		})
	}
	const remotes = git(dir, ['remote'])
	return remotes ? remotes.split('\n').map(r => repoSlug(git(dir, ['remote', 'get-url', r]))) : []
}

// returns owner/name for a github url or an [HOST/]OWNER/REPO argument, or '' if unknown
function repoSlug(s) {
	if (!s) return ''
	s = s
		.trim()
		.replace(/\/$/, '')
		.replace(/\.git$/, '')
	const m =
		s.match(/^(?:(?:https?|ssh):\/\/)?(?:[^@/]+@)?github\.com[:/]([^/:]+\/[^/:]+)$/i) ||
		s.match(/^([^/:@\s]+\/[^/:@\s]+)$/)
	return m ? m[1].toLowerCase() : ''
}

// Splits a shell command into simple commands, each an array of words, without running it.
// Handles quotes, escapes, $(...), backticks, heredocs, comments, and the ; & | ( ) newline
// separators. The commands inside $(...) and backticks are included, between the OPEN and
// CLOSE markers, as are subshells. A command that reads a pipe has `piped`, and one with a
// heredoc has `heredoc`. Returns null when the command cannot be split, such as with an
// unterminated quote.
function parse(src) {
	const commands = []
	return lex(src, 0, false, commands) < 0 ? null : commands
}

// lexes src from index i until the end or, when inSub, an unmatched ')';
// returns the index after the end, or -1 on an error
function lex(src, i, inSub, commands) {
	let words = []
	let word = null
	let piped = false
	let heredoc = false
	let heredocs = [] // {delim, dash}, whose bodies start after the next newline
	const add = s => (word = (word ?? '') + s)
	const endWord = () => {
		if (word !== null) words.push(word)
		word = null
	}
	const endCommand = () => {
		endWord()
		if (words.length) {
			words.piped = piped
			words.heredoc = heredoc
			commands.push(words)
		}
		words = []
		piped = false
		heredoc = false
	}

	while (i < src.length) {
		const c = src[i]
		if (c === '\\') {
			if (src[i + 1] !== '\n') add(src[i + 1] ?? '')
			i += 2
		} else if (c === "'") {
			const j = src.indexOf("'", i + 1)
			if (j < 0) return -1
			add(src.slice(i + 1, j))
			i = j + 1
		} else if (c === '"') {
			const r = dquote(src, i + 1, commands)
			if (!r) return -1
			add(r[0])
			i = r[1]
		} else if (c === '$' && src[i + 1] === '(') {
			const j = substitution(src, i + 2, commands)
			if (j < 0) return -1
			add(src.slice(i, j))
			i = j
		} else if (c === '`') {
			const j = backtick(src, i + 1, commands)
			if (j < 0) return -1
			add(src.slice(i, j))
			i = j
		} else if (c === '#' && word === null) {
			const j = src.indexOf('\n', i)
			i = j < 0 ? src.length : j
		} else if (c === ' ' || c === '\t') {
			endWord()
			i++
		} else if (c === '\n') {
			endCommand()
			i++
			for (const h of heredocs) i = skipHeredoc(src, i, h)
			heredocs = []
		} else if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
			endWord()
			i += 2
			const dash = src[i] === '-'
			if (dash) i++
			while (src[i] === ' ' || src[i] === '\t') i++
			let delim = ''
			while (i < src.length && !/[\s;&|()<>]/.test(src[i])) {
				if (src[i] !== "'" && src[i] !== '"' && src[i] !== '\\') delim += src[i]
				i++
			}
			heredocs.push({ delim, dash })
			heredoc = true
		} else if (c === '&' && (/[<>]$/.test(word ?? '') || src[i + 1] === '>')) {
			// part of a redirect such as 2>&1 or &>file
			add(c)
			i++
		} else if (c === ')' && inSub) {
			endCommand()
			return i + 1
		} else if (c === '(' || c === ')') {
			endCommand()
			commands.push(c === '(' ? OPEN : CLOSE)
			i++
		} else if (c === '|' && src[i + 1] !== '|') {
			endCommand()
			piped = true
			i += src[i + 1] === '&' ? 2 : 1
		} else if (';&|'.includes(c)) {
			endCommand()
			i += src[i + 1] === c ? 2 : 1
		} else {
			add(c)
			i++
		}
	}
	if (inSub) return -1
	endCommand()
	return i
}

// lexes a command substitution from index i, after its '$(', between the OPEN and CLOSE markers;
// returns the index after its ')', or -1
function substitution(src, i, commands) {
	commands.push(OPEN)
	const j = lex(src, i, true, commands)
	commands.push(CLOSE)
	return j
}

// returns [value, index after the closing quote] of a double-quoted string, or null
function dquote(src, i, commands) {
	let v = ''
	while (i < src.length) {
		const c = src[i]
		if (c === '"') return [v, i + 1]
		if (c === '\\' && '"\\$`\n'.includes(src[i + 1])) {
			if (src[i + 1] !== '\n') v += src[i + 1]
			i += 2
		} else if (c === '$' && src[i + 1] === '(') {
			const j = substitution(src, i + 2, commands)
			if (j < 0) return null
			v += src.slice(i, j)
			i = j
		} else if (c === '`') {
			const j = backtick(src, i + 1, commands)
			if (j < 0) return null
			v += src.slice(i, j)
			i = j
		} else {
			v += c
			i++
		}
	}
	return null
}

// returns the index after the closing backtick, or -1, and adds the commands inside it
function backtick(src, i, commands) {
	let j = i
	while (j < src.length && src[j] !== '`') j += src[j] === '\\' ? 2 : 1
	if (j >= src.length) return -1
	commands.push(OPEN)
	lex(src.slice(i, j), 0, false, commands)
	commands.push(CLOSE)
	return j + 1
}

// returns the index after the heredoc body that starts at index i
function skipHeredoc(src, i, { delim, dash }) {
	while (i < src.length) {
		const j = src.indexOf('\n', i)
		const line = src.slice(i, j < 0 ? src.length : j)
		i = j < 0 ? src.length : j + 1
		if ((dash ? line.replace(/^\t+/, '') : line) === delim) break
	}
	return i
}
