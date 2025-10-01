// sign.js - Combined Firebase email/password signup + login + Uploadcare upload + Paystack
// CONFIG: update these if needed
const REGISTRATION_FEE_NGN = 2500;
const PAYSTACK_KEY = 'pk_test_cd5536a98573d218606597cfcb75a963cff8f1a4'; // replace with your Paystack key
const SAVE_USER_ENDPOINT = '/api/auth/register'; // optional server hook (not required if using Firebase)

// UPLOADCARE settings (replaces Imgur)
const UPLOADCARE_PUBLIC_KEY = "2683b7806064b3db73e3"; // <-- replace with your Uploadcare public key
const UPLOADCARE_BASE_UPLOAD = "https://upload.uploadcare.com/base/"; // REST upload endpoint
const UPLOADCARE_CDN = "https://12hsb3bgrj.ucarecd.net/"; // CDN base for uploaded files

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDC3L5vruhYXfarn5O81cLld50oagYkmxE",
  authDomain: "campus-leaders.firebaseapp.com",
  projectId: "campus-leaders",
  storageBucket: "campus-leaders.firebasestorage.app",
  messagingSenderId: "445360528951",
  appId: "1:445360528951:web:712da8859c8ac4cb6129b2"
};

// ========== keep the stateSchools object EXACTLY as you provided ==========
const stateSchools = {
  "Abia": ["Michael Okpara University", "Abia State University"],
  "Adamawa": ["Adamawa State University", "Modibbo Adama University"],
  "Akwa Ibom": ["Akwa Ibom State University", "University of Uyo"],
  "Anambra": ["Nnamdi Azikiwe University", "Chukwuemeka Odumegwu Ojukwu University"],
  "Bauchi": ["Bauchi State University", "Abubakar Tafawa Balewa University"],
  "Bayelsa": ["Niger Delta University", "Bayelsa Medical University"],
  "Benue": ["Benue State University", "Federal University Wukari"],
  "Borno": ["University of Maiduguri", "Ramat Polytechnic"],
  "Cross River": ["University of Calabar", "Cross River University"],
  "Delta": ["Delta State University", "Delta State Polytechnic"],
  "Ebonyi": ["Ebonyi State University", "Alex Ekwueme University"],
  "Edo": ["University of Benin", "Edo State University"],
  "Ekiti": ["Ekiti State University", "Federal University Oye-Ekiti"],
  "Enugu": ["University of Nigeria Nsukka", "Enugu State University"],
  "Gombe": ["Gombe State University", "Federal University Kashere"],
  "Imo": ["Imo State University", "Federal University Ndufu-Alike"],
  "Jigawa": ["Jigawa State University", "Sule Lamido University"],
  "Kaduna": ["Ahmadu Bello University", "Kaduna State University"],
  "Kano": ["Bayero University Kano", "Kano State University"],
  "Katsina": ["Umaru Musa Yar'Adua University", "Federal University Dutsin-Ma"],
  "Kebbi": ["Kebbi State University", "Usmanu Danfodiyo University (Sokoto campus)"],
  "Kogi": ["Kogi State University", "Federal University Lokoja"],
  "Kwara": ["Kwara State University", "Federal University Lokoja (campus)"],
  "Lagos": ["University of Lagos", "Lagos State University"],
  "Nasarawa": ["Nasarawa State University", "Federal University Lafia"],
  "Niger": ["Federal University of Technology Minna", "Niger State Polytechnic"],
  "Ogun": ["Covenant University", "Federal University of Agriculture Abeokuta"],
  "Ondo": ["University of Medical Sciences", "Adekunle Ajasin University"],
  "Osun": ["Obafemi Awolowo University", "Osun State University"],
  "Oyo": ["University of Ibadan", "Ladoke Akintola University"],
  "Plateau": ["University of Jos", "Plateau State University"],
  "Rivers": ["University of Port Harcourt", "Rivers State University"],
  "Sokoto": ["Usmanu Danfodiyo University", "Sokoto State University"],
  "Taraba": ["Taraba State University", "Federal University Wukari"],
  "Yobe": ["Yobe State University", "Federal University Gashua"],
  "Zamfara": ["Zamfara State University", "Federal University Gusau"]
};
// ============================================================================

// fill registration fee UI if present
try { document.getElementById('registration-fee').textContent = REGISTRATION_FEE_NGN; } catch(e){}

// DOM refs (keeps your UI)
const stateSelect = document.getElementById('state-select');
const schoolSelect = document.getElementById('school-select');
const assocSelect = document.getElementById('assoc-select');
const assocAddBtn = document.getElementById('assoc-add-btn');
const assocNewInput = document.getElementById('assoc-new-input');

const imageInput = document.getElementById('image-input');
const imagePreview = document.getElementById('image-preview'); // optional in your markup
const imageName = document.getElementById('image-name');

const yearSelect = document.getElementById('year-held');

const tabSignup = document.getElementById('tab-signup');
const tabLogin = document.getElementById('tab-login');
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const panelTitle = document.getElementById('panel-title');

// small helper modal (injected) for loading/success/error
const modal = createModal();
document.body.appendChild(modal.el);

// ---------- firebase helpers: wait for compat SDK and init ----------
let USE_FIREBASE = false;
let firebaseInited = false;
let auth = null, db = null;

async function waitForFirebaseSDK(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.firebase && window.firebase.auth && window.firebase.firestore) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

(async function initFirebaseIfAvailable() {
  const ok = await waitForFirebaseSDK(6000);
  if (!ok) {
    console.warn('Firebase compat SDK not detected within timeout. Script will still work without Firebase (server flow).');
    return;
  }
  try {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    USE_FIREBASE = true;
    firebaseInited = true;
    console.log('Firebase initialized (compat).');
  } catch (err) {
    console.warn('Firebase init error:', err);
  }
})();

// ---------- populate states & years (keeps your object) ----------
Object.keys(stateSchools).sort().forEach(s => {
  const opt = document.createElement('option');
  opt.value = s; opt.textContent = s;
  stateSelect.appendChild(opt);
});
const currentYear = new Date().getFullYear();
for (let y = currentYear; y >= 1950; y--) {
  const o = document.createElement('option'); o.value = y; o.textContent = y;
  yearSelect.appendChild(o);
}

// when state changes, populate schools
stateSelect.addEventListener('change', () => {
  const state = stateSelect.value;
  schoolSelect.innerHTML = '<option value="">Select school</option>';
  if (state && stateSchools[state]) {
    stateSchools[state].forEach(s => {
      const opt = document.createElement('option'); opt.value = s; opt.textContent = s;
      schoolSelect.appendChild(opt);
    });
    schoolSelect.disabled = false;
  } else {
    schoolSelect.disabled = true;
  }
  // clear/reload associations for the selected school
  assocSelect.innerHTML = '<option value="">Select association (or Add new)</option>';
  loadAssociationsForSchool();
});

// associations stored in localStorage (preserve your behavior)
const STORAGE_ASSOC_KEY = 'campus_assoc_list_v1';
function loadAssociationsLocal() {
  let arr = JSON.parse(localStorage.getItem(STORAGE_ASSOC_KEY) || '[]');
  if (arr.length === 0) {
    arr = ['Student Union', 'Debate Club', 'Basketball Club', 'Science Club'];
    localStorage.setItem(STORAGE_ASSOC_KEY, JSON.stringify(arr));
  }
  return arr;
}
function populateAssocSelectWithLocal() {
  const arr = loadAssociationsLocal();
  assocSelect.innerHTML = '<option value="">Select association (or Add new)</option>';
  arr.forEach(a => {
    const opt = document.createElement('option'); opt.value = a; opt.textContent = a;
    assocSelect.appendChild(opt);
  });
}
populateAssocSelectWithLocal();

assocAddBtn.addEventListener('click', () => {
  assocNewInput.classList.toggle('hidden');
  if (!assocNewInput.classList.contains('hidden')) assocNewInput.focus();
});
assocNewInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const name = assocNewInput.value.trim();
    if (!name) return alert('Please type the association name');
    const arr = JSON.parse(localStorage.getItem(STORAGE_ASSOC_KEY) || '[]');
    if (!arr.includes(name)) {
      arr.push(name);
      localStorage.setItem(STORAGE_ASSOC_KEY, JSON.stringify(arr));
    }
    populateAssocSelectWithLocal();
    assocSelect.value = name;
    assocNewInput.value = '';
    assocNewInput.classList.add('hidden');

    // optionally persist association in Firestore (non-essential)
    if (USE_FIREBASE && db) {
      try {
        const stateName = stateSelect.value || null;
        const schoolName = schoolSelect.value || null;
        await db.collection('associations').add({
          name,
          stateName,
          schoolName,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) { console.warn('Failed to save association in Firestore:', err); }
    }
  }
});

// image preview
let imageFileDataUrl = null;
imageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    if (imagePreview) { imagePreview.classList.add('hidden'); imagePreview.src = ''; }
    imageName.textContent = '';
    imageFileDataUrl = null;
    return;
  }
  imageName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    if (imagePreview) {
      imagePreview.src = ev.target.result;
      imagePreview.classList.remove('hidden');
    }
    imageFileDataUrl = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// tab toggles (preserve your UI)
tabSignup.addEventListener('click', () => {
  signupForm.classList.remove('hidden'); loginForm.classList.add('hidden');
  tabSignup.classList.add('bg-two','text-white'); tabLogin.classList.remove('bg-two','text-white');
  panelTitle.textContent = 'Sign up';
});
tabLogin.addEventListener('click', () => {
  signupForm.classList.add('hidden'); loginForm.classList.remove('hidden');
  tabLogin.classList.add('bg-two','text-white'); tabSignup.classList.remove('bg-two','text-white');
  panelTitle.textContent = 'Login';
});

// simple error helper
function showError(msg) { alert(msg); }

// Paystack checkout (keeps existing flow)
function payWithPaystack(email, amountNGN, metadata = {}, onSuccess, onClose) {
  if (!window.PaystackPop) {
    showError('Paystack script not loaded.');
    return;
  }
  const handler = PaystackPop.setup({
    key: PAYSTACK_KEY,
    email,
    amount: amountNGN * 100,
    currency: 'NGN',
    metadata: {
      custom_fields: [{ display_name: "Registration fee", variable_name: "reg_fee", value: `${amountNGN}` }],
      ...metadata
    },
    callback: function(response){ onSuccess && onSuccess(response); },
    onClose: function(){ onClose && onClose(); }
  });
  handler.openIframe();
}

// ---------- UPLOAD to Uploadcare (replaces Imgur) ----------
async function uploadImageToUploadcare(file) {
  if (!UPLOADCARE_PUBLIC_KEY) throw new Error('Uploadcare public key not set');
  const form = new FormData();
  form.append('file', file);
  form.append('UPLOADCARE_PUB_KEY', UPLOADCARE_PUBLIC_KEY);
  form.append('UPLOADCARE_STORE', '1'); // store and make available on CDN

  const resp = await fetch(UPLOADCARE_BASE_UPLOAD, {
    method: 'POST',
    body: form
  });

  const data = await resp.json();
  if (!resp.ok) {
    const msg = data?.error?.message || data?.detail || data?.message || JSON.stringify(data);
    throw new Error('Uploadcare upload failed: ' + msg);
  }

  // data.file contains uuid/path. Build CDN URL.
  const fileId = (data && data.file) ? String(data.file).replace(/^\/+|\/+$/g, '') : null;
  if (!fileId) throw new Error('Uploadcare did not return file id');
  // Ensure trailing slash for consistent usage
  const cdnUrl = `${UPLOADCARE_CDN.replace(/\/+$/,'')}/${fileId}/`;
  return cdnUrl;
}

// helpers to find state/school docs by name (optional, non-destructive)
async function findStateDocByName(name) {
  if (!USE_FIREBASE) return null;
  const q = await db.collection('states').where('name', '==', name).limit(1).get();
  return q.empty ? null : { id: q.docs[0].id, data: q.docs[0].data() };
}
async function findSchoolDocByName(name) {
  if (!USE_FIREBASE) return null;
  const q = await db.collection('schools').where('name', '==', name).limit(1).get();
  return q.empty ? null : { id: q.docs[0].id, data: q.docs[0].data() };
}

// load associations for selected school (merge local + Firestore)
async function loadAssociationsForSchool() {
  populateAssocSelectWithLocal();
  if (!USE_FIREBASE || !db) return;
  const schoolName = schoolSelect.value || null;
  if (!schoolName) return;
  try {
    const snapshot = await db.collection('associations').where('schoolName', '==', schoolName).orderBy('createdAt', 'desc').limit(100).get();
    snapshot.forEach(doc => {
      const d = doc.data();
      const already = Array.from(assocSelect.options).some(o => o.value === d.name);
      if (!already) {
        const opt = document.createElement('option'); opt.value = d.name; opt.textContent = d.name;
        assocSelect.appendChild(opt);
      }
    });
  } catch (err) { console.warn('Failed loading associations from Firestore', err); }
}
schoolSelect.addEventListener('change', loadAssociationsForSchool);

// ---------- SIGNUP handler (email + password ONLY) ----------
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(signupForm);
  const required = ['firstName','lastName','username','email','phone','state','school','password','confirmPassword'];
  for (const k of required) {
    if (!fd.get(k) || fd.get(k).toString().trim() === '') return showError('Please fill all required fields.');
  }
  if (fd.get('password') !== fd.get('confirmPassword')) return showError('Passwords do not match.');

  const payload = {
    firstName: fd.get('firstName').trim(),
    lastName: fd.get('lastName').trim(),
    username: fd.get('username').trim(),
    email: fd.get('email').trim(),
    phone: fd.get('phone').trim(),
    state: fd.get('state'),
    school: fd.get('school'),
    association: fd.get('association') || '',
    position: fd.get('position') || '',
    positionDetails: fd.get('positionDetails') || '',
    yearHeld: fd.get('yearHeld') || '',
    password: fd.get('password'),
    imageDataUrl: imageFileDataUrl || null
  };

  // Use Firebase flow when available
  if (USE_FIREBASE && auth && db) {
    try {
      modal.showLoading('Creating account...');
      // create Firebase auth user
      const userCred = await auth.createUserWithEmailAndPassword(payload.email, payload.password);
      const user = userCred.user;
      const uid = user.uid;

      // upload image to Uploadcare (optional)
      let imageUrl = null;
      if (imageInput.files && imageInput.files[0]) {
        try {
          modal.showLoading('Uploading profile image...');
          imageUrl = await uploadImageToUploadcare(imageInput.files[0]);
        } catch (err) {
          console.warn('Uploadcare upload failed (continuing):', err);
        }
      }

      // update Firebase user profile so displayName and photoURL are set
      try {
        const displayName = `${payload.firstName} ${payload.lastName}`;
        await user.updateProfile({ displayName, photoURL: imageUrl || null });
      } catch (err) {
        console.warn('updateProfile failed:', err);
      }

      // try to find state/school docs (non-blocking)
      let stateDoc = null, schoolDoc = null;
      try { stateDoc = await findStateDocByName(payload.state); } catch(e){/*ignore*/ }
      try { schoolDoc = await findSchoolDocByName(payload.school); } catch(e){/*ignore*/ }

      // create user document in Firestore
      modal.showLoading('Saving profile...');
      const userDoc = {
        uid,
        firstName: payload.firstName,
        lastName: payload.lastName,
        username: payload.username || null,
        email: payload.email,
        phone: payload.phone || null,
        stateName: payload.state || null,
        schoolName: payload.school || null,
        stateId: stateDoc ? stateDoc.id : null,
        schoolId: schoolDoc ? schoolDoc.id : null,
        association: payload.association || null,
        position: payload.position || null,
        positionDetails: payload.positionDetails || null,
        yearHeld: payload.yearHeld || null,
        imageUrl: imageUrl || null,
        paymentStatus: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(uid).set(userDoc);

      // After user is created and profile saved, open Paystack and attach uid in metadata
      modal.showLoading('Opening payment window...');
      payWithPaystack(payload.email, REGISTRATION_FEE_NGN, { uid }, async (resp) => {
        try {
          modal.showLoading('Verifying payment and saving...');
          // record payment
          await db.collection('payments').add({
            uid,
            email: payload.email,
            amount: REGISTRATION_FEE_NGN,
            reference: resp.reference,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          // update user
          await db.collection('users').doc(uid).update({ paymentStatus: 'paid', paymentReference: resp.reference });

          // optionally notify your server endpoint
          if (SAVE_USER_ENDPOINT && SAVE_USER_ENDPOINT !== '/api/auth/register') {
            try {
              await fetch(SAVE_USER_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference: resp.reference, uid })
              });
            } catch (err) {
              console.warn('Optional SAVE_USER_ENDPOINT failed:', err);
            }
          }

          modal.showSuccess('Registration complete — payment verified.');
          modal.addActionButton('Go to dashboard', () => window.location.href = '/dashboard.html');
        } catch (err) {
          console.error('Payment verification/save error:', err);
          modal.showError('Payment succeeded but verification/save failed. Check admin logs.');
        }
      }, () => {
        modal.showError('Payment window closed. You can retry to complete registration.');
      });

    } catch (err) {
      console.error('Firebase signup error:', err);
      modal.showError(err && err.message ? err.message : 'Signup failed');
    }
    return;
  }

  // If Firebase not available, fall back to original pay-first then server-save flow
  payWithPaystack(payload.email, REGISTRATION_FEE_NGN, { user: payload }, async (resp) => {
    try {
      const res = await fetch(SAVE_USER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: resp.reference, user: payload })
      });
      if (!res.ok) {
        const t = await res.text();
        showError('Payment succeeded but saving user failed: ' + t);
        return;
      }
      alert('Registration complete! Payment verified and account created.');
      window.location.href = '/dashboard.html';
    } catch (err) {
      console.error(err);
      showError('Payment succeeded but could not contact the server to save the account. Check network/server logs.');
    }
  }, () => {
    alert('Payment window closed. You can retry to complete registration.');
  });

});

// ---------- LOGIN handler (email + password only) ----------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(loginForm);
  const email = fd.get('loginId')?.toString().trim();
  const password = fd.get('loginPassword')?.toString().trim();
  if (!email || !password) return showError('Please enter email and password.');

  // require firebase for login
  if (!USE_FIREBASE || !auth) {
    return showError('Login requires Firebase to be initialized.');
  }

  try {
    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    await auth.signInWithEmailAndPassword(email, password);
    // successful login -> redirect to dashboard
    window.location.href = '/dashboard.html';
  } catch (err) {
    console.error('Login error:', err);
    const code = err.code || '';
    if (code === 'auth/wrong-password') return showError('Incorrect password.');
    if (code === 'auth/user-not-found') return showError('No account found for this email.');
    return showError(err.message || 'Sign-in failed.');
  }
});

// ---------- SIGN OUT helper ----------
async function signOutNow() {
  if (USE_FIREBASE && auth) {
    try {
      await auth.signOut();
    } catch (err) { console.warn('Sign out error:', err); }
  } else {
    localStorage.removeItem('auth_token');
  }
  window.location.href = '/'; // or reload
}
// attach to menu sign-out (try to find by text matching)
document.addEventListener('click', (ev) => {
  const el = ev.target;
  if (!el) return;
  if ((el.matches && el.matches('a')) || (el.closest && el.closest('a'))) {
    const a = el.matches('a') ? el : el.closest('a');
    if (a && /sign\s?out/i.test(a.textContent || '')) {
      ev.preventDefault();
      signOutNow();
    }
  }
});

// ---------- small helpers: modal, etc. ----------
function createModal() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.left = 0;
  overlay.style.top = 0;
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = 9999;
  overlay.style.backdropFilter = 'blur(3px)';

  const card = document.createElement('div');
  card.style.background = 'white';
  card.style.padding = '20px';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
  card.style.maxWidth = '420px';
  card.style.width = '90%';
  card.style.textAlign = 'center';
  const title = document.createElement('div'); title.style.fontWeight = 700; title.style.marginBottom = '8px';
  const body = document.createElement('div'); body.style.fontSize = '14px'; body.style.color = '#374151'; body.style.marginBottom = '12px';
  const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.justifyContent = 'center'; actions.style.gap = '8px';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.padding = '8px 12px';
  closeBtn.style.borderRadius = '8px';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => hide());

  actions.appendChild(closeBtn);
  card.appendChild(title); card.appendChild(body); card.appendChild(actions);
  overlay.appendChild(card);

  function showLoading(message = 'Loading...') {
    title.textContent = 'Please wait';
    body.textContent = message;
    actions.innerHTML = '';
    actions.appendChild(closeBtn);
    overlay.style.display = 'flex';
  }
  function showSuccess(message = 'Success') {
    title.textContent = 'Success';
    body.textContent = message;
    actions.innerHTML = '';
    const ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.style.padding = '8px 12px';
    ok.style.borderRadius = '8px';
    ok.style.border = 'none';
    ok.style.cursor = 'pointer';
    ok.addEventListener('click', () => hide());
    actions.appendChild(ok);
    overlay.style.display = 'flex';
  }
  function showError(message = 'Error') {
    title.textContent = 'Error';
    body.textContent = message;
    actions.innerHTML = '';
    const ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.style.padding = '8px 12px';
    ok.style.borderRadius = '8px';
    ok.style.border = 'none';
    ok.style.cursor = 'pointer';
    ok.addEventListener('click', () => hide());
    actions.appendChild(ok);
    overlay.style.display = 'flex';
  }
  function hide() { overlay.style.display = 'none'; }
  function addActionButton(text, cb) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.padding = '8px 12px';
    btn.style.borderRadius = '8px';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', cb);
    actions.appendChild(btn);
    overlay.style.display = 'flex';
    return btn;
  }

  return { el: overlay, showLoading, showSuccess, showError, hide, addActionButton };
}

// small accessibility: close assoc input on escape
assocNewInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') assocNewInput.classList.add('hidden'); });

// expose helper
window.CampusLeaders = window.CampusLeaders || {};
window.CampusLeaders.signOutNow = signOutNow;
window.CampusLeaders.findUsersByAssociation = async function(associationName) {
  if (!USE_FIREBASE || !db) return [];
  const q = await db.collection('users').where('association', '==', associationName).get();
  return q.docs.map(d => ({ id: d.id, ...d.data() }));
};
