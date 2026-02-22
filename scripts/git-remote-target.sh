#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REMOTE_FILE=".git/.default-push-remote"
PROFILE_FILE=".git/.git-account-profiles"
ACTIVE_PROFILE_FILE=".git/.active-git-profile"

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
  scripts/git-remote-target.sh profile-list
  scripts/git-remote-target.sh profile-add <profile> <remote> <url> <git_user_name> <git_user_email> [github_username] [--default]
  scripts/git-remote-target.sh profile-use <profile> [--no-default]
  scripts/git-remote-target.sh profile-show [profile]
  scripts/git-remote-target.sh profile-current
  scripts/git-remote-target.sh profile-remove <profile>

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

  scripts/git-remote-target.sh profile-add edupro origin https://github.com/EDU-PR/edudash-pro-app.git "EDUPRO Bot" "dev@edupro.app" EDU-PR --default
  scripts/git-remote-target.sh profile-use edupro
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

profile_name_valid() {
  local name="$1"
  [[ "$name" =~ ^[A-Za-z0-9_-]+$ ]]
}

profile_get() {
  local profile="$1"
  local key="$2"
  git config -f "$PROFILE_FILE" --get "profile.${profile}.${key}" 2>/dev/null || true
}

profile_exists() {
  local profile="$1"
  [[ -n "$(profile_get "$profile" "remote")" ]]
}

profile_set() {
  local profile="$1"
  local key="$2"
  local value="$3"
  git config -f "$PROFILE_FILE" "profile.${profile}.${key}" "$value"
}

profile_unset_optional() {
  local profile="$1"
  local key="$2"
  git config -f "$PROFILE_FILE" --unset "profile.${profile}.${key}" >/dev/null 2>&1 || true
}

active_profile() {
  if [[ -f "$ACTIVE_PROFILE_FILE" ]]; then
    cat "$ACTIVE_PROFILE_FILE"
    return 0
  fi
  return 1
}

set_default_remote_file() {
  local remote="$1"
  echo "$remote" > "$DEFAULT_REMOTE_FILE"
}

apply_profile() {
  local profile="$1"
  local set_default="${2:-true}"

  if ! profile_exists "$profile"; then
    echo "Profile '$profile' does not exist."
    exit 1
  fi

  local remote_name remote_url git_user_name git_user_email github_username
  remote_name="$(profile_get "$profile" "remote")"
  remote_url="$(profile_get "$profile" "url")"
  git_user_name="$(profile_get "$profile" "git-user-name")"
  git_user_email="$(profile_get "$profile" "git-user-email")"
  github_username="$(profile_get "$profile" "github-username")"

  if [[ -z "$remote_name" || -z "$remote_url" || -z "$git_user_name" || -z "$git_user_email" ]]; then
    echo "Profile '$profile' is incomplete. Required: remote, url, git-user-name, git-user-email."
    exit 1
  fi

  if remote_exists "$remote_name"; then
    git remote set-url "$remote_name" "$remote_url"
  else
    git remote add "$remote_name" "$remote_url"
  fi

  git config --local user.name "$git_user_name"
  git config --local user.email "$git_user_email"

  if [[ -n "$github_username" ]]; then
    git config --local credential.username "$github_username"
    if [[ "$remote_url" == *"github.com"* ]]; then
      git config --local credential.https://github.com.username "$github_username"
    fi
  fi

  if [[ "$set_default" == "true" ]]; then
    set_default_remote_file "$remote_name"
  fi

  echo "$profile" > "$ACTIVE_PROFILE_FILE"

  echo "Applied profile '$profile'"
  echo "  remote: $remote_name -> $remote_url"
  echo "  git user: $git_user_name <$git_user_email>"
  if [[ -n "$github_username" ]]; then
    echo "  credential username: $github_username"
  fi
  if [[ "$set_default" == "true" ]]; then
    echo "  default push remote: $remote_name"
  fi
}

profile_show() {
  local profile="${1:-}"
  if [[ -z "$profile" ]]; then
    if active_profile >/dev/null 2>&1; then
      profile="$(active_profile)"
    fi
  fi
  if [[ -z "$profile" ]]; then
    echo "No active profile. Pass a profile name or run profile-use <profile>."
    return 0
  fi
  if ! profile_exists "$profile"; then
    echo "Profile '$profile' does not exist."
    exit 1
  fi

  local remote_name remote_url git_user_name git_user_email github_username
  remote_name="$(profile_get "$profile" "remote")"
  remote_url="$(profile_get "$profile" "url")"
  git_user_name="$(profile_get "$profile" "git-user-name")"
  git_user_email="$(profile_get "$profile" "git-user-email")"
  github_username="$(profile_get "$profile" "github-username")"

  local local_user_name local_user_email default_remote active_marker
  local_user_name="$(git config --local --get user.name 2>/dev/null || true)"
  local_user_email="$(git config --local --get user.email 2>/dev/null || true)"
  default_remote="$(read_default_remote 2>/dev/null || true)"
  active_marker=""
  if active_profile >/dev/null 2>&1 && [[ "$(active_profile)" == "$profile" ]]; then
    active_marker=" (active)"
  fi

  echo "Profile: $profile$active_marker"
  echo "  remote: $remote_name"
  echo "  url: $remote_url"
  echo "  git user: $git_user_name <$git_user_email>"
  if [[ -n "$github_username" ]]; then
    echo "  github username: $github_username"
  fi
  echo "  default remote file: ${default_remote:-"(not set)"}"
  echo "  repo local git user: ${local_user_name:-"(not set)"} <${local_user_email:-"(not set)"}>"
}

profile_list() {
  if [[ ! -f "$PROFILE_FILE" ]]; then
    echo "No account profiles configured."
    return 0
  fi

  local active
  active="$(active_profile 2>/dev/null || true)"
  mapfile -t profile_names < <(
    git config -f "$PROFILE_FILE" --name-only --get-regexp '^profile\.[A-Za-z0-9_-]+\.remote$' 2>/dev/null \
      | sed -E 's/^profile\.([A-Za-z0-9_-]+)\.remote$/\1/' \
      | sort -u
  )

  if [[ "${#profile_names[@]}" -eq 0 ]]; then
    echo "No account profiles configured."
    return 0
  fi

  echo "Configured account profiles:"
  for name in "${profile_names[@]}"; do
    local remote_name remote_url git_user_email marker
    remote_name="$(profile_get "$name" "remote")"
    remote_url="$(profile_get "$name" "url")"
    git_user_email="$(profile_get "$name" "git-user-email")"
    marker=" "
    if [[ -n "$active" && "$name" == "$active" ]]; then
      marker="*"
    fi
    echo " ${marker} ${name} -> ${remote_name} (${git_user_email})"
    echo "    ${remote_url}"
  done
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

  profile-list)
    profile_list
    ;;

  profile-add)
    profile="${2:-}"
    remote_name="${3:-}"
    remote_url="${4:-}"
    git_user_name="${5:-}"
    git_user_email="${6:-}"
    shift 6 || true
    github_username=""
    set_default_profile="false"
    for arg in "$@"; do
      if [[ "$arg" == "--default" ]]; then
        set_default_profile="true"
      elif [[ -z "$github_username" ]]; then
        github_username="$arg"
      else
        echo "Unexpected argument: $arg"
        usage
        exit 1
      fi
    done
    if [[ -z "$profile" || -z "$remote_name" || -z "$remote_url" || -z "$git_user_name" || -z "$git_user_email" ]]; then
      usage
      exit 1
    fi
    if ! profile_name_valid "$profile"; then
      echo "Invalid profile name '$profile'. Use letters, numbers, _ or -."
      exit 1
    fi
    profile_set "$profile" "remote" "$remote_name"
    profile_set "$profile" "url" "$remote_url"
    profile_set "$profile" "git-user-name" "$git_user_name"
    profile_set "$profile" "git-user-email" "$git_user_email"
    if [[ -n "$github_username" ]]; then
      profile_set "$profile" "github-username" "$github_username"
    else
      profile_unset_optional "$profile" "github-username"
    fi
    echo "Saved profile '$profile'"
    if [[ "$set_default_profile" == "true" ]]; then
      apply_profile "$profile" "true"
    fi
    ;;

  profile-use)
    profile="${2:-}"
    set_default_profile="true"
    if [[ -z "$profile" ]]; then
      usage
      exit 1
    fi
    if [[ "${3:-}" == "--no-default" ]]; then
      set_default_profile="false"
    fi
    apply_profile "$profile" "$set_default_profile"
    ;;

  profile-show)
    profile_show "${2:-}"
    ;;

  profile-current)
    profile_show
    ;;

  profile-remove)
    profile="${2:-}"
    if [[ -z "$profile" ]]; then
      usage
      exit 1
    fi
    if ! profile_exists "$profile"; then
      echo "Profile '$profile' does not exist."
      exit 1
    fi
    git config -f "$PROFILE_FILE" --remove-section "profile.${profile}"
    if active_profile >/dev/null 2>&1 && [[ "$(active_profile)" == "$profile" ]]; then
      rm -f "$ACTIVE_PROFILE_FILE"
      echo "Removed profile '$profile' and cleared active profile."
    else
      echo "Removed profile '$profile'."
    fi
    ;;

  *)
    usage
    exit 1
    ;;
esac
