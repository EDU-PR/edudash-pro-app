#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REMOTE_FILE=".git/.default-push-remote"

usage() {
  cat <<'EOF'
Usage:
  scripts/git-remote-target.sh list
  scripts/git-remote-target.sh add <name> <url>
  scripts/git-remote-target.sh set-default <name>
  scripts/git-remote-target.sh show-default
  scripts/git-remote-target.sh push [remote] [branch]
  scripts/git-remote-target.sh pull [remote] [branch]
  scripts/git-remote-target.sh fetch [remote]
  scripts/git-remote-target.sh remove <name>

Selection priority for [remote]:
  1) explicit argument
  2) GIT_REMOTE_TARGET env var (current shell)
  3) stored default from set-default
  4) origin

Examples:
  scripts/git-remote-target.sh add youngeagles git@github.com:YoungEagles/edudashpro.git
  scripts/git-remote-target.sh set-default youngeagles
  scripts/git-remote-target.sh push
  GIT_REMOTE_TARGET=origin scripts/git-remote-target.sh push
EOF
}

current_branch() {
  git rev-parse --abbrev-ref HEAD
}

read_default_remote() {
  if [[ -f "$DEFAULT_REMOTE_FILE" ]]; then
    cat "$DEFAULT_REMOTE_FILE"
    return 0
  fi
  return 1
}

remote_exists() {
  local name="$1"
  git remote get-url "$name" >/dev/null 2>&1
}

resolve_remote() {
  local explicit="${1:-}"
  if [[ -n "$explicit" ]]; then
    echo "$explicit"
    return 0
  fi

  if [[ -n "${GIT_REMOTE_TARGET:-}" ]]; then
    echo "$GIT_REMOTE_TARGET"
    return 0
  fi

  if read_default_remote >/dev/null 2>&1; then
    read_default_remote
    return 0
  fi

  echo "origin"
}

cmd="${1:-}"
case "$cmd" in
  list)
    git remote -v
    ;;

  add)
    name="${2:-}"
    url="${3:-}"
    if [[ -z "$name" || -z "$url" ]]; then
      usage
      exit 1
    fi
    if remote_exists "$name"; then
      git remote set-url "$name" "$url"
      echo "Updated remote '$name' -> $url"
    else
      git remote add "$name" "$url"
      echo "Added remote '$name' -> $url"
    fi
    ;;

  set-default)
    name="${2:-}"
    if [[ -z "$name" ]]; then
      usage
      exit 1
    fi
    if ! remote_exists "$name"; then
      echo "Remote '$name' does not exist."
      exit 1
    fi
    echo "$name" > "$DEFAULT_REMOTE_FILE"
    echo "Default push remote set to '$name'"
    ;;

  show-default)
    if read_default_remote >/dev/null 2>&1; then
      echo "Default push remote: $(read_default_remote)"
    else
      echo "Default push remote: (not set)"
    fi
    ;;

  push)
    remote="$(resolve_remote "${2:-}")"
    branch="${3:-$(current_branch)}"
    if ! remote_exists "$remote"; then
      echo "Remote '$remote' does not exist."
      exit 1
    fi
    echo "Pushing '$branch' to '$remote'..."
    git push "$remote" "$branch"
    ;;

  pull)
    remote="$(resolve_remote "${2:-}")"
    branch="${3:-$(current_branch)}"
    if ! remote_exists "$remote"; then
      echo "Remote '$remote' does not exist."
      exit 1
    fi
    echo "Pulling '$branch' from '$remote'..."
    git pull "$remote" "$branch"
    ;;

  fetch)
    remote="$(resolve_remote "${2:-}")"
    if ! remote_exists "$remote"; then
      echo "Remote '$remote' does not exist."
      exit 1
    fi
    echo "Fetching from '$remote'..."
    git fetch "$remote"
    ;;

  remove)
    name="${2:-}"
    if [[ -z "$name" ]]; then
      usage
      exit 1
    fi
    if ! remote_exists "$name"; then
      echo "Remote '$name' does not exist."
      exit 1
    fi
    git remote remove "$name"
    if [[ -f "$DEFAULT_REMOTE_FILE" && "$(cat "$DEFAULT_REMOTE_FILE")" == "$name" ]]; then
      rm -f "$DEFAULT_REMOTE_FILE"
      echo "Removed remote '$name' and cleared default."
    else
      echo "Removed remote '$name'."
    fi
    ;;

  *)
    usage
    exit 1
    ;;
esac
