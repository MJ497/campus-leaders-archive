// server.js
// Express server that verifies Firebase ID token and returns ImageKit auth params
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ImageKit = require('imagekit');
const admin = require('firebase-admin');

const app = express();
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*'  // restrict in production
}));
app.use(express.json());

// Initialize Firebase Admin (use service account JSON or Application Default Credentials)
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(svc)
  });
} else {
  // If running in GCP environment with ADC, this will work
  admin.initializeApp();
}

// Init ImageKit SDK
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// Helper: require Authorization: Bearer <idToken>
async function verifyFirebaseIdToken(req, res, next) {
  try {
    const authHeader = req.get('Authorization') || req.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.fuser = decoded; // attach decoded token (uid, email etc)
    return next();
  } catch (err) {
    console.error('verifyFirebaseIdToken err', err);
    return res.status(401).json({ error: 'Invalid ID token' });
  }
}

// POST /imagekit-auth
// Body optional: { fileName } — not required, but you can use it if wanted
app.post('/imagekit-auth', verifyFirebaseIdToken, (req, res) => {
  try {
    // Optionally check req.fuser.uid or custom claims here (e.g. only certain users)
    const authParams = imagekit.getAuthenticationParameters(); // returns { token, expire, signature }
    return res.json(authParams);
  } catch (err) {
    console.error('imagekit auth error', err);
    return res.status(500).json({ error: 'Failed to create signature' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ImageKit auth server listening on port ${PORT}`);
});
