

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDC3L5vruhYXfarn5O81cLld50oagYkmxE",
  authDomain: "campus-leaders.firebaseapp.com",
  projectId: "campus-leaders",
  storageBucket: "campus-leaders.firebasestorage.app",
  messagingSenderId: "445360528951",
  appId: "1:445360528951:web:712da8859c8ac4cb6129b2"
};

if (window.firebase && FIREBASE_CONFIG && FIREBASE_CONFIG.projectId) {
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) { console.warn('Firebase init error', e); }
}

const auth = firebase.auth();
const db = firebase.firestore();
// NOTE: storage is NOT used here (ImageKit used instead); keep if you still need it elsewhere:
// const storage = firebase.storage();

//////////////////// DOM refs ////////////////////

const profileAvatar = document.getElementById('profile-avatar');
const navAvatar = document.getElementById('nav-avatar');
const profileFullname = document.getElementById('profile-fullname');
const profilePosition = document.getElementById('profile-position');
const profileSchool = document.getElementById('profile-school');
const profileYear = document.getElementById('profile-year');
const profileAssoc = document.getElementById('profile-assoc');
const profileState = document.getElementById('profile-state');

const firstNameEl = document.getElementById('firstName');
const lastNameEl = document.getElementById('lastName');
const emailEl = document.getElementById('email');
const phoneEl = document.getElementById('phone');
const bioEl = document.getElementById('bio');
const associationEl = document.getElementById('association');
const stateEl = document.getElementById('state');

const editBtn = document.getElementById('edit-profile-btn');
const editModal = document.getElementById('edit-modal');
const closeEdit = document.getElementById('close-edit');
const cancelEdit = document.getElementById('cancel-edit');
const saveProfileBtn = document.getElementById('save-profile');

// form inputs and auxiliary DOM refs used by the profile editor
const inputFirst = document.getElementById('input-firstName');
const inputLast = document.getElementById('input-lastName');
 

//////////////////// helpers ////////////////////

function showToast(msg, bg = '#111827', ms = 2500) {
  if (!toast) {
    alert(msg);
    return;
  }
  toast.textContent = msg;
  toast.style.background = bg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), ms);
}

function openEditModal() { if (!editModal) return; editModal.classList.remove('hidden'); editModal.classList.add('flex'); }
function closeEditModal() { if (!editModal) return; editModal.classList.add('hidden'); editModal.classList.remove('flex'); uploadedImageFile = null; if (inputImage) { inputImage.value = ''; } if (inputImageName) inputImageName.textContent = ''; }

//////////////////// Populate UI ////////////////////

async function populateProfile(user) {
  currentUser = user;
  if (!user) {
    profileFullname.textContent = 'Guest';
    profilePosition.textContent = '';
    profileSchool.textContent = '';
    profileYear.textContent = '';
    profileAssoc.textContent = '';
    profileState.textContent = '';
    firstNameEl.textContent = '—';
    lastNameEl.textContent = '—';
    emailEl.textContent = 'Not signed in';
    phoneEl.textContent = '—';
    bioEl.textContent = 'Sign in to manage your profile.';
    associationEl.textContent = '';
    stateEl.textContent = '';
    if (navAvatar) navAvatar.innerHTML = '<i class="fas fa-user"></i>';
    return;
  }

  try {
    const doc = await db.collection('users').doc(user.uid).get();
    currentUserDoc = doc.exists ? doc.data() : null;
  } catch (e) {
    console.warn('Error reading user doc', e);
    currentUserDoc = null;
  }

  const first = currentUserDoc?.firstName || currentUser.displayName?.split(' ')[0] || '';
  const last = currentUserDoc?.lastName || currentUser.displayName?.split(' ').slice(1).join(' ') || '';
  const position = currentUserDoc?.position || '';
  const email = user.email || '';
  const phone = currentUserDoc?.phone || user.phoneNumber || '';
  const bio = currentUserDoc?.bio || '';
  const school = currentUserDoc?.schoolName || '';
  const year = currentUserDoc?.yearHeld || '';
  const assoc = currentUserDoc?.association || '';
  const state = currentUserDoc?.stateName || '';
  const imageUrl = currentUserDoc?.imageUrl || user.photoURL || null;

  profileFullname.textContent = [first, last].filter(Boolean).join(' ') || (user.displayName || 'Member');
  profilePosition.textContent = position;
  profileSchool.textContent = school;
  profileYear.textContent = year;
  profileAssoc.textContent = assoc;
  profileState.textContent = state;

  firstNameEl.textContent = first || '—';
  lastNameEl.textContent = last || '—';
  emailEl.textContent = email || '—';
  phoneEl.textContent = phone || '—';
  bioEl.textContent = bio || '—';
  associationEl.textContent = assoc || '—';
  stateEl.textContent = state || '—';

  // avatar
  if (imageUrl) {
    if (profileAvatar) {
      profileAvatar.innerHTML = '';
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = profileFullname.textContent || 'avatar';
      img.className = 'h-full w-full object-cover';
      img.loading = 'lazy';
      img.onerror = () => { profileAvatar.innerHTML = '<i class="fas fa-user text-2xl"></i>'; };
      profileAvatar.appendChild(img);
    }
    if (navAvatar) {
      navAvatar.innerHTML = '';
      const nimg = document.createElement('img');
      nimg.src = imageUrl;
      nimg.alt = 'nav avatar';
      nimg.className = 'h-full w-full object-cover rounded-full';
      nimg.loading = 'lazy';
      nimg.onerror = () => { navAvatar.innerHTML = '<i class="fas fa-user"></i>'; };
      navAvatar.appendChild(nimg);
    }
  } else {
    if (profileAvatar) profileAvatar.innerHTML = '<i class="fas fa-user text-2xl"></i>';
    if (navAvatar) navAvatar.innerHTML = '<i class="fas fa-user"></i>';
  }

  // populate edit form
  if (inputFirst) inputFirst.value = currentUserDoc?.firstName || '';
  if (inputLast) inputLast.value = currentUserDoc?.lastName || '';
  if (inputPosition) inputPosition.value = currentUserDoc?.position || '';
  if (inputEmail) inputEmail.value = user.email || '';
  if (inputPhone) inputPhone.value = currentUserDoc?.phone || '';
  if (inputSchool) inputSchool.value = currentUserDoc?.schoolName || '';
  if (inputYear) inputYear.value = currentUserDoc?.yearHeld || '';
  if (inputAssoc) inputAssoc.value = currentUserDoc?.association || '';
  if (inputState) inputState.value = currentUserDoc?.stateName || '';
  if (inputBio) inputBio.value = currentUserDoc?.bio || '';
}

auth.onAuthStateChanged(async (user) => {
  if (user) await populateProfile(user);
  else await populateProfile(null);
  // previously loaded posts here; removed to stop rendering posts on profile page
  // Re-run populateProfile shortly after to avoid other scripts overwriting the profile card
  // (some pages load a global script that also updates .card elements). This ensures
  // the profile-specific IDs (profile-fullname, profile-avatar, etc.) are set correctly.
  setTimeout(() => {
    try { populateProfile(user); } catch (e) { /* ignore */ }
  }, 350);
});

async function loadProfilePosts(user) {
  if (!profileActivityPosts) return;
  profileActivityPosts.innerHTML = '<div class="text-sm text-gray-500">Loading your posts...</div>';
  try {
    let posts = [];
    if (user && db) {
      const snap = await db.collection('posts').where('authorId', '==', user.uid).orderBy('createdAt', 'desc').limit(50).get();
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      const arr = JSON.parse(localStorage.getItem('campus_posts_v1') || '[]');
      // attempt to match by stored author info in currentUserDoc
      posts = arr.filter(p => (currentUserDoc && currentUserDoc.firstName && (p.authorFirst === currentUserDoc.firstName)) || false).slice().reverse();
    }

    if (!posts || posts.length === 0) {
      profileActivityPosts.innerHTML = '<div class="text-sm text-gray-500">No posts yet.</div>';
      return;
    }
    profileActivityPosts.innerHTML = '';
    posts.forEach(p => {
      try {
        // use renderPost from script.js; it returns a DOM node
        const node = (typeof renderPost === 'function') ? renderPost(p) : null;
        if (node) {
          // Wrap the post node in a narrow container so the activity column can
          // hold multiple compact posts while the post height grows automatically.
          const wrap = document.createElement('div');
          wrap.className = 'profile-activity-item';
          // enforce same width as profile card while allowing height to expand
          wrap.style.maxWidth = '360px';
          wrap.style.width = '100%';
          wrap.style.margin = '0';
          wrap.style.display = 'block';

          // Remove rigid image heights from the cloned post so images scale naturally
          try {
            const imgs = node.querySelectorAll('img');
            imgs.forEach(img => {
              // remove Tailwind height utility classes if present
              try { img.classList.remove('h-48', 'sm:h-60', 'md:h-72'); } catch(e){}
              // allow natural height
              img.style.height = 'auto';
              img.style.maxHeight = 'none';
              img.style.display = 'block';
              img.style.width = '100%';
            });
          } catch (e) { /* non-fatal */ }

          // Place the post inside the wrapper and append the wrapper to activity list
          wrap.appendChild(node);

          // Add a delete button for posts that belong to the signed-in user
          try {
            const header = node.querySelector('.flex.items-center.justify-between') || node.querySelector('div');
            if (header && currentUser && p.authorId && currentUser.uid && (p.authorId === currentUser.uid)) {
              const del = document.createElement('button');
              del.className = 'ml-2 text-red-500 hover:text-red-700 text-sm';
              del.title = 'Delete post';
              del.innerHTML = '<i class="fas fa-trash"></i>';
              del.addEventListener('click', async (ev) => {
                ev.stopPropagation(); ev.preventDefault();
                if (!confirm('Delete this post? This cannot be undone.')) return;
                try {
                  if (typeof db !== 'undefined' && db && p.id && window.firebase) {
                    // Firebase path
                    await db.collection('posts').doc(p.id).delete();
                    wrap.remove();
                    showToast('Post deleted.');
                  } else {
                    // localStorage fallback
                    const arr = JSON.parse(localStorage.getItem('campus_posts_v1') || '[]');
                    const idx = arr.findIndex(x => (x.id && p.id && x.id === p.id) || (x.body === p.body && x.title === p.title && x.createdAt === p.createdAt));
                    if (idx >= 0) {
                      arr.splice(idx, 1);
                      localStorage.setItem('campus_posts_v1', JSON.stringify(arr));
                      wrap.remove();
                      showToast('Post deleted (local).');
                    } else {
                      showToast('Could not find post to delete', '#dc2626');
                    }
                  }
                } catch (err) { console.error('Delete failed', err); showToast('Delete failed', '#dc2626'); }
              });
              // append to header (right side)
              header.appendChild(del);
            }
          } catch (err) { /* non-fatal */ }

          profileActivityPosts.appendChild(wrap);
        } else {
          const el = document.createElement('div'); el.className = 'p-3 border rounded'; el.textContent = p.title || (p.body||'').slice(0,120);
          el.style.maxWidth = '360px';
          profileActivityPosts.appendChild(el);
        }
      } catch (err) {
        console.warn('Failed to render post preview', err);
      }
    });

const inputFirst = document.getElementById('input-firstName');
const inputLast = document.getElementById('input-lastName');
const inputPosition = document.getElementById('input-position');
const inputEmail = document.getElementById('input-email');
const inputPhone = document.getElementById('input-phone');
const inputSchool = document.getElementById('input-schoolName');
const inputYear = document.getElementById('input-yearHeld');
const inputAssoc = document.getElementById('input-association');
const inputState = document.getElementById('input-stateName');
const inputBio = document.getElementById('input-bio');
const inputImage = document.getElementById('input-image');
const inputImageName = document.getElementById('input-image-name');

// new download buttons (preferred)
const downloadPdfBtn = document.getElementById('download-pdf') || document.getElementById('download-json');
const downloadDocxBtn = document.getElementById('download-docx') || document.getElementById('download-vcard');

const signOutBtn = document.getElementById('sign-out');

const toast = document.getElementById('toast');

let currentUser = null;
let currentUserDoc = null;
let uploadedImageFile = null;
const profileActivityPosts = document.getElementById('profile-activity-posts');

//////////////////// helpers ////////////////////

function showToast(msg, bg = '#111827', ms = 2500) {
  if (!toast) {
    alert(msg);
    return;
  }
  toast.textContent = msg;
  toast.style.background = bg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), ms);
}

function openEditModal() { if (!editModal) return; editModal.classList.remove('hidden'); editModal.classList.add('flex'); }
function closeEditModal() { if (!editModal) return; editModal.classList.add('hidden'); editModal.classList.remove('flex'); uploadedImageFile = null; if (inputImage) { inputImage.value = ''; } if (inputImageName) inputImageName.textContent = ''; }

//////////////////// Populate UI ////////////////////

async function populateProfile(user) {
  currentUser = user;
  if (!user) {
    profileFullname.textContent = 'Guest';
    profilePosition.textContent = '';
    profileSchool.textContent = '';
    profileYear.textContent = '';
    profileAssoc.textContent = '';
    profileState.textContent = '';
    firstNameEl.textContent = '—';
    lastNameEl.textContent = '—';
    emailEl.textContent = 'Not signed in';
    phoneEl.textContent = '—';
    bioEl.textContent = 'Sign in to manage your profile.';
    associationEl.textContent = '';
    stateEl.textContent = '';
    if (navAvatar) navAvatar.innerHTML = '<i class="fas fa-user"></i>';
    return;
  }

  try {
    const doc = await db.collection('users').doc(user.uid).get();
    currentUserDoc = doc.exists ? doc.data() : null;
  } catch (e) {
    console.warn('Error reading user doc', e);
    currentUserDoc = null;
  }

  const first = currentUserDoc?.firstName || currentUser.displayName?.split(' ')[0] || '';
  const last = currentUserDoc?.lastName || currentUser.displayName?.split(' ').slice(1).join(' ') || '';
  const position = currentUserDoc?.position || '';
  const email = user.email || '';
  const phone = currentUserDoc?.phone || user.phoneNumber || '';
  const bio = currentUserDoc?.bio || '';
  const school = currentUserDoc?.schoolName || '';
  const year = currentUserDoc?.yearHeld || '';
  const assoc = currentUserDoc?.association || '';
  const state = currentUserDoc?.stateName || '';
  const imageUrl = currentUserDoc?.imageUrl || user.photoURL || null;

  profileFullname.textContent = [first, last].filter(Boolean).join(' ') || (user.displayName || 'Member');
  profilePosition.textContent = position;
  profileSchool.textContent = school;
  profileYear.textContent = year;
  profileAssoc.textContent = assoc;
  profileState.textContent = state;

  firstNameEl.textContent = first || '—';
  lastNameEl.textContent = last || '—';
  emailEl.textContent = email || '—';
  phoneEl.textContent = phone || '—';
  bioEl.textContent = bio || '—';
  associationEl.textContent = assoc || '—';
  stateEl.textContent = state || '—';

  // avatar
  if (imageUrl) {
    if (profileAvatar) {
      profileAvatar.innerHTML = '';
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = profileFullname.textContent || 'avatar';
      img.className = 'h-full w-full object-cover';
      img.loading = 'lazy';
      img.onerror = () => { profileAvatar.innerHTML = '<i class="fas fa-user text-2xl"></i>'; };
      profileAvatar.appendChild(img);
    }
    if (navAvatar) {
      navAvatar.innerHTML = '';
      const nimg = document.createElement('img');
      nimg.src = imageUrl;
      nimg.alt = 'nav avatar';
      nimg.className = 'h-full w-full object-cover rounded-full';
      nimg.loading = 'lazy';
      nimg.onerror = () => { navAvatar.innerHTML = '<i class="fas fa-user"></i>'; };
      navAvatar.appendChild(nimg);
    }
  } else {
    if (profileAvatar) profileAvatar.innerHTML = '<i class="fas fa-user text-2xl"></i>';
    if (navAvatar) navAvatar.innerHTML = '<i class="fas fa-user"></i>';
  }

  // populate edit form
  if (inputFirst) inputFirst.value = currentUserDoc?.firstName || '';
  if (inputLast) inputLast.value = currentUserDoc?.lastName || '';
  if (inputPosition) inputPosition.value = currentUserDoc?.position || '';
  if (inputEmail) inputEmail.value = user.email || '';
  if (inputPhone) inputPhone.value = currentUserDoc?.phone || '';
  if (inputSchool) inputSchool.value = currentUserDoc?.schoolName || '';
  if (inputYear) inputYear.value = currentUserDoc?.yearHeld || '';
  if (inputAssoc) inputAssoc.value = currentUserDoc?.association || '';
  if (inputState) inputState.value = currentUserDoc?.stateName || '';
  if (inputBio) inputBio.value = currentUserDoc?.bio || '';
}

auth.onAuthStateChanged(async (user) => {
  if (user) await populateProfile(user);
  else await populateProfile(null);
  // load user's posts after auth resolution
  loadProfilePosts(user);
  // Re-run populateProfile shortly after to avoid other scripts overwriting the profile card
  // (some pages load a global script that also updates .card elements). This ensures
  // the profile-specific IDs (profile-fullname, profile-avatar, etc.) are set correctly.
  setTimeout(() => {
    try { populateProfile(user); } catch (e) { /* ignore */ }
  }, 350);
});

async function loadProfilePosts(user) {
  if (!profileActivityPosts) return;
  profileActivityPosts.innerHTML = '<div class="text-sm text-gray-500">Loading your posts...</div>';
  try {
    let posts = [];
    if (user && db) {
      // Attempt multiple reasonable author fields to be robust across different post schemas.
      const queries = [];
      try {
        queries.push(db.collection('posts').where('authorId', '==', user.uid).orderBy('createdAt', 'desc').limit(50).get());
      } catch (e) { /* ignore invalid query */ }
      try {
        queries.push(db.collection('posts').where('authorUid', '==', user.uid).orderBy('createdAt', 'desc').limit(50).get());
      } catch (e) { /* ignore */ }
      try {
        queries.push(db.collection('posts').where('uid', '==', user.uid).orderBy('createdAt', 'desc').limit(50).get());
      } catch (e) { /* ignore */ }
      if (user.email) {
        try { queries.push(db.collection('posts').where('authorEmail', '==', user.email).orderBy('createdAt', 'desc').limit(50).get()); } catch (e) { /* ignore */ }
      }

      if (queries.length === 0) {
        // fallback single query
        const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(50).get();
        posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        const snaps = await Promise.all(queries.map(p => p.catch(() => null)));
        const map = new Map();
        snaps.forEach(snap => {
          if (!snap) return;
          snap.docs.forEach(d => {
            const data = { id: d.id, ...d.data() };
            if (!map.has(data.id)) map.set(data.id, data);
          });
        });
        // convert to array and sort by createdAt timestamp desc (if present)
        posts = Array.from(map.values()).sort((a,b) => {
          const ta = a.createdAt ? (a.createdAt.seconds || new Date(a.createdAt).getTime()/1000) : 0;
          const tb = b.createdAt ? (b.createdAt.seconds || new Date(b.createdAt).getTime()/1000) : 0;
          return tb - ta;
        }).slice(0,50);
      }
    } else {
      const arr = JSON.parse(localStorage.getItem('campus_posts_v1') || '[]');
      // attempt to match by stored author info in currentUserDoc
      posts = arr.filter(p => (currentUserDoc && currentUserDoc.firstName && (p.authorFirst === currentUserDoc.firstName)) || false).slice().reverse();
    }

    if (!posts || posts.length === 0) {
      profileActivityPosts.innerHTML = '<div class="text-sm text-gray-500">No posts yet.</div>';
      return;
    }
    profileActivityPosts.innerHTML = '';
    posts.forEach(p => {
      try {
        // use renderPost from script.js; it returns a DOM node
        const node = (typeof renderPost === 'function') ? renderPost(p) : null;
        if (node) {
          // Constrain the post card width so activity posts match the profile card width
          node.style.maxWidth = '360px';
          node.style.margin = '0';
          node.style.display = 'block';

          // Add a delete button for posts that belong to the signed-in user
          try {
            const header = node.querySelector('.flex.items-center.justify-between') || node.querySelector('div');
            if (header && currentUser && p.authorId && currentUser.uid && (p.authorId === currentUser.uid)) {
              const del = document.createElement('button');
              del.className = 'ml-2 text-red-500 hover:text-red-700 text-sm';
              del.title = 'Delete post';
              del.innerHTML = '<i class="fas fa-trash"></i>';
              del.addEventListener('click', async (ev) => {
                ev.stopPropagation(); ev.preventDefault();
                if (!confirm('Delete this post? This cannot be undone.')) return;
                try {
                  if (typeof db !== 'undefined' && db && p.id && window.firebase) {
                    // Firebase path
                    await db.collection('posts').doc(p.id).delete();
                    node.remove();
                    showToast('Post deleted.');
                  } else {
                    // localStorage fallback
                    const arr = JSON.parse(localStorage.getItem('campus_posts_v1') || '[]');
                    const idx = arr.findIndex(x => (x.id && p.id && x.id === p.id) || (x.body === p.body && x.title === p.title && x.createdAt === p.createdAt));
                    if (idx >= 0) {
                      arr.splice(idx, 1);
                      localStorage.setItem('campus_posts_v1', JSON.stringify(arr));
                      node.remove();
                      showToast('Post deleted (local).');
                    } else {
                      showToast('Could not find post to delete', '#dc2626');
                    }
                  }
                } catch (err) { console.error('Delete failed', err); showToast('Delete failed', '#dc2626'); }
              });
              // append to header (right side)
              header.appendChild(del);
            }
          } catch (err) { /* non-fatal */ }

          profileActivityPosts.appendChild(node);
        } else {
          const el = document.createElement('div'); el.className = 'p-3 border rounded'; el.textContent = p.title || (p.body||'').slice(0,120);
          el.style.maxWidth = '360px';
          profileActivityPosts.appendChild(el);
        }
      } catch (err) {
        console.warn('Failed to render post preview', err);
      }
    });
  } catch (err) {
    console.error('Failed to load profile posts', err);
    profileActivityPosts.innerHTML = '<div class="text-sm text-gray-500">Failed to load posts.</div>';
  }
}

//////////////////// ImageKit upload helper ////////////////////

/**
 * Upload file to ImageKit via your server.
 * Expects a server endpoint at /imagekit-upload that accepts FormData { file } and
 * returns { url: "https://ik.imagekit.io/..." } on success.
 *
 * Replace '/imagekit-upload' with the path to your own upload endpoint.
 */
async function uploadToImageKitServer(file) {
  if (!file) return null;
  try {
    const fd = new FormData();
    fd.append('file', file);
    // optional: pass desired folder or metadata
    // fd.append('folder', '/users/profiles');

    const resp = await fetch('/imagekit-upload', {
      method: 'POST',
      body: fd
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error('Upload failed: ' + resp.status + ' ' + text);
    }
    const data = await resp.json();
    // Expect { url: 'https://ik.imagekit.io/...' }
    return data.url || null;
  } catch (err) {
    console.error('ImageKit upload error', err);
    throw err;
  }
}

//////////////////// Edit form handlers ////////////////////

if (editBtn) {
  editBtn.addEventListener('click', () => {
    if (!auth.currentUser) {
      showToast('Please sign in to edit your profile', '#dc2626');
      return;
    }
    openEditModal();
  });
}
if (closeEdit) closeEdit.addEventListener('click', closeEditModal);
if (cancelEdit) cancelEdit.addEventListener('click', (e) => { e.preventDefault(); closeEditModal(); });

if (inputImage) {
  inputImage.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) { if (inputImageName) inputImageName.textContent = ''; uploadedImageFile = null; return; }
    if (inputImageName) inputImageName.textContent = `${f.name} (${Math.round(f.size/1024)} KB)`;
    uploadedImageFile = f;
  });
}

if (saveProfileBtn) {
  saveProfileBtn.addEventListener('click', async () => {
    if (!auth.currentUser) { showToast('Not signed in', '#dc2626'); return; }
    saveProfileBtn.disabled = true;
    // const(origText) = saveProfileBtn.textContent;
    const origText = saveProfileBtn.textContent;
    saveProfileBtn.textContent = 'Saving...';

    try {
      const uid = auth.currentUser.uid;
      const updates = {
        firstName: inputFirst.value.trim() || null,
        lastName: inputLast.value.trim() || null,
        position: inputPosition.value.trim() || null,
        phone: inputPhone.value.trim() || null,
        schoolName: inputSchool.value.trim() || null,
        yearHeld: inputYear.value.trim() || null,
        association: inputAssoc.value.trim() || null,
        stateName: inputState.value.trim() || null,
        bio: inputBio.value.trim() || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Upload via ImageKit server endpoint if image present
      if (uploadedImageFile) {
        try {
          const imgUrl = await uploadToImageKitServer(uploadedImageFile);
          if (imgUrl) updates.imageUrl = imgUrl;
        } catch (err) {
          console.warn('Image upload failed', err);
          showToast('Image upload failed', '#dc2626');
          // continue without image
        }
      }

      await db.collection('users').doc(uid).set(updates, { merge: true });

      const displayName = [updates.firstName, updates.lastName].filter(Boolean).join(' ') || auth.currentUser.displayName;
      const profileUpdates = {};
      if (displayName) profileUpdates.displayName = displayName;
      if (updates.imageUrl) profileUpdates.photoURL = updates.imageUrl;
      if (Object.keys(profileUpdates).length) {
        await auth.currentUser.updateProfile(profileUpdates);
      }

      const freshDoc = await db.collection('users').doc(uid).get();
      currentUserDoc = freshDoc.exists ? freshDoc.data() : null;
      await populateProfile(auth.currentUser);
      showToast('Profile updated.');
      closeEditModal();
    } catch (err) {
      console.error('Save profile error', err);
      showToast('Failed to save profile', '#dc2626');
    } finally {
      saveProfileBtn.disabled = false;
      saveProfileBtn.textContent = origText;
    }
  });
}

//////////////////// Export: PDF & DOCX ////////////////////

// helper to gather profile data to include in exports
function collectProfilePayload() {
  if (!auth.currentUser) return null;
  return {
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    displayName: auth.currentUser.displayName,
    firstName: currentUserDoc?.firstName || inputFirst?.value || '',
    lastName: currentUserDoc?.lastName || inputLast?.value || '',
    position: currentUserDoc?.position || inputPosition?.value || '',
    phone: currentUserDoc?.phone || inputPhone?.value || '',
    schoolName: currentUserDoc?.schoolName || inputSchool?.value || '',
    yearHeld: currentUserDoc?.yearHeld || inputYear?.value || '',
    association: currentUserDoc?.association || inputAssoc?.value || '',
    stateName: currentUserDoc?.stateName || inputState?.value || '',
    bio: currentUserDoc?.bio || inputBio?.value || '',
    imageUrl: currentUserDoc?.imageUrl || auth.currentUser.photoURL || null,
    exportedAt: new Date().toISOString()
  };
}

//////////////////// PDF export (jsPDF) ////////////////////

async function ensureJsPdf() {
  if (window.jspdf) return window.jspdf;
  // load jsPDF (UMD) from CDN
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => {
      if (window.jspdf) resolve(window.jspdf);
      else if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf);
      else {
        // some builds attach to window.jspdf or window.jspdf.jsPDF
        resolve(window.jspdf || window.jspdf?.jsPDF);
      }
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function exportProfileToPDF() {
  if (!auth.currentUser) { showToast('Sign in to export', '#dc2626'); return; }
  const payload = collectProfilePayload();
  if (!payload) { showToast('No profile data', '#dc2626'); return; }

  try {
    const jspdfLib = await ensureJsPdf();
    const { jsPDF } = jspdfLib;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginLeft = 40;
    let y = 40;

    // Title
    doc.setFontSize(18);
    doc.text(payload.displayName || `${payload.firstName} ${payload.lastName}`, marginLeft, y);
    y += 22;

    doc.setFontSize(11);
    const lines = [
      `Email: ${payload.email || ''}`,
      `Phone: ${payload.phone || ''}`,
      `Position: ${payload.position || ''}`,
      `Association: ${payload.association || ''}`,
      `School: ${payload.schoolName || ''} ${payload.yearHeld ? '(' + payload.yearHeld + ')' : ''}`,
      `State: ${payload.stateName || ''}`,
      ''
    ];

    lines.forEach(line => { doc.text(line, marginLeft, y); y += 16; });

    if (payload.bio) {
      y += 4;
      doc.setFontSize(12);
      doc.text('Bio:', marginLeft, y); y += 14;
      doc.setFontSize(10);
      // split text to fit page width
      const pageWidth = doc.internal.pageSize.getWidth();
      const usableWidth = pageWidth - marginLeft * 2;
      const bioLines = doc.splitTextToSize(payload.bio, usableWidth);
      doc.text(bioLines, marginLeft, y);
      y += bioLines.length * 12 + 8;
    }

    // If image exists, try to embed it (fetch as dataURL, then add to doc)
    if (payload.imageUrl) {
      try {
        const res = await fetch(payload.imageUrl);
        const blob = await res.blob();
        // convert blob to dataURL
        const dataUrl = await new Promise((res2) => {
          const r = new FileReader();
          r.onload = () => res2(r.result);
          r.readAsDataURL(blob);
        });
        // fit image width to 120pt, preserve aspect ratio
        const imgProps = doc.getImageProperties(dataUrl);
        const iw = 120;
        const ih = (imgProps.height / imgProps.width) * iw;
        const pageW = doc.internal.pageSize.getWidth();
        doc.addImage(dataUrl, 'JPEG', pageW - marginLeft - iw, 40, iw, ih);
      } catch (err) {
        console.warn('Failed to add image to PDF', err);
      }
    }

    // Footer timestamp
    doc.setFontSize(9);
    doc.text(`Exported: ${new Date().toLocaleString()}`, marginLeft, doc.internal.pageSize.getHeight() - 30);

    // Save
    const filename = `${(payload.displayName || payload.email || 'profile')}_profile.pdf`.replace(/\s+/g, '_');
    doc.save(filename);
    showToast('PDF exported.');
  } catch (err) {
    console.error('PDF export failed', err);
    showToast('PDF export failed', '#dc2626');
  }
}

//////////////////// DOCX (Word HTML) export ////////////////////

/**
 * Simple approach: create a Word-compatible HTML and download with .docx extension.
 * This is supported by Word (it will detect HTML inside). It's a lightweight cross-browser approach.
 * If you want a strict .docx OpenXML package, I can swap to a library (docx) — requires additional client libs.
 */
function exportProfileToDocx() {
  if (!auth.currentUser) { showToast('Sign in to export', '#dc2626'); return; }
  const payload = collectProfilePayload();
  if (!payload) { showToast('No profile data', '#dc2626'); return; }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(payload.displayName || 'Profile')}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #111827; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 6px; }
          .meta { margin-bottom: 12px; font-size: 13px; color: #374151; }
          .section { margin-bottom: 10px; }
          .label { font-weight: bold; color: #111827; }
          .bio { white-space: pre-wrap; margin-top: 6px; color:#111827; }
          .avatar { float: right; margin-left: 12px; width: 120px; height: 120px; object-fit: cover; border-radius: 6px; }
        </style>
      </head>
      <body>
        ${payload.imageUrl ? `<img src="${payload.imageUrl}" class="avatar" />` : ''}
        <h1>${escapeHtml(payload.displayName || (payload.firstName + ' ' + payload.lastName))}</h1>
        <div class="meta">
          ${payload.position ? `<div><span class="label">Position:</span> ${escapeHtml(payload.position)}</div>` : ''}
          ${payload.schoolName ? `<div><span class="label">School:</span> ${escapeHtml(payload.schoolName)} ${payload.yearHeld ? '('+escapeHtml(payload.yearHeld)+')':''}</div>` : ''}
          ${payload.association ? `<div><span class="label">Association:</span> ${escapeHtml(payload.association)}</div>` : ''}
          ${payload.stateName ? `<div><span class="label">State:</span> ${escapeHtml(payload.stateName)}</div>` : ''}
          ${payload.phone ? `<div><span class="label">Phone:</span> ${escapeHtml(payload.phone)}</div>` : ''}
          ${payload.email ? `<div><span class="label">Email:</span> ${escapeHtml(payload.email)}</div>` : ''}
        </div>
        ${payload.bio ? `<div class="section"><div class="label">Bio</div><div class="bio">${escapeHtml(payload.bio)}</div></div>` : ''}
        <div style="margin-top:24px;font-size:11px;color:#6b7280;">Exported: ${new Date().toLocaleString()}</div>
      </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' }); // using msword mime; file saved as .docx
  const filename = `${(payload.displayName || payload.email || 'profile')}_profile.docx`.replace(/\s+/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Word document exported.');
}

//////////////////// Utils ////////////////////

function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/[&<>\"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[m]);
}

//////////////////// Wire export buttons ////////////////////

if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener('click', (e) => { e.preventDefault(); exportProfileToPDF(); });
}
if (downloadDocxBtn) {
  downloadDocxBtn.addEventListener('click', (e) => { e.preventDefault(); exportProfileToDocx(); });
}

//////////////////// Sign out, nav handlers ////////////////////

if (signOutBtn) {
  signOutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await auth.signOut();
      showToast('Signed out.');
      window.location.href = '/index.html';
    } catch (err) {
      console.error('Sign out failed', err);
      showToast('Sign out failed', '#dc2626');
    }
  });
}

const userMenuButton = document.getElementById('user-menu-button');
const userMenu = document.getElementById('user-menu');
if (userMenuButton) {
  userMenuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (userMenu) userMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (userMenu && !userMenu.contains(e.target) && !userMenuButton.contains(e.target)) userMenu.classList.add('hidden');
  });
}

const goDashboard = document.getElementById('go-dashboard');
if (goDashboard) goDashboard.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'dashboard.html'; });

const mobileSearchBtn = document.getElementById('mobile-search-btn');
if (mobileSearchBtn) mobileSearchBtn.addEventListener('click', () => { const ms = document.getElementById('mobile-search'); if (ms) ms.classList.toggle('hidden'); });
const mobileSearchClose = document.getElementById('mobile-search-close');
if (mobileSearchClose) mobileSearchClose.addEventListener('click', () => { const ms = document.getElementById('mobile-search'); if (ms) ms.classList.add('hidden'); });

//////////////////// Search integration (prefer global script) ////////////////////

(function initSearchIntegration() {
  const globalSearchEl = document.getElementById('global-search');

  // If the global site script exposes doSearch, wire up the input to it.
  if (typeof doSearch === 'function') {
    if (globalSearchEl) {
      globalSearchEl.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await doSearch(globalSearchEl.value.trim());
        }
      });
      const searchForm = globalSearchEl.closest('form');
      if (searchForm) {
        searchForm.addEventListener('submit', async (e) => { e.preventDefault(); await doSearch(globalSearchEl.value.trim()); });
      }
    }
    return;
  }

  // Fallback: if no global doSearch is available, define a lightweight doSearch
  // that mirrors the main site's behavior. This ensures the profile page still works standalone.
  if (typeof createSearchModal !== 'function') {
    function createSearchModalFallback() {
      const overlay = document.createElement('div');
      overlay.id = 'search-overlay'; overlay.style.position = 'fixed'; overlay.style.left = 0; overlay.style.top = 0; overlay.style.width = '100%'; overlay.style.height = '100%';
      overlay.style.display = 'none'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; overlay.style.zIndex = 9999; overlay.style.backdropFilter = 'blur(4px)'; overlay.style.padding = '20px';
      const card = document.createElement('div'); card.className = 'bg-white rounded-lg shadow-lg w-full max-w-3xl p-4'; card.style.maxHeight = '90vh'; card.style.overflowY = 'auto';
      const header = document.createElement('div'); header.className = 'flex items-center justify-between mb-3';
      header.innerHTML = `<input id="search-input-modal" placeholder="Search users & posts..." class="w-full rounded-md border-gray-200 bg-gray-50 px-3 py-2 text-sm" />`;
      const closeBtn = document.createElement('button'); closeBtn.className = 'ml-3 px-3 py-1 rounded bghover'; closeBtn.textContent = 'Close'; closeBtn.addEventListener('click', () => overlay.style.display = 'none');
      header.appendChild(closeBtn);
      const results = document.createElement('div'); results.id = 'search-results'; results.className = 'space-y-3';
      card.appendChild(header); card.appendChild(results); overlay.appendChild(card);
      document.body.appendChild(overlay);
      return { el: overlay, show: () => overlay.style.display = 'flex', hide: () => overlay.style.display = 'none', input: header.querySelector('#search-input-modal'), results };
    }

    window.searchModalFromProfile = createSearchModalFallback();
  }

  // define doSearch on window as fallback
  window.doSearch = async function(q) {
    if (!q) return;
    let modal = window.searchModalFromProfile;
    if (!modal) {
      modal = createSearchModalFallback();
      window.searchModalFromProfile = modal;
    }
    modal.results.innerHTML = `<div class="text-sm text-gray-500">Searching...</div>`;
    modal.show();

    const term = q.toLowerCase();
    const matches = { users: [], posts: [] };
    try {
      if (typeof db !== 'undefined' && db && window.firebase) {
        const [postsSnap, usersSnap] = await Promise.all([
          db.collection('posts').orderBy('createdAt','desc').limit(200).get().catch(() => null),
          db.collection('users').orderBy('createdAt','desc').limit(200).get().catch(() => null)
        ]);
        if (postsSnap) postsSnap.forEach(d => { const p = d.data(); const hay = `${p.title||''} ${p.body||''} ${p.authorFirst||''} ${p.authorLast||''}`.toLowerCase(); if (hay.includes(term)) matches.posts.push({ id: d.id, ...p }); });
        if (usersSnap) usersSnap.forEach(d => { const u = d.data(); const hay = `${u.firstName||''} ${u.lastName||''} ${u.username||''} ${u.schoolName||''}`.toLowerCase(); if (hay.includes(term)) matches.users.push({ id: d.id, ...u }); });
      } else {
        const posts = JSON.parse(localStorage.getItem('campus_posts_v1') || '[]');
        posts.forEach(p => { const hay = `${p.title||''} ${p.body||''} ${p.authorFirst||''} ${p.authorLast||''}`.toLowerCase(); if (hay.includes(term)) matches.posts.push(p); });
      }
    } catch (err) { console.warn('Profile doSearch error', err); }

    const r = modal.results; r.innerHTML = '';
    if (matches.users.length === 0 && matches.posts.length === 0) { r.innerHTML = `<div class="text-sm text-gray-500">No results for "${escapeHtml(q)}"</div>`; return; }
    if (matches.users.length) {
      const h = document.createElement('div'); h.className = 'mb-2'; h.innerHTML = `<h4 class="font-semibold">Users</h4>`; r.appendChild(h);
      matches.users.forEach(u => {
        const el = document.createElement('a'); el.href = '#'; el.className = 'flex items-center gap-3 p-2 rounded hover:bg-gray-50';
        el.innerHTML = `<div class="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">${u.imageUrl?`<img src="${normalizeImageUrl(u.imageUrl)}" class="h-full w-full object-cover">`:'<i class="fas fa-user"></i>'}</div><div><div class="font-medium">${escapeHtml((u.firstName||'')+' '+(u.lastName||''))}</div><div class="text-xs text-gray-500">${escapeHtml(u.schoolName||'')}</div></div>`;
        el.addEventListener('click', (ev) => { ev.preventDefault(); if (typeof openProfile === 'function') openProfile(u.id); modal.hide(); });
        r.appendChild(el);
      });
    }
    if (matches.posts.length) {
      const h = document.createElement('div'); h.className = 'mt-3 mb-2'; h.innerHTML = `<h4 class="font-semibold">Posts</h4>`; r.appendChild(h);
      matches.posts.slice(0,10).forEach(p => {
        const postNode = (typeof renderPost === 'function') ? renderPost({ id: p.id, ...p }) : null;
        if (postNode) {
          postNode.style.cursor = 'pointer';
          postNode.addEventListener('click', (ev) => { if (ev.target.closest('button, a, input, textarea, select')) return; ev.preventDefault(); if (typeof openPostInModal === 'function') openPostInModal(p.id); modal.hide(); });
          r.appendChild(postNode);
        }
      });
    }
  };

  // Wire the global-search input if it exists to the fallback doSearch as well
  if (globalSearchEl) {
    globalSearchEl.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await window.doSearch(globalSearchEl.value.trim());
      }
    });
    const searchForm = globalSearchEl.closest('form');
    if (searchForm) searchForm.addEventListener('submit', async (e) => { e.preventDefault(); await window.doSearch(globalSearchEl.value.trim()); });
  }
})();

//////////////////// END ////////////////////

// NOTE: The script prefers a global `doSearch` (from your site-level script). If that exists
// the profile page will wire the profile/global-search input to that function. If not, a
// lightweight fallback modal/search is created so the profile page remains functional.

// Helpful note for deployment: ensure your site-level search script (the one that creates
// the search modal and defines `doSearch`) is loaded before profile.js so the profile page
// integrates with the central search UI. If you intentionally load profile.js first that's
// fine — the integration will detect and wire up the global search later when available.

  } catch (err) {
    console.error('Failed to load profile posts', err);
    profileActivityPosts.innerHTML = '<div class="text-sm text-gray-500">Failed to load posts.</div>';
  }
}

//////////////////// ImageKit upload helper ////////////////////

/**
 * Upload file to ImageKit via your server.
 * Expects a server endpoint at /imagekit-upload that accepts FormData { file } and
 * returns { url: "https://ik.imagekit.io/..." } on success.
 *
 * Replace '/imagekit-upload' with the path to your own upload endpoint.
 */
async function uploadToImageKitServer(file) {
  if (!file) return null;
  try {
    const fd = new FormData();
    fd.append('file', file);
    // optional: pass desired folder or metadata
    // fd.append('folder', '/users/profiles');

    const resp = await fetch('/imagekit-upload', {
      method: 'POST',
      body: fd
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error('Upload failed: ' + resp.status + ' ' + text);
    }
    const data = await resp.json();
    // Expect { url: 'https://ik.imagekit.io/...' }
    return data.url || null;
  } catch (err) {
    console.error('ImageKit upload error', err);
    throw err;
  }
}

//////////////////// Edit form handlers ////////////////////

if (editBtn) {
  editBtn.addEventListener('click', () => {
    if (!auth.currentUser) {
      showToast('Please sign in to edit your profile', '#dc2626');
      return;
    }
    openEditModal();
  });
}
if (closeEdit) closeEdit.addEventListener('click', closeEditModal);
if (cancelEdit) cancelEdit.addEventListener('click', (e) => { e.preventDefault(); closeEditModal(); });

if (inputImage) {
  inputImage.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) { if (inputImageName) inputImageName.textContent = ''; uploadedImageFile = null; return; }
    if (inputImageName) inputImageName.textContent = `${f.name} (${Math.round(f.size/1024)} KB)`;
    uploadedImageFile = f;
  });
}

if (saveProfileBtn) {
  saveProfileBtn.addEventListener('click', async () => {
    if (!auth.currentUser) { showToast('Not signed in', '#dc2626'); return; }
    saveProfileBtn.disabled = true;
    const origText = saveProfileBtn.textContent;
    saveProfileBtn.textContent = 'Saving...';

    try {
      const uid = auth.currentUser.uid;
      const updates = {
        firstName: inputFirst.value.trim() || null,
        lastName: inputLast.value.trim() || null,
        position: inputPosition.value.trim() || null,
        phone: inputPhone.value.trim() || null,
        schoolName: inputSchool.value.trim() || null,
        yearHeld: inputYear.value.trim() || null,
        association: inputAssoc.value.trim() || null,
        stateName: inputState.value.trim() || null,
        bio: inputBio.value.trim() || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Upload via ImageKit server endpoint if image present
      if (uploadedImageFile) {
        try {
          const imgUrl = await uploadToImageKitServer(uploadedImageFile);
          if (imgUrl) updates.imageUrl = imgUrl;
        } catch (err) {
          console.warn('Image upload failed', err);
          showToast('Image upload failed', '#dc2626');
          // continue without image
        }
      }

      await db.collection('users').doc(uid).set(updates, { merge: true });

      const displayName = [updates.firstName, updates.lastName].filter(Boolean).join(' ') || auth.currentUser.displayName;
      const profileUpdates = {};
      if (displayName) profileUpdates.displayName = displayName;
      if (updates.imageUrl) profileUpdates.photoURL = updates.imageUrl;
      if (Object.keys(profileUpdates).length) {
        await auth.currentUser.updateProfile(profileUpdates);
      }

      const freshDoc = await db.collection('users').doc(uid).get();
      currentUserDoc = freshDoc.exists ? freshDoc.data() : null;
      await populateProfile(auth.currentUser);
      showToast('Profile updated.');
      closeEditModal();
    } catch (err) {
      console.error('Save profile error', err);
      showToast('Failed to save profile', '#dc2626');
    } finally {
      saveProfileBtn.disabled = false;
      saveProfileBtn.textContent = origText;
    }
  });
}

//////////////////// Export: PDF & DOCX ////////////////////

// helper to gather profile data to include in exports
function collectProfilePayload() {
  if (!auth.currentUser) return null;
  return {
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    displayName: auth.currentUser.displayName,
    firstName: currentUserDoc?.firstName || inputFirst?.value || '',
    lastName: currentUserDoc?.lastName || inputLast?.value || '',
    position: currentUserDoc?.position || inputPosition?.value || '',
    phone: currentUserDoc?.phone || inputPhone?.value || '',
    schoolName: currentUserDoc?.schoolName || inputSchool?.value || '',
    yearHeld: currentUserDoc?.yearHeld || inputYear?.value || '',
    association: currentUserDoc?.association || inputAssoc?.value || '',
    stateName: currentUserDoc?.stateName || inputState?.value || '',
    bio: currentUserDoc?.bio || inputBio?.value || '',
    imageUrl: currentUserDoc?.imageUrl || auth.currentUser.photoURL || null,
    exportedAt: new Date().toISOString()
  };
}

//////////////////// PDF export (jsPDF) ////////////////////

async function ensureJsPdf() {
  if (window.jspdf) return window.jspdf;
  // load jsPDF (UMD) from CDN
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => {
      if (window.jspdf) resolve(window.jspdf);
      else if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf);
      else {
        // some builds attach to window.jspdf or window.jspdf.jsPDF
        resolve(window.jspdf || window.jspdf?.jsPDF);
      }
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function exportProfileToPDF() {
  if (!auth.currentUser) { showToast('Sign in to export', '#dc2626'); return; }
  const payload = collectProfilePayload();
  if (!payload) { showToast('No profile data', '#dc2626'); return; }

  try {
    const jspdfLib = await ensureJsPdf();
    const { jsPDF } = jspdfLib;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginLeft = 40;
    let y = 40;

    // Title
    doc.setFontSize(18);
    doc.text(payload.displayName || `${payload.firstName} ${payload.lastName}`, marginLeft, y);
    y += 22;

    doc.setFontSize(11);
    const lines = [
      `Email: ${payload.email || ''}`,
      `Phone: ${payload.phone || ''}`,
      `Position: ${payload.position || ''}`,
      `Association: ${payload.association || ''}`,
      `School: ${payload.schoolName || ''} ${payload.yearHeld ? '(' + payload.yearHeld + ')' : ''}`,
      `State: ${payload.stateName || ''}`,
      ''
    ];

    lines.forEach(line => { doc.text(line, marginLeft, y); y += 16; });

    if (payload.bio) {
      y += 4;
      doc.setFontSize(12);
      doc.text('Bio:', marginLeft, y); y += 14;
      doc.setFontSize(10);
      // split text to fit page width
      const pageWidth = doc.internal.pageSize.getWidth();
      const usableWidth = pageWidth - marginLeft * 2;
      const bioLines = doc.splitTextToSize(payload.bio, usableWidth);
      doc.text(bioLines, marginLeft, y);
      y += bioLines.length * 12 + 8;
    }

    // If image exists, try to embed it (fetch as dataURL, then add to doc)
    if (payload.imageUrl) {
      try {
        const res = await fetch(payload.imageUrl);
        const blob = await res.blob();
        // convert blob to dataURL
        const dataUrl = await new Promise((res2) => {
          const r = new FileReader();
          r.onload = () => res2(r.result);
          r.readAsDataURL(blob);
        });
        // fit image width to 120pt, preserve aspect ratio
        const imgProps = doc.getImageProperties(dataUrl);
        const iw = 120;
        const ih = (imgProps.height / imgProps.width) * iw;
        const pageW = doc.internal.pageSize.getWidth();
        doc.addImage(dataUrl, 'JPEG', pageW - marginLeft - iw, 40, iw, ih);
      } catch (err) {
        console.warn('Failed to add image to PDF', err);
      }
    }

    // Footer timestamp
    doc.setFontSize(9);
    doc.text(`Exported: ${new Date().toLocaleString()}`, marginLeft, doc.internal.pageSize.getHeight() - 30);

    // Save
    const filename = `${(payload.displayName || payload.email || 'profile')}_profile.pdf`.replace(/\s+/g, '_');
    doc.save(filename);
    showToast('PDF exported.');
  } catch (err) {
    console.error('PDF export failed', err);
    showToast('PDF export failed', '#dc2626');
  }
}

//////////////////// DOCX (Word HTML) export ////////////////////

/**
 * Simple approach: create a Word-compatible HTML and download with .docx extension.
 * This is supported by Word (it will detect HTML inside). It's a lightweight cross-browser approach.
 * If you want a strict .docx OpenXML package, I can swap to a library (docx) — requires additional client libs.
 */
function exportProfileToDocx() {
  if (!auth.currentUser) { showToast('Sign in to export', '#dc2626'); return; }
  const payload = collectProfilePayload();
  if (!payload) { showToast('No profile data', '#dc2626'); return; }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(payload.displayName || 'Profile')}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #111827; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 6px; }
          .meta { margin-bottom: 12px; font-size: 13px; color: #374151; }
          .section { margin-bottom: 10px; }
          .label { font-weight: bold; color: #111827; }
          .bio { white-space: pre-wrap; margin-top: 6px; color:#111827; }
          .avatar { float: right; margin-left: 12px; width: 120px; height: 120px; object-fit: cover; border-radius: 6px; }
        </style>
      </head>
      <body>
        ${payload.imageUrl ? `<img src="${payload.imageUrl}" class="avatar" />` : ''}
        <h1>${escapeHtml(payload.displayName || (payload.firstName + ' ' + payload.lastName))}</h1>
        <div class="meta">
          ${payload.position ? `<div><span class="label">Position:</span> ${escapeHtml(payload.position)}</div>` : ''}
          ${payload.schoolName ? `<div><span class="label">School:</span> ${escapeHtml(payload.schoolName)} ${payload.yearHeld ? '('+escapeHtml(payload.yearHeld)+')':''}</div>` : ''}
          ${payload.association ? `<div><span class="label">Association:</span> ${escapeHtml(payload.association)}</div>` : ''}
          ${payload.stateName ? `<div><span class="label">State:</span> ${escapeHtml(payload.stateName)}</div>` : ''}
          ${payload.phone ? `<div><span class="label">Phone:</span> ${escapeHtml(payload.phone)}</div>` : ''}
          ${payload.email ? `<div><span class="label">Email:</span> ${escapeHtml(payload.email)}</div>` : ''}
        </div>
        ${payload.bio ? `<div class="section"><div class="label">Bio</div><div class="bio">${escapeHtml(payload.bio)}</div></div>` : ''}
        <div style="margin-top:24px;font-size:11px;color:#6b7280;">Exported: ${new Date().toLocaleString()}</div>
      </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' }); // using msword mime; file saved as .docx
  const filename = `${(payload.displayName || payload.email || 'profile')}_profile.docx`.replace(/\s+/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Word document exported.');
}

//////////////////// Utils ////////////////////

function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[m]);
}

//////////////////// Sign out, nav handlers ////////////////////

if (signOutBtn) {
  signOutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await auth.signOut();
      showToast('Signed out.');
      window.location.href = '/index.html';
    } catch (err) {
      console.error('Sign out failed', err);
      showToast('Sign out failed', '#dc2626');
    }
  });
}

const userMenuButton = document.getElementById('user-menu-button');
const userMenu = document.getElementById('user-menu');
if (userMenuButton) {
  userMenuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (userMenu) userMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (userMenu && !userMenu.contains(e.target) && !userMenuButton.contains(e.target)) userMenu.classList.add('hidden');
  });
}

const goDashboard = document.getElementById('go-dashboard');
if (goDashboard) goDashboard.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'dashboard.html'; });

const mobileSearchBtn = document.getElementById('mobile-search-btn');
if (mobileSearchBtn) mobileSearchBtn.addEventListener('click', () => { const ms = document.getElementById('mobile-search'); if (ms) ms.classList.toggle('hidden'); });
const mobileSearchClose = document.getElementById('mobile-search-close');
if (mobileSearchClose) mobileSearchClose.addEventListener('click', () => { const ms = document.getElementById('mobile-search'); if (ms) ms.classList.add('hidden'); });

//////////////////// END ////////////////////

// --- Local copy of search helpers (safe-guard: only define if not already present) ---
if (typeof createSearchModal !== 'function') {
  function createSearchModal() {
    const overlay = document.createElement('div');
    overlay.id = 'search-overlay'; overlay.style.position = 'fixed'; overlay.style.left = 0; overlay.style.top = 0; overlay.style.width = '100%'; overlay.style.height = '100%';
    overlay.style.display = 'none'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; overlay.style.zIndex = 9999; overlay.style.backdropFilter = 'blur(4px)'; overlay.style.padding = '20px';
    const card = document.createElement('div'); card.className = 'bg-white rounded-lg shadow-lg w-full max-w-3xl p-4'; card.style.maxHeight = '90vh'; card.style.overflowY = 'auto';
    const header = document.createElement('div'); header.className = 'flex items-center justify-between mb-3';
    header.innerHTML = `<input id="search-input-modal" placeholder="Search users & posts..." class="w-full rounded-md border-gray-200 bg-gray-50 px-3 py-2 text-sm" />`;
    const closeBtn = document.createElement('button'); closeBtn.className = 'ml-3 px-3 py-1 rounded bghover'; closeBtn.textContent = 'Close'; closeBtn.addEventListener('click', () => overlay.style.display = 'none');
    header.appendChild(closeBtn);
    const results = document.createElement('div'); results.id = 'search-results'; results.className = 'space-y-3';
    card.appendChild(header); card.appendChild(results); overlay.appendChild(card);
    document.body.appendChild(overlay);
    return { el: overlay, show: () => overlay.style.display = 'flex', hide: () => overlay.style.display = 'none', input: header.querySelector('#search-input-modal'), results };
  }
}

if (typeof doSearch !== 'function') {
  // Minimal doSearch that mirrors the main site's behavior but scoped to profile page
  async function doSearch(q) {
    if (!q) return;
    // create modal if not present
    let sm = document.getElementById('search-overlay');
    if (!sm || !window.searchModalFromProfile) {
      window.searchModalFromProfile = createSearchModal();
    }
    const modal = window.searchModalFromProfile;
    modal.results.innerHTML = `<div class="text-sm text-gray-500">Searching...</div>`;
    modal.show();
    const term = q.toLowerCase();
    const matches = { users: [], posts: [] };
    try {
      if (typeof db !== 'undefined' && db && window.firebase) {
        const [postsSnap, usersSnap] = await Promise.all([
          db.collection('posts').orderBy('createdAt','desc').limit(200).get(),
          db.collection('users').orderBy('createdAt','desc').limit(200).get()
        ]);
        postsSnap.forEach(d => { const p = d.data(); const hay = `${p.title||''} ${p.body||''} ${p.authorFirst||''} ${p.authorLast||''}`.toLowerCase(); if (hay.includes(term)) matches.posts.push({ id: d.id, ...p }); });
        usersSnap.forEach(d => { const u = d.data(); const hay = `${u.firstName||''} ${u.lastName||''} ${u.username||''} ${u.schoolName||''}`.toLowerCase(); if (hay.includes(term)) matches.users.push({ id: d.id, ...u }); });
      } else {
        const posts = JSON.parse(localStorage.getItem('campus_posts_v1') || '[]');
        posts.forEach(p => { const hay = `${p.title||''} ${p.body||''} ${p.authorFirst||''} ${p.authorLast||''}`.toLowerCase(); if (hay.includes(term)) matches.posts.push(p); });
      }
    } catch (err) { console.warn('Profile doSearch error', err); }

    const r = modal.results; r.innerHTML = '';
    if (matches.users.length === 0 && matches.posts.length === 0) { r.innerHTML = `<div class="text-sm text-gray-500">No results for "${escapeHtml(q)}"</div>`; return; }
    if (matches.users.length) {
      const h = document.createElement('div'); h.className = 'mb-2'; h.innerHTML = `<h4 class="font-semibold">Users</h4>`; r.appendChild(h);
      matches.users.forEach(u => {
        const el = document.createElement('a'); el.href = '#'; el.className = 'flex items-center gap-3 p-2 rounded hover:bg-gray-50';
        el.innerHTML = `<div class="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">${u.imageUrl?`<img src="${normalizeImageUrl(u.imageUrl)}" class="h-full w-full object-cover">`:'<i class="fas fa-user"></i>'}</div><div><div class="font-medium">${escapeHtml((u.firstName||'')+' '+(u.lastName||''))}</div><div class="text-xs text-gray-500">${escapeHtml(u.schoolName||'')}</div></div>`;
        el.addEventListener('click', (ev) => { ev.preventDefault(); if (typeof openProfile === 'function') openProfile(u.id); modal.hide(); });
        r.appendChild(el);
      });
    }
    if (matches.posts.length) {
      const h = document.createElement('div'); h.className = 'mt-3 mb-2'; h.innerHTML = `<h4 class="font-semibold">Posts</h4>`; r.appendChild(h);
      matches.posts.slice(0,10).forEach(p => {
        const postNode = (typeof renderPost === 'function') ? renderPost({ id: p.id, ...p }) : null;
        if (postNode) {
          postNode.style.cursor = 'pointer';
          postNode.addEventListener('click', (ev) => { if (ev.target.closest('button, a, input, textarea, select')) return; ev.preventDefault(); if (typeof openPostInModal === 'function') openPostInModal(p.id); modal.hide(); });
          r.appendChild(postNode);
        }
      });
    }
  }
}
