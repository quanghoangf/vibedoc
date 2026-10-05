#!/bin/sh
# VibeDoc installer for macOS and Linux. No Node needed: it brings its own.
#
#   curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh
#   curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh -s -- --update
#   curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh -s -- --uninstall
#
# What it does: downloads the official Node.js LTS build into ~/.vibedoc/node (checksum-verified),
# installs the vibedoc npm package into ~/.vibedoc/lib with that Node, and writes the launcher
# ~/.vibedoc/bin/vibedoc. It asks before adding that folder to your PATH, and never asks for sudo.
#
# Environment: VIBEDOC_HOME (default ~/.vibedoc), VIBEDOC_VERSION (default latest),
# VIBEDOC_NO_MODIFY_PATH=1 (never touch shell files).
set -eu

NODE_LINE="latest-v22.x" # Node 22 LTS; VibeDoc needs 20.9 or newer
HOME_DIR="${VIBEDOC_HOME:-$HOME/.vibedoc}"
VERSION="${VIBEDOC_VERSION:-latest}"
MODE=install

for arg in "$@"; do
  case "$arg" in
    --update) MODE=update ;;
    --uninstall) MODE=uninstall ;;
    -h|--help) echo "usage: install.sh [--update | --uninstall]  (env: VIBEDOC_HOME, VIBEDOC_VERSION, VIBEDOC_NO_MODIFY_PATH=1)"; exit 0 ;;
    *) echo "vibedoc install: unknown option $arg (use --update or --uninstall)" >&2; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
fail() { printf 'vibedoc install: %s\n' "$*" >&2; exit 1; }

# Can we ask the person at the keyboard? (stdin is the script itself when piped from curl)
can_ask() { [ -z "${VIBEDOC_NO_MODIFY_PATH:-}" ] && { : </dev/tty; } 2>/dev/null; }

rc_file() {
  case "$(basename "${SHELL:-sh}")" in
    zsh) echo "${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) if [ "$(uname -s)" = Darwin ]; then echo "$HOME/.bash_profile"; else echo "$HOME/.bashrc"; fi ;;
    fish) echo "$HOME/.config/fish/config.fish" ;;
    *) echo "$HOME/.profile" ;;
  esac
}

path_line() {
  case "$1" in
    *config.fish) echo "fish_add_path \"$HOME_DIR/bin\" # vibedoc" ;;
    *) echo "export PATH=\"$HOME_DIR/bin:\$PATH\" # vibedoc" ;;
  esac
}

if [ "$MODE" = uninstall ]; then
  rm -rf "$HOME_DIR/node" "$HOME_DIR/lib" "$HOME_DIR/bin"
  say "Removed VibeDoc from $HOME_DIR (your projects and saved test runs are untouched)."
  rc="$(rc_file)"
  if [ -f "$rc" ] && grep -q '# vibedoc$' "$rc"; then
    say "Your PATH line is still in $rc (the line ending in '# vibedoc'); delete it when you like."
  fi
  exit 0
fi

# Platform
case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "this installer is for macOS and Linux; on Windows use install.ps1 (see https://quanghoangf.github.io/vibedoc/docs/)" ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch=x64 ;;
  arm64|aarch64) arch=arm64 ;;
  *) fail "unsupported CPU $(uname -m); install Node.js 20.9+ and run: npm install -g vibedoc" ;;
esac

# Tools
if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -qO "$2" "$1"; }
else
  fail "needs curl or wget"
fi
if command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  fail "needs sha256sum or shasum to verify the Node download"
fi
command -v tar >/dev/null 2>&1 || fail "needs tar"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

# Node: the newest build of the LTS line, verified against nodejs.org's SHASUMS256.txt
base="https://nodejs.org/dist/$NODE_LINE"
say "Downloading Node.js ($NODE_LINE, $os-$arch)…"
fetch "$base/SHASUMS256.txt" "$tmp/SHASUMS256.txt" || fail "could not reach nodejs.org"
line="$(grep -E " node-v[0-9.]+-$os-$arch\.tar\.gz$" "$tmp/SHASUMS256.txt" | head -n 1)"
[ -n "$line" ] || fail "no Node.js build for $os-$arch in $base"
want="${line%% *}"
file="${line##* }"
fetch "$base/$file" "$tmp/$file" || fail "could not download $file"
got="$(sha256 "$tmp/$file")"
[ "$got" = "$want" ] || fail "checksum mismatch for $file (expected $want, got $got); nothing was installed"
mkdir -p "$tmp/node"
tar -xzf "$tmp/$file" -C "$tmp/node" --strip-components 1

# VibeDoc, installed with that Node into a staging folder, then swapped in
say "Installing vibedoc@$VERSION…"
PATH="$tmp/node/bin:$PATH" "$tmp/node/bin/npm" install --global --prefix "$tmp/lib" --no-fund --no-audit --no-update-notifier --loglevel=error "vibedoc@$VERSION" \
  || fail "npm install vibedoc@$VERSION failed"

mkdir -p "$HOME_DIR"
rm -rf "$HOME_DIR/node" "$HOME_DIR/lib"
mv "$tmp/node" "$HOME_DIR/node"
mv "$tmp/lib" "$HOME_DIR/lib"
mkdir -p "$HOME_DIR/bin"
cat > "$HOME_DIR/bin/vibedoc" <<EOF
#!/bin/sh
# VibeDoc launcher written by install.sh: its own Node first on PATH (the CLI starts the server with npx).
PATH="$HOME_DIR/node/bin:\$PATH"
export PATH
exec "$HOME_DIR/node/bin/node" "$HOME_DIR/lib/lib/node_modules/vibedoc/bin/vibedoc.mjs" "\$@"
EOF
chmod +x "$HOME_DIR/bin/vibedoc"

installed="$("$HOME_DIR/bin/vibedoc" --version)" || fail "installed, but 'vibedoc --version' failed"
if [ "$MODE" = update ]; then say "Updated VibeDoc to $installed."; else say "Installed VibeDoc $installed in $HOME_DIR."; fi

# PATH: only with a yes from the person at the keyboard
case ":$PATH:" in
  *":$HOME_DIR/bin:"*) say "Run: vibedoc   (in your project folder)"; exit 0 ;;
esac
rc="$(rc_file)"
add="$(path_line "$rc")"
if [ -f "$rc" ] && grep -qF "$add" "$rc"; then
  say "Open a new terminal, then run: vibedoc"
  exit 0
fi
answer=n
if can_ask; then
  printf 'Add %s to your PATH in %s? [y/N] ' "$HOME_DIR/bin" "$rc" >/dev/tty
  read -r answer </dev/tty || answer=n
fi
case "$answer" in
  y|Y|yes|YES)
    mkdir -p "$(dirname "$rc")"
    printf '\n%s\n' "$add" >> "$rc"
    say "Added to $rc. Open a new terminal, then run: vibedoc"
    ;;
  *)
    say "Not changing your shell files. To run vibedoc by name, add this line to $rc:"
    say "  $add"
    say "Or run it directly: $HOME_DIR/bin/vibedoc"
    ;;
esac
