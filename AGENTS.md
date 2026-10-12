# Agent instructions

## Security-related changes
This repo is public. Until a fix is deployed to prod, do not reveal the issue in branch names,
commit messages, PR titles, descriptions, or labels, release notes, code comments, or test names:
no vulnerability type, affected route, parameter, file, or path, payload, or alert/disclosure ID.
Describe only what the code does, in neutral terms, and keep the details in the private sjpp repo.
If you don't know whether a fix is deployed, assume it isn't.

## Branch names
Do not start a branch name with `release` or `prerelease`, such as `release-*`, unless the branch is
for an actual release. These names are reserved for releases, which are usually made by the GitHub
workflows: for example, Create Release gives a run on such a branch a regular, non-draft GitHub
release, and skips the sj-pp deploy dispatch.

To test build or release changes with Create Release, use a throwaway branch named `edit-build-*`,
one of the branch patterns that the `release` environment allows, and check skip_sjpp_dispatch.
The run then creates a draft prerelease, but still pushes a version commit and tag to that branch,
publishes the changed public packages under the npm `next` tag, and pushes the Docker images.

## Commit messages
Do not add a Co-Authored-By line, or other attribution line, to a commit message. The commit-msg hook
removes any co-author line, so you don't need to remove one yourself.

## Pull request descriptions
Do not add a "Generated with Claude Code" line, or other AI-tool attribution, to a pull request
title or description.
