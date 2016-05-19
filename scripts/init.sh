HOST=${HOST:-localhost}
echo "Setting up initial data with $DB on $HOST"
mongoimport -h $HOST -d $DB -c users --upsert < scripts/users.json
mongoimport -h $HOST -d $DB -c profiles --upsert < scripts/profiles.json
