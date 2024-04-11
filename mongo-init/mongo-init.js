db = db.getSiblingDB('luckperms');
db.createUser({
  user: 'luckperms',
  pwd: 'luckperms',
  roles: [{ role: 'readWrite', db: 'luckperms' }],
});

db = db.getSiblingDB('dunga-dunga');
db.createUser({
  user: 'dunga-dunga',
  pwd: 'dunga-dunga',
  roles: [{ role: 'readWrite', db: 'dunga-dunga' }],
});
