import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

const adminApp = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

export const db = getFirestore(adminApp);