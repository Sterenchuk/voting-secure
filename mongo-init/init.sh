#!/bin/bash
set -e

echo "[mongo-init] Creating app user, collections, indexes, and roles..."

mongosh --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin admin --eval "
// Create app user
db.getSiblingDB('audit').createUser({
  user: process.env.MONGO_APP_USER || 'audit_app',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'audit' }]
});

db.getSiblingDB('audit').createCollection('audit_chain');
db.getSiblingDB('audit').createCollection('audit_security');
db.getSiblingDB('audit').audit_chain.createIndex({ sequence: 1 }, { unique: true });
db.getSiblingDB('audit').audit_chain.createIndex({ votingId: 1, votingSequence: 1 }, { unique: true, sparse: true });
db.getSiblingDB('audit').audit_chain.createIndex({ groupId: 1, groupSequence: 1 }, { unique: true, sparse: true });
db.getSiblingDB('audit').audit_chain.createIndex({ surveyId: 1, surveySequence: 1 }, { sparse: true });
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
    { resource: { db: 'audit', collection: 'audit_checkpoints' }, actions: ['insert', 'find'] },
    { resource: { db: 'audit', collection: 'audit_verification' }, actions: ['insert', 'find'] },
    { resource: { db: 'audit', collection: 'audit_verification_jobs' }, actions: ['insert', 'find'] },
  ],
  roles: [],
});

print('[mongo-init] Done.');
"