#!/bin/bash 

export PATH_TO_DB=test/data/data.db 
export MIGRATIONS_FOLDER=test/migrations 

node ./migrate.js migrate
node ./migrate.js migrate up
node ./migrate.js migrate down 1
node ./migrate.js migrate -1
node ./migrate.js migrate 2
node ./migrate.js fake 2
node ./migrate.js fake down 2
node ./migrate.js fake up 
node ./migrate.js fake -1
node ./migrate.js migrate 3
node ./migrate.js list

echo "All five migrations should be applied."
echo -n "<enter> to reset "
read 

rm -fv test/data/data.db 