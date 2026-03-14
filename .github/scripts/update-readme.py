"""
update_readme.py — Reads changed files, calls Claude to update the README, opens a PR.

Triggered by GitHub Actions on push to main.
Requires: ANTHROPIC_API_KEY, GITHUB_TOKEN, REPO_NAME env vars.
"""
import os
import sys
import textwrap
from pathlib import Path
import anthropic
from github import Github

# ── Config ────────────────────────────────────────────────────────────────────

README_PATH = "opsplan/README.md"
CHANGED_FILES_PATH = "/tmp/changed_files.txt"
BRANCH_NAME = "chore/auto-readme-update"

# Files to always include as context even if unchanged
ALWAYS_INCLUDE = [
    "opsplan/api/main.py",
    "opsplan/agents/base_agent.py",
]

# Directories to collect changed files from
WATCHED_DIRS = [
    "opsplan/agents",
    "opsplan/skills",
    "opsplan/api",
    "opsplan/services",
    "opsplan/data",
]

MAX_FILE_CHARS = 8_000  # Truncate large files to keep prompt manageable

# ── Helpers ───────────────────────────────────────────────────────────────────

def read_file_safe(path: str) -> str | None:
    """Read a file, return None if missing or binary."""
    p = Path(path)
    if not p.exists():
        return None
    try:
        content = p.read_text(encoding="utf-8")
        if len(content) > MAX_FILE_CHARS:
            content = content[:MAX_FILE_CHARS] + f"\n\n... [truncated at {MAX_FILE_CHARS} chars]"
        return content
    except (UnicodeDecodeError, PermissionError):
        return None


def get_changed_files() -> list[str]:
    """Return list of changed .py files in watched directories."""
    changed = Path(CHANGED_FILES_PATH).read_text().splitlines()
    return [
        f for f in changed
        if f.endswith(".py")
        and any(f.startswith(d) for d in WATCHED_DIRS)
    ]


def build_prompt(readme: str, changed_files: dict[str, str], always_files: dict[str, str]) -> str:
    """Build the prompt for Claude."""

    changed_section = ""
    for path, content in changed_files.items():
        changed_section += f"\n\n### {path}\n```python\n{content}\n```"

    context_section = ""
    for path, content in always_files.items():
        if path not in changed_files:  # Don't duplicate
            context_section += f"\n\n### {path}\n```python\n{content}\n```"

    commit_msg = os.environ.get("COMMIT_MESSAGE", "")
    commit_sha = os.environ.get("COMMIT_SHA", "")[:8]

    return textwrap.dedent(f"""
        You are maintaining the README for OpsPlan, a disaster response mission planning tool
        built for the Team Rubicon hackathon by team THYNK UNLIMITED.

        The README is structured around 5 hackathon judging criteria (20% each):
        1. Technological Implementation
        2. Agentic Design & Innovation
        3. Real-World Impact & Applicability
        4. User Experience & Presentation
        5. Adherence to Hackathon Category

        A push to main just changed the following files (commit {commit_sha}: "{commit_msg}").

        ## Changed files:{changed_section}

        ## Unchanged context files (for reference):{context_section}

        ## Current README:
        ```markdown
        {readme}
        ```

        ## Your task:
        Update the README to reflect the code changes. Rules:
        - Preserve the overall structure, tone, and all 5 judging criteria sections
        - Only update sections that are actually affected by the changed code
        - If a new skill/agent/endpoint was added, document it (add to tables, explain in relevant criteria section)
        - If something was removed or renamed, update accordingly
        - If the changes are trivial (e.g. a bug fix, logging tweak), make minimal or no changes and say so
        - Do NOT rewrite sections that are unaffected
        - Do NOT add filler text or generic AI padding
        - Return ONLY the full updated README markdown, nothing else — no preamble, no explanation
    """).strip()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    github_token = os.environ.get("GITHUB_TOKEN")
    repo_name = os.environ.get("REPO_NAME")

    if not all([api_key, github_token, repo_name]):
        print("ERROR: Missing ANTHROPIC_API_KEY, GITHUB_TOKEN, or REPO_NAME")
        sys.exit(1)

    # Read current README
    readme = read_file_safe(README_PATH)
    if not readme:
        print(f"ERROR: Could not read {README_PATH}")
        sys.exit(1)

    # Collect changed files
    changed_paths = get_changed_files()
    if not changed_paths:
        print("No watched .py files changed — skipping README update.")
        sys.exit(0)

    print(f"Changed files: {changed_paths}")

    changed_files = {p: read_file_safe(p) for p in changed_paths}
    changed_files = {k: v for k, v in changed_files.items() if v is not None}

    always_files = {p: read_file_safe(p) for p in ALWAYS_INCLUDE}
    always_files = {k: v for k, v in always_files.items() if v is not None}

    # Call Claude
    client = anthropic.Anthropic(api_key=api_key)
    print("Calling Claude API...")

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[
            {"role": "user", "content": build_prompt(readme, changed_files, always_files)}
        ],
    )

    updated_readme = message.content[0].text.strip()

    # Sanity check — make sure we got actual markdown back
    if len(updated_readme) < 500 or "# OpsPlan" not in updated_readme:
        print("ERROR: Claude returned an unexpected response. Aborting.")
        print(updated_readme[:500])
        sys.exit(1)

    # Skip if no meaningful change
    if updated_readme.strip() == readme.strip():
        print("README is already up to date — no PR needed.")
        sys.exit(0)

    # Open PR via GitHub API
    g = Github(github_token)
    repo = g.get_repo(repo_name)
    default_branch = repo.default_branch

    # Get current README SHA (needed for update)
    contents = repo.get_contents(README_PATH, ref=default_branch)

    # Create or reset the branch
    try:
        ref = repo.get_git_ref(f"heads/{BRANCH_NAME}")
        sha = repo.get_branch(default_branch).commit.sha
        ref.edit(sha)
        print(f"Reset existing branch {BRANCH_NAME}")
    except Exception:
        sha = repo.get_branch(default_branch).commit.sha
        repo.create_git_ref(ref=f"refs/heads/{BRANCH_NAME}", sha=sha)
        print(f"Created branch {BRANCH_NAME}")

    # Commit updated README to branch
    commit_sha_short = os.environ.get("COMMIT_SHA", "")[:8]
    repo.update_file(
        path=README_PATH,
        message=f"docs: auto-update README for {commit_sha_short}",
        content=updated_readme,
        sha=contents.sha,
        branch=BRANCH_NAME,
    )
    print("Committed updated README to branch")

    # Check if PR already exists
    existing_prs = repo.get_pulls(state="open", head=f"{repo.owner.login}:{BRANCH_NAME}")
    if existing_prs.totalCount > 0:
        pr = existing_prs[0]
        pr.edit(body=build_pr_body(changed_paths, commit_sha_short))
        print(f"Updated existing PR: {pr.html_url}")
    else:
        pr = repo.create_pull(
            title="docs: auto-update README",
            body=build_pr_body(changed_paths, commit_sha_short),
            head=BRANCH_NAME,
            base=default_branch,
        )
        print(f"Opened PR: {pr.html_url}")


def build_pr_body(changed_paths: list[str], commit_sha: str) -> str:
    files_list = "\n".join(f"- `{p}`" for p in changed_paths)
    return textwrap.dedent(f"""
        ## Auto-generated README update

        Triggered by commit `{commit_sha}`.

        **Files that changed:**
        {files_list}

        Claude reviewed the diff and updated the README to reflect the changes.
        Review the diff before merging — if the update looks wrong, close this PR and update manually.

        > Generated by `.github/scripts/update_readme.py`
    """).strip()


if __name__ == "__main__":
    main()
