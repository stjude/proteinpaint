"""Developer-facing staleness check for the GSEA gene-set libraries.

NOT part of the request/response path and NOT a unit test — it is run by the
nightly `CI-enrichr-freshness` GitHub workflow, which opens/updates a tracking
issue when something here is out of date. It reports when:

  * Enrichr offers a newer year for one of the pinned blitzgsea libraries
    (gsea.BLITZ_LIBRARIES), or
  * a newer blitzgsea release exists on PyPI than the version pinned in
    python/requirements.txt.

Prints a Markdown report to stdout and exits non-zero when anything is stale,
so the workflow can branch on the exit code and use the output as the issue
body. Network errors are reported but do not crash the check.

Run locally:  python python/src/check_enrichr_freshness.py
"""

import contextlib
import io
import json
import os
import re
import sys
import urllib.request

import blitzgsea as blitz

from gsea import BLITZ_LIBRARIES

YEAR_RE = re.compile(r"(?:19|20)\d{2}")
REQUIREMENTS = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")


def _version_tuple(v):
    """'1.3.54' -> (1, 3, 54); non-numeric chunks coerce to 0."""
    out = []
    for part in v.split("."):
        m = re.match(r"\d+", part)
        out.append(int(m.group()) if m else 0)
    return tuple(out)


def check_libraries():
    """Compare each pinned library against the newest year in its family."""
    # list_libraries() prints its config dict to stdout; keep the report clean.
    with contextlib.redirect_stdout(io.StringIO()):
        available = blitz.enrichr.list_libraries()
    findings = []
    for group, pinned in sorted(BLITZ_LIBRARIES.items()):
        year_match = YEAR_RE.search(pinned)
        if not year_match:
            findings.append({"group": group, "pinned": pinned, "error": "no year in pinned name"})
            continue
        pinned_year = int(year_match.group())
        # Family = the pinned name with its year replaced by a capture group,
        # so KEGG_2026 won't match KEGG_2019_Human (different family).
        family = re.compile(
            "^" + re.escape(pinned[: year_match.start()]) + r"((?:19|20)\d{2})" + re.escape(pinned[year_match.end():]) + "$"
        )
        years = {}
        for name in available:
            m = family.match(name)
            if m:
                years[int(m.group(1))] = name
        newest_year = max(years) if years else pinned_year
        findings.append(
            {
                "group": group,
                "pinned": pinned,
                "newest": years.get(newest_year, pinned),
                "stale": newest_year > pinned_year,
            }
        )
    return findings


def _pinned_blitzgsea_version():
    with open(REQUIREMENTS) as fh:
        for line in fh:
            m = re.match(r"\s*blitzgsea==([\d.]+)", line)
            if m:
                return m.group(1)
    return None


def _installed_blitzgsea_version():
    try:
        import importlib.metadata as md

        return md.version("blitzgsea")
    except Exception:
        return None


def _latest_pypi_version(package):
    url = f"https://pypi.org/pypi/{package}/json"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.load(resp)["info"]["version"]


def check_blitzgsea_version():
    pinned = _pinned_blitzgsea_version()
    latest = _latest_pypi_version("blitzgsea")
    return {
        "pinned": pinned,
        "installed": _installed_blitzgsea_version(),
        "latest": latest,
        "stale": bool(pinned and latest and _version_tuple(latest) > _version_tuple(pinned)),
    }


def main():
    report = ["# Enrichr / blitzgsea freshness report", ""]
    stale = False
    errors = []

    try:
        lib_findings = check_libraries()
        report.append("## Enrichr gene-set libraries")
        for f in lib_findings:
            if "error" in f:
                errors.append(f"library {f['group']}: {f['error']}")
                continue
            if f["stale"]:
                stale = True
                report.append(f"- ⚠️ **{f['group']}**: pinned `{f['pinned']}` → newer available `{f['newest']}`")
            else:
                report.append(f"- ✅ {f['group']}: `{f['pinned']}` is current")
    except Exception as e:  # network / API failure shouldn't crash the check
        errors.append(f"library check failed: {type(e).__name__}: {e}")

    try:
        bg = check_blitzgsea_version()
        report += ["", "## blitzgsea package"]
        marker = "⚠️" if bg["stale"] else "✅"
        report.append(
            f"- {marker} pinned `{bg['pinned']}` (installed `{bg['installed']}`) — latest on PyPI `{bg['latest']}`"
        )
        if bg["stale"]:
            stale = True
    except Exception as e:
        errors.append(f"blitzgsea version check failed: {type(e).__name__}: {e}")

    if errors:
        report += ["", "## Errors", *[f"- {e}" for e in errors]]

    if stale:
        report += [
            "",
            "## Action",
            "Update together so the cache key stays meaningful:",
            "- `BLITZ_LIBRARIES` in `python/src/gsea.py`",
            "- `GSEA_LIBRARY_VERSION` in `server/routes/genesetEnrichment.ts`",
            "- the pinned versions in `python/requirements.txt` and `container/deps/python/requirements.txt`",
            "- the curated client version list (once the version selector ships)",
        ]

    print("\n".join(report))
    # Exit non-zero on staleness so the workflow opens/updates the issue.
    # Pure errors (network) exit 0 — don't nag devs over a transient blip.
    sys.exit(1 if stale else 0)


if __name__ == "__main__":
    main()
