---
name: code-scan-triage
description: Assess and optionally fix security findings from GitHub code scanning (CodeQL) or Snyk (Snyk Code static analysis, and Snyk Open Source dependency issues) in the proteinpaint repo. Use when given a code-scanning alert URL or number, a Snyk issue or finding, or asked to triage, assess, or remediate a security scan result, a batch of them, or all open alerts.
compatibility: Requires git, the GitHub CLI (gh) authenticated for stjude/proteinpaint, and for Snyk findings the Snyk CLI (snyk) authenticated with `snyk auth`.
---

# Code scan triage

Assess a security scanner finding, decide whether it is a false positive or a real risk, and recommend or apply a fix.

Default to **assess only**. Apply a fix only when the user asks for it (for example "fix", "remediate", "--fix").

Before assessing, read [references/repo-security-context.md](references/repo-security-context.md). It lists the guard helpers, the request data flow, and the known false positive and real-issue patterns in this repo.

## 1. Fetch the finding

### GitHub code scanning (CodeQL)

Given `https://github.com/stjude/proteinpaint/security/code-scanning/<N>` or just `<N>`:

```bash
gh api repos/stjude/proteinpaint/code-scanning/alerts/<N> --jq '{rule: .rule.id, severity: .rule.security_severity_level, description: .rule.description, state, created_at, instance: .most_recent_instance | {ref, commit_sha, location, message: .message.markdown}}'
```

- `message.markdown` links each tainted source as `path#L<line>C<col>-L<line>C<col>`. Those are the request inputs to trace.
- `.rule.help` has the rule's full explanation and fix pattern, if the rule is unfamiliar.
- To find sibling alerts from the same rule or file, which often share one cause and one fix:

```bash
gh api "repos/stjude/proteinpaint/code-scanning/alerts?state=open&per_page=100" --jq '.[] | "\(.number) \(.rule.id) \(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line):\(.most_recent_instance.location.start_column)"'
```

### Snyk Code (static analysis)

Use the Snyk CLI. A scan uploads the code for analysis and takes a few minutes, so write the result to a file once and query it, instead of rescanning for each finding:

```bash
snyk code test --severity-threshold=medium --json-file-output=<scratch>/snyk-code.json server/src
```

The JSON is SARIF: `runs[0].results[]` has `ruleId`, `message.text`, `locations[0].physicalLocation`, and `codeFlows` (the source-to-sink trace). `runs[0].tool.driver.rules[]` has the rule help text. If the user pastes a finding from the Snyk web UI instead, use that directly.

### Snyk Open Source (dependencies)

```bash
snyk test --json --file=<package.json path>
```

Dependency findings need a different assessment: see step 3b.

## 2. Read the code at the scanned commit

Line numbers drift after the scan. Read the flagged file at the alert's `commit_sha`, not the working tree:

```bash
git fetch -q origin
git show <commit_sha>:<path> | sed -n '<start>,<end>p'
```

Then check whether the file changed since (`git diff <commit_sha> origin/master -- <path>`), in case the finding is already fixed.

Ignore `server/src/app.js` in search results: it is a compiled bundle of the server source.

## 3a. Assess a code finding

Trace every source listed in the finding to the sink:

1. **Is the source really user-controlled?** For a POST with a JSON body, the body is merged into `req.query`, so every `q.*` field is controlled by the request. Check whether a server-side value can be supplied by the request because it is only assigned in some branches.
2. **What guards run between source and sink?** Look for the helpers in the reference file. Scanners often miss a check that happens inside another function (for example a `typeof` check inside `illegalpath()` that returns a boolean).
3. **What can the sink actually do?** A path given to a spawned tool (samtools, tabix, bcftools, straw, bigBedToBed) is not restricted by the Node permission model. A `cwd` for a tool that only reads stdin has less impact than a file argument.
4. **Look around the flagged line.** The same handler often has related unguarded inputs the scanner did not flag. Report them.
5. **Check whether the route is still used,** by searching `client/` for the route name. An unused route may be better removed than fixed.

Verdict is one of:
- **False positive**: explain which guard makes it unexploitable, and cite the line and any existing test that proves it.
- **Real, low impact** / **Real, high impact**: give a concrete request that triggers it.
- **Already fixed**: cite the commit.

## 3b. Assess a dependency finding

- Is the vulnerable package a direct dependency or pulled in by another package (`npm ls <pkg>`)? Is it only used in dev, build or test?
- Does proteinpaint call the vulnerable function, or use the package in the vulnerable way? Search for imports of the package.
- Does a fixed version exist, and is it a major-version upgrade? Check the changelog for breaking changes.
- For a container image finding, check whether the vulnerable OS package is used at runtime.

## 4. Report

Use this structure, and keep it short:

1. **Verdict** in the first sentence.
2. **What was flagged**: rule, severity, `file:line` of source and sink.
3. **Why**: the source-to-sink reasoning, quoting the few lines that matter.
4. **Related**: sibling alerts with the same cause, and unflagged issues nearby.
5. **Fix options** with a recommendation. For a false positive, compare dismissing the alert with a small code change that also silences the scanner (a local `typeof` check, for example), since dismissed alerts can come back after refactors.

For more than a few findings, use batch mode (step 6) instead.

## 5. Fix (only when asked)

1. Create a branch from `master`. Do not commit to `master`.
2. Fix the cause, not the one flagged line: cover the sibling alerts and nearby unflagged issues that share the cause. Reuse the guard helpers in the reference file rather than writing new checks.
3. Add a regression test with `tape` in `server/src/test/*.unit.spec.js`, next to related cases (for example `utils.unit.spec.js` for helpers, `argvInjection.unit.spec.js` for spawned tool arguments). Test the attack input, not just a valid input.
4. Run the tests: `cd server && npm run test:unit`.
5. Commit with a message that names the alert, for example `fix: validate file paths in <route> (code-scanning #<N>)`.
6. Open the pull request as a draft (`gh pr create --draft`), linking the alert URLs.
7. Do not dismiss alerts on GitHub or in Snyk without the user's approval. Dismissals are visible to the whole team.

## 6. Batch mode: assess all open findings

Use when asked to assess all open alerts (the list at https://github.com/stjude/proteinpaint/security/code-scanning), or a filtered subset of them, so that the team can split up the fixes.

### 6.1 List and group

```bash
.agents/skills/code-scan-triage/scripts/list-alerts.sh                      # all open alerts
.agents/skills/code-scan-triage/scripts/list-alerts.sh --severity critical  # or --rule <rule id>, --path <path prefix>
```

The rows are sorted so that alerts with the same rule in the same file are adjacent. Group them into **fix groups**: alerts that one change would fix. Start with same rule + same file, then merge or split after reading the code. For example, several alerts on one shared helper are one group, even if the tainted sources are in different files. For Snyk, run `snyk code test` once (step 1) and group its results the same way.

If there are more than about 30 groups, tell the user the count and ask whether to assess all of them or to start with a filter (such as `--severity critical` or `--severity high`).

### 6.2 Assess each group

Assess each group with steps 2 to 3. If the agent can run parallel sub-tasks, give each group (or a few small groups) to its own sub-task, with this skill and the reference file as context, and have each return only:

`group id | alert numbers | rule | severity | verdict | impact | fix summary | effort (S/M/L) | files to change | suggested owner`

- **verdict**: false positive, real (low impact), real (high impact), already fixed, or needs a human decision (explain why).
- **suggested owner**: whoever changed the flagged lines most recently (`git log -1 --format=%an -L<line>,<line>:<path>`). This is only a hint for the team.

### 6.3 Write the report

Write the combined report to `.security-triage/<YYYY-MM-DD>-code-scanning.md` (or `-snyk.md`). This folder is gitignored. **proteinpaint is a public repository: do not commit the report, and do not put the details of an unfixed real issue in a GitHub issue, discussion, or PR description.** Share the report through a private channel.

The report has:

1. **Summary**: count of alerts and fix groups by verdict and severity.
2. **Fix groups table**, one row per group, sorted with real high impact first, then real low impact, needs a human decision, false positives, and already fixed. Columns: the fields from 6.2, plus an empty **assignee** column for the team to fill in.
3. **Details**: one short section per group, in the step 4 report format, with links to the alerts (`https://github.com/stjude/proteinpaint/security/code-scanning/<N>`).
4. **Suggested actions**: false positives to dismiss, and groups that could be combined into one PR.

### 6.4 Coordinate on the alerts (only when asked)

Code scanning alerts are only visible to people with security access to the repo, so use the alerts themselves to coordinate instead of public issues:

- **Assign** the alerts in a fix group, after the team picks an owner:
  ```bash
  gh api -X PATCH repos/stjude/proteinpaint/code-scanning/alerts/<N> -f 'assignees[]=<github login>'
  ```
  Re-running `list-alerts.sh` shows the assignees column, which shows what has been taken.
- **Dismiss** false positives, with a comment of at most 280 characters that gives the reason:
  ```bash
  gh api -X PATCH repos/stjude/proteinpaint/code-scanning/alerts/<N> -f state=dismissed -f 'dismissed_reason=false positive' -f 'dismissed_comment=<reason>'
  ```
- Alerts close on their own when a scan of `master` no longer finds them, so there is no need to close them after a fix is merged.

Always show the user the list of alerts to assign or dismiss, and wait for approval before sending the requests.
