#!/usr/bin/env node

/*
	Claude Code PreToolUse hook for the Bash tool, see .claude/settings.json:
	- blocks a git command that skips the git hooks or the text check
	- checks the text of git and gh commands that will be public, and the files that
	  the gh commands read such as with --body-file, with check-text.sh

	The command is split into simple commands without running it, to find each git and gh
	invocation, its working directory, and its target repo. The whole command text is checked
	when any of them may target a public repo.

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
const SKIP_MSG =
	'Do not skip the git hooks or the text check. If the check flags a false positive, or the fix is already deployed to prod, ask the user to run the command.'

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
	if (!result.check) process.exit(0)

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
	const check = spawnSync('bash', [path.join(__dirname, 'check-text.sh'), 'text', 'command text'], {
		input: text,
		cwd: fs.existsSync(cwd) ? cwd : undefined,
		encoding: 'utf8'
	})
	if (check.status !== 0) block(check.stderr || 'The text check failed.')
	process.exit(0)
}

function block(message) {
	process.stderr.write(message.endsWith('\n') ? message : message + '\n')
	process.exit(2)
}

// returns {block: message} or {check: boolean, files: [paths]}
function analyze(cmd, cwd) {
	const commands = parse(cmd)
	if (!commands) {
		// cannot be split safely, so check the whole text if it may run git or gh
		return { check: /(^|[^\w.-])(git|gh)\s/.test(cmd), files: [] }
	}

	const targets = [] // {repo, isGit, files}
	let dir = cwd
	for (let words of commands) {
		// remove the leading env assignments and command wrappers
		const env = []
		while (words.length) {
			if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) env.push(words[0].split('=')[0])
			else if (!['env', 'command', 'exec', 'time', 'sudo', 'nohup'].includes(words[0])) break
			words = words.slice(1)
		}
		if (!words.length) continue
		const name = path.basename(words[0])

		if (name === 'export' && words.some(w => w.startsWith('SKIP_TEXT_CHECK'))) return { block: SKIP_MSG }
		if (name === 'cd' || name === 'pushd') {
			if (words[1] && words[1] !== '-') dir = resolve(dir, words[1])
			else if (!words[1]) dir = os.homedir()
			continue
		}
		if (name !== 'git' && name !== 'gh') continue
		if (env.includes('SKIP_TEXT_CHECK')) return { block: SKIP_MSG }

		if (name === 'git') {
			let gitDir = dir
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
			if (GIT_SUBCMDS.has(sub)) targets.push({ repo: originRepo(gitDir), isGit: true, files: [] })
			continue
		}

		// gh
		const isApi = words[1] === 'api'
		if (!isApi && !(GH_SUBCMDS.has(words[1]) && GH_ACTIONS.has(words[2]))) continue
		let repo = null
		const files = []
		const addFile = f => {
			if (f && f !== '-') files.push(resolve(dir, f))
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
		targets.push({ repo: repoSlug(repo) || originRepo(dir), isGit: false, files })
	}

	// in a private repo, only the commits that change a subrepo will be public
	const isPublic = t => !PRIVATE_REPOS.has(t.repo) || (t.isGit && SUBREPOS.test(cmd))
	const publicTargets = targets.filter(isPublic)
	return { check: publicTargets.length > 0, files: publicTargets.flatMap(t => t.files) }
}

// detects `git commit -n`, including in a cluster of short options such as -an
function hasCommitNoVerify(args) {
	for (let k = 0; k < args.length; k++) {
		const a = args[k]
		if (a === '--') break
		if (COMMIT_VALUE_OPTS.has(a)) k++
		else if (/^-[A-Za-z]+$/.test(a)) {
			for (let j = 1; j < a.length; j++) {
				if (a[j] === 'n') return true
				if ('mFCct'.includes(a[j])) {
					// the rest of the cluster, or else the next word, is the option value
					if (j === a.length - 1) k++
					break
				}
			}
		}
	}
	return false
}

function resolve(dir, p) {
	if (p === '~' || p.startsWith('~/')) p = os.homedir() + p.slice(1)
	return path.resolve(dir, p)
}

function originRepo(dir) {
	const r = spawnSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], { encoding: 'utf8' })
	return r.status === 0 ? repoSlug(r.stdout) : ''
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
// separators. The commands inside $(...) and backticks are included. Returns null when the
// command cannot be split, such as with an unterminated quote.
function parse(src) {
	const commands = []
	return lex(src, 0, false, commands) < 0 ? null : commands
}

// lexes src from index i until the end or, when inSub, an unmatched ')';
// returns the index after the end, or -1 on an error
function lex(src, i, inSub, commands) {
	let words = []
	let word = null
	let heredocs = [] // {delim, dash}, whose bodies start after the next newline
	const add = s => (word = (word ?? '') + s)
	const endWord = () => {
		if (word !== null) words.push(word)
		word = null
	}
	const endCommand = () => {
		endWord()
		if (words.length) commands.push(words)
		words = []
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
			const j = lex(src, i + 2, true, commands)
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
		} else if (c === ')' && inSub) {
			endCommand()
			return i + 1
		} else if (';&|()'.includes(c)) {
			endCommand()
			i++
		} else {
			add(c)
			i++
		}
	}
	if (inSub) return -1
	endCommand()
	return i
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
			const j = lex(src, i + 2, true, commands)
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
	lex(src.slice(i, j), 0, false, commands)
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
