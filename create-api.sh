#!/usr/bin/env bash

set -euo pipefail

new_api="${1}"

cd src/modules/

if [ -d "${new_api}" ];then
  echo "ERROR: src/modules/${new_api} already exists"
  exit 1
fi

mkdir -p new-api/
cp -r score/* new-api/
rename score "${new_api}" new-api/*.ts

# Generate sed matcher for replacing score/Score references with the new API name
sed_cmd="$(awk '{print "s/" tolower($1) "/" tolower($2) "/g;s/" toupper(substr($1,1,1)) tolower(substr($1,2)) "/" toupper(substr($2,1,1)) tolower(substr($2,2)) "/g"}' < <(cat <<EOF
score ${new_api}
EOF
))"

echo "SED: ${sed_cmd}"
sed -i'' "${sed_cmd}" new-api/*.ts
mv new-api/ "${new_api}"/

cd ../routes/v1/
cp score.route.ts "${new_api}".route.ts
sed -i'' "${sed_cmd}" "${new_api}".route.ts

cat <<EOF

Successfully cloned the score API! New API is available at:
 - src/modules/${new_api}/
 - src/routes/v1/${new_api}.route.ts

Don't forget to update packages/components.yaml
EOF
