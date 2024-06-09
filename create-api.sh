#!/usr/bin/env bash

set -euo pipefail

new_api="${1}"

cd src/modules/

if [ -d "${new_api}" ];then
  echo "ERROR: src/modules/${new_api} already exists"
  exit 1
fi

mkdir new-api/
cp -r card/* new-api/
rename -s card "${new_api}" new-api/*.ts

# Generate sed matcher for replacing card/Card references with the new API name
sed_cmd="$(awk '{print "s/" tolower($1) "/" tolower($2) "/g;s/" toupper(substr($1,1,1)) tolower(substr($1,2)) "/" toupper(substr($2,1,1)) tolower(substr($2,2)) "/g"}' < <(cat <<EOF
card ${new_api}
EOF
))"

echo "SED: ${sed_cmd}"
gsed -i'' "${sed_cmd}" new-api/*.ts
mv new-api/ "${new_api}"/

cd ../routes/v1/
cp card.route.ts "${new_api}".route.ts
gsed -i'' "${sed_cmd}" "${new_api}".route.ts

cat <<EOF

Successfully cloned the card API! New API is available at:
 - src/modules/${new_api}/
 - src/routes/v1/${new_api}.route.ts

Don't forget to update packages/components.yaml
EOF
