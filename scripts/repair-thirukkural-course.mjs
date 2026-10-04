import fs from 'node:fs'
import admin from 'firebase-admin'

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credentialsPath || !fs.existsSync(credentialsPath)) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS must point to a Firebase service-account JSON file')
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))),
})

const db = admin.firestore()
const COURSE_ID = 'DNWt3cPE4ZSJG90CTC1e'
const SLUG = 'thirukkural-mastery-championship'

const ref = db.collection('courses').doc(COURSE_ID)
const snap = await ref.get()

if (!snap.exists) {
  throw new Error(`Expected Thirukkural course document ${COURSE_ID} does not exist. Refusing to create a duplicate.`)
}

const current = snap.data() || {}

if (current.slug !== SLUG) {
  throw new Error(`Course ${COURSE_ID} has unexpected slug: ${current.slug}`)
}

await ref.update({
  category_id: 'vattams-competitions',
  is_competition: true,
  is_published: true,
})

console.log('THIRUKKURAL COURSE REPAIR: PASS')
console.log('course_id:', COURSE_ID)
console.log('is_competition: true')
console.log('is_published: true')

await admin.app().delete()
