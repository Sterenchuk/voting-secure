#!/bin/bash
mongosh admin --eval "
db.getSiblingDB('audit').createCollection('audit_chain');
db.getSiblingDB('audit').createCollection('audit_security');
db.getSiblingDB('audit').audit_chain.createIndex({ sequence: 1 }, { unique: true });
db.getSiblingDB('audit').audit_chain.createIndex({ votingId: 1, votingSequence: 1 }, { unique: true, sparse: true });
db.getSiblingDB('audit').audit_chain.createIndex({ groupId: 1, groupSequence: 1 }, { unique: true, sparse: true });
db.getSiblingDB('audit').audit_chain.createIndex({ surveyId: 1, surveySequence: 1 }, { unique: true, sparse: true });
db.getSiblingDB('audit').audit_chain.createIndex({ groupId: 1, groupSequence: -1 }, { sparse: true });
db.getSiblingDB('audit').audit_chain.createIndex({ votingId: 1, votingSequence: -1 }, { sparse: true });
db.getSiblingDB('audit').audit_chain.createIndex({ surveyId: 1, surveySequence: -1 }, { sparse: true });
db.getSiblingDB('audit').audit_chain.createIndex({ groupId: 1 });
db.getSiblingDB('audit').audit_chain.createIndex({ votingId: 1 });
db.getSiblingDB('audit').audit_chain.createIndex({ votingId: 1, 'payload.ballotHashes': 1 });
db.getSiblingDB('audit').audit_chain.createIndex({ surveyId: 1 });
db.getSiblingDB('audit').audit_chain.createIndex({ userId: 1 });
db.getSiblingDB('audit').audit_chain.createIndex({ action: 1 });
db.getSiblingDB('audit').audit_security.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
db.getSiblingDB('audit').audit_security.createIndex({ userId: 1 });
db.getSiblingDB('audit').audit_security.createIndex({ action: 1 });
db.getSiblingDB('audit').createRole({
  role: 'auditWriter',
  privileges: [
    { resource: { db: 'audit', collection: 'audit_chain' }, actions: ['insert', 'find'] },
    { resource: { db: 'audit', collection: 'audit_security' }, actions: ['insert', 'find'] },
  ],
  roles: [],
});
db.getSiblingDB('audit').createUser({
  user: '$MONGO_APP_USER',
  pwd: '$MONGO_APP_PASSWORD',
  roles: [{ role: 'auditWriter', db: 'audit' }],
});
print('[mongo-init] Done. User $MONGO_APP_USER created.');
"
