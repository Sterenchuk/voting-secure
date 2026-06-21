#!/bin/bash
# test-scripts/audit-tamper.sh
# Automatically find a block in MongoDB and tamper with its payload to trigger a verification failure.

# Credentials from .env
USER=audit_app
PASS=HueFqc31Dm8OcEueKbOlJyxE6NQn73uFHKkqDFaQJe7sUjcxUT
DB=audit

echo "🔍 Finding a random block to tamper..."

# Get a random block sequence
BLOCK_INFO=$(docker exec -i voting-audit-db mongosh "mongodb://${USER}:${PASS}@localhost:27017/${DB}?authSource=${DB}" --quiet --eval "
  var block = db.audit_chain.findOne({ sequence: { \$gt: 0 } });
  if (block) {
    print(block.sequence + '|' + JSON.stringify(block.payload));
  } else {
    print('NONE');
  }
")

if [ "$BLOCK_INFO" == "NONE" ]; then
  echo "❌ No blocks found in audit_chain. Please cast some votes first."
  exit 1
fi

SEQUENCE=$(echo $BLOCK_INFO | cut -d'|' -f1)
ORIGINAL_PAYLOAD=$(echo $BLOCK_INFO | cut -d'|' -f2)

echo "🎯 Tampering with block #$SEQUENCE..."

# Modify the payload in DB
docker exec -i voting-audit-db mongosh "mongodb://${USER}:${PASS}@localhost:27017/${DB}?authSource=${DB}" --quiet --eval "
  db.audit_chain.updateOne(
    { sequence: $SEQUENCE },
    { \$set: { 'payload.TAMPERED_BY_SCRIPT': true, 'payload.original': $ORIGINAL_PAYLOAD } }
  )
"

echo "✅ Block #$SEQUENCE tampered. Hash is now invalid."
echo "👉 Now go to the frontend Audit Hub and click 'Verify' to see the failure."
echo "   Or run: curl -X GET http://localhost/api/audit/verify (Requires Admin JWT)"
