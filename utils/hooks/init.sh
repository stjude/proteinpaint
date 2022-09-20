# called from the proteinpaint directory

mv -f .git/hooks/pre-commit .git/hooks/pre-commit-bkup
cd .git/hooks
ln -s ../../utils/hooks/pre-commit pre-commit
cd ../..

INSTALL_PYTHON=/usr/local/opt/python@3.9/bin/python3.9
ARGS=(hook-impl --config=.pre-commit-config.yaml --hook-type=pre-commit)
# end templated

HERE="$(cd "$(dirname "$0")" && pwd)"
ARGS+=(--hook-dir "$HERE" -- "$@")

if [ -x "$INSTALL_PYTHON" ]; then
    exec "$INSTALL_PYTHON" -mpre_commit "${ARGS[@]}"
fi
