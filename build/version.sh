set -e

TYPE=""
if (($# == 1)); then
	TYPE=$1
fi

if [[ "$TYPE" != "minor" && "$TYPE" != "patch" ]]; then
	echo "Usage: ./build/version.sh [minor | patch]"
	exit 1
fi


npm version "$TYPE" --no-git-tag-version
NEWVER="$(node -p "require('./package.json').version")"

SVER="$(node -p "require('./server/package.json').version")"
echo "Updating server version='$SVER' to '$NEWVER'"
sed -i.bak "s/\"version\": \"$SVER\"/\"version\": \"$NEWVER\"/" ./server/package.json

CVER="$(node -p "require('./client/package.json').version")"
echo "Updating client version='$CVER' to '$NEWVER'"
sed -i.bak "s/\"version\": \"$CVER\"/\"version\": \"$NEWVER\"/" ./client/package.json
