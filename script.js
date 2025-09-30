// script.js (updated — replace your current script.js with this file)
// Requires: Firebase compat SDKs already included in the page (you have them).
// Assumes Firestore collections: posts, users, payments (optional).

/* ========== CONFIG ========== */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDC3L5vruhYXfarn5O81cLld50oagYkmxE",
  authDomain: "campus-leaders.firebaseapp.com",
  projectId: "campus-leaders",
  storageBucket: "campus-leaders.firebasestorage.app",
  messagingSenderId: "445360528951",
  appId: "1:445360528951:web:712da8859c8ac4cb6129b2"
};
const IMGUR_CLIENT_ID = "8b398f14462ad09"; // optional
const POSTS_COLLECTION = "posts";
const POSTS_PAGE_LIMIT = 50;
/* ============================ */

let USE_FIREBASE = false;
let auth = null, db = null;
(function initFirebase() {
  try {
    if (window.firebase && FIREBASE_CONFIG && FIREBASE_CONFIG.projectId) {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      USE_FIREBASE = true;
      console.log("Firebase initialized in dashboard.");
    } else {
      console.warn("Firebase SDK or config missing — running limited demo mode.");
    }
  } catch (err) {
    console.error("Firebase init error:", err);
  }
})();
// ---------- Firestore robustness + diagnostics (drop-in) ----------
try {
  if (db && db.settings) {
    // Force long-polling (works around proxies/adblock that block WebChannel transport)
    try { db.settings({ experimentalForceLongPolling: true }); console.log('Firestore: force long polling enabled'); }
    catch (e) { console.warn('Could not set Firestore longPolling setting:', e); }
  }
} catch(e) { console.warn('Firestore settings block skipped', e); }

// Basic diagnostic helper you can call from console:
// CampusLeaders.diagnose() -> prints quick connectivity checks
window.CampusLeaders = window.CampusLeaders || {};
window.CampusLeaders.diagnose = async function diagnose() {
  console.log('Diagnosing connectivity: navigator.onLine=', navigator.onLine);
  // minimal fetch test to Imgur (CORS may block full info but will show network failures)
  try {
    const t0 = performance.now();
    await fetch('https://i.imgur.com/2AqQh0L.jpg', { method: 'HEAD', mode: 'no-cors' });
    console.log('Imgur HEAD (opaque/no-cors) attempted — no CORS error means network OK; time:', Math.round(performance.now()-t0), 'ms');
  } catch (e) { console.warn('Imgur HEAD failed (network/CORS):', e); }
  // Firestore raw endpoint reachability test (may be blocked by CORS in browser) — useful to detect network-level blocks
  try {
    const url = 'https://firestore.googleapis.com/v1/projects/' + (FIREBASE_CONFIG.projectId || ''); 
    await fetch(url, { method: 'GET', mode: 'no-cors' });
    console.log('FIRESTORE REST HEAD attempted (no-cors) — if this fails the network likely blocks googleapis.');
  } catch (e) { console.warn('Firestore ping failed:', e); }
};

// If realtime onSnapshot fails, we will fallback to a polling GET. Helper to attach robust listener:
function attachRobustPostsListener(containerEl, opts = {}) {
  if (!db) return;
  const path = (opts.collection || 'posts');
  // Try realtime first
  try {
    const q = db.collection(path).orderBy('createdAt','desc').limit(opts.limit || 50);
    const unsubscribe = q.onSnapshot(snapshot => {
      // normal realtime callback
      containerEl.innerHTML = '';
      snapshot.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        const node = renderPost(data); // your existing renderPost
        containerEl.appendChild(node);
        // populate author image asynchronously if you use user docs:
        if (data.authorId) populateAuthorInPostElement && populateAuthorInPostElement(node, data);
      });
    }, (err) => {
      console.warn('Realtime onSnapshot error (will fallback to polling/get):', err);
      showOfflineBanner && showOfflineBanner();
      // fallback to one-time fetch then enable polling
      fallbackGetAndPoll();
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Failed to attach onSnapshot; using fallback get+poll', e);
    fallbackGetAndPoll();
  }

  // fallback implementation
  let pollTimer = null;
  async function fallbackGetAndPoll() {
    try {
      const snap = await db.collection(path).orderBy('createdAt','desc').limit(opts.limit || 50).get();
      containerEl.innerHTML = '';
      snap.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        const node = renderPost(data);
        containerEl.appendChild(node);
        if (data.authorId) populateAuthorInPostElement && populateAuthorInPostElement(node, data);
      });
      // periodic polling every 10s (adjust as needed)
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        try {
          const s2 = await db.collection(path).orderBy('createdAt','desc').limit(opts.limit || 50).get();
          containerEl.innerHTML = '';
          s2.forEach(doc => {
            const d = { id: doc.id, ...doc.data() };
            const n = renderPost(d);
            containerEl.appendChild(n);
            if (d.authorId) populateAuthorInPostElement && populateAuthorInPostElement(n, d);
          });
        } catch (err) {
          console.warn('Polling GET failed:', err);
        }
      }, opts.pollInterval || 10000);
    } catch (err) {
      console.error('Fallback GET failed (likely network/proxy issue):', err);
      // show offline warning
      showOfflineBanner && showOfflineBanner();
    }
  }
}

// small offline banner used above
function showOfflineBanner() {
  if (document.getElementById('firestore-offline-banner')) return;
  const el = document.createElement('div');
  el.id = 'firestore-offline-banner';
  el.textContent = 'You appear offline or Firestore is blocked — showing cached/fallback content.';
  Object.assign(el.style, { position:'fixed', right:'20px', top:'80px', zIndex:99999, padding:'8px 12px', background:'#f59e0b', color:'#fff', borderRadius:'8px' });
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 6000);
}
window.addEventListener('offline', showOfflineBanner);

// Image robust loader helper: normalize Imgur links and auto-retry if an image fails to load.
function makeImgElement(src, cls = '') {
  const img = document.createElement('img');
  img.className = cls;
  img.loading = 'lazy';
  let finalSrc = normalizeImgurUrl ? normalizeImgurUrl(src) : src;
  img.src = finalSrc;
  // onerror fallback: try alternate extension (.jpg/.png) or fallback placeholder
  img.onerror = function() {
    console.warn('Image failed to load:', finalSrc);
    // try swapping extension if it looks like imgur id without ext
    const m = finalSrc.match(/i\.imgur\.com\/([A-Za-z0-9]+)(\.[a-z]+)?$/i);
    if (m && m[1] && !m[2]) {
      this.src = `https://i.imgur.com/${m[1]}.jpg`;
      return;
    }
    // final fallback: small transparent dataURI or placeholder
    this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="100%" height="100%" fill="%23e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="16">No image</text></svg>';
  };
  return img;
}

// small normalizeImgurUrl helper (re-usable)
function normalizeImgurUrl(url) {
  if (!url) return url;
  const u = url.trim();
  if (/^https?:\/\/i\.imgur\.com\//i.test(u)) return u;
  // convert imgur page or gallery id to direct i.imgur link (jpg)
  const m = u.match(/imgur\.com\/(?:a\/|gallery\/)?([A-Za-z0-9]+)/i);
  if (m && m[1]) return `https://i.imgur.com/${m[1]}.jpg`;
  return u;
}

// Example usage: replace your existing attach call with:
const feedEl = document.getElementById('posts-feed') || document.querySelector('#posts-feed');
if (feedEl) {
  // detach any previous listeners if needed, then attach robust listener:
  attachRobustPostsListener(feedEl, { collection: 'posts', limit: 50, pollInterval: 10000 });
}

// Also ensure your auth sign-in uses Firebase SDK (replace server POST login):
// Example to sign in with Firebase email/password:
async function signInWithEmail(email, password) {
  try { await firebase.auth().signInWithEmailAndPassword(email, password); console.log('Signed in'); }
  catch (err) { console.error('Firebase sign-in failed', err); throw err; }
}

// ---------- Dashboard: populate profile + post author avatars ----------
// Assumes firebase compat has been initialized and `auth`, `db` exist.

const userCache = new Map(); // uid -> userDoc

// small UI helpers (tweak selectors if you changed markup)
function setSidebarProfile(userDoc, firebaseUser) {
  // name element in your sidebar: <h3 class="font-bold">John Obi</h3>
  const nameEl = document.querySelector('.card .font-bold');
  if (nameEl) {
    const fn = userDoc?.firstName || (firebaseUser?.displayName || '').split(' ')[0] || '';
    const ln = userDoc?.lastName  || (firebaseUser?.displayName || '').split(' ').slice(1).join(' ') || '';
    nameEl.textContent = `${fn} ${ln}`.trim() || 'Member';
  }

  // position text (the small p under name): .card p.text-sm.text-gray-500.mb-4
  const posEl = document.querySelector('.card p.text-sm.text-gray-500.mb-4');
  if (posEl) posEl.textContent = userDoc?.position || userDoc?.association || '';

  // bottom text line (school/year). There is a span with text-gray-500; use more specific guard:
  const schoolSpan = document.querySelector('.card .w-full .text-gray-500');
  if (schoolSpan) {
    const school = userDoc?.schoolName || firebaseUser?.schoolName || '';
    const year = userDoc?.yearHeld || '';
    schoolSpan.textContent = [school, year].filter(Boolean).join(' ').trim();
  }

  // avatar div: find the element and insert <img>
  const avatarContainer = document.querySelector('.card .h-20.w-20.rounded-full');
  if (avatarContainer) {
    const src = (firebaseUser && firebaseUser.photoURL) || userDoc?.imageUrl || null;
    if (src) {
      // replace contents with <img> to preserve layout
      avatarContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = normalizeImgurUrl(src);
      img.alt = (nameEl?.textContent || 'avatar');
      img.className = 'h-20 w-20 rounded-full object-cover';
      img.loading = 'lazy';
      // to be safe if browser blocks crossOrigin we don't set crossorigin unless needed
      avatarContainer.appendChild(img);
    }
  }
}

// normalize Imgur-ish links a little: if someone saved a page URL (imgur.com/abc) try i.imgur.com/abc.jpg
function normalizeImgurUrl(url) {
  try {
    if (!url) return url;
    const u = url.trim();
    if (/^https?:\/\/i\.imgur\.com\//i.test(u)) return u; // already direct
    // if it's an imgur page (not i.imgur) and no extension, convert to i.imgur + .jpg
    if (/imgur\.com\/(a\/|gallery\/)?([A-Za-z0-9]+)/i.test(u) && !/\.(jpe?g|png|gif|gifv|webp|mp4)$/i.test(u)) {
      const m = u.match(/imgur\.com\/(?:a\/|gallery\/)?([A-Za-z0-9]+)/i);
      if (m && m[1]) {
        return `https://i.imgur.com/${m[1]}.jpg`;
      }
    }
    // otherwise return as-is (hopefully direct link)
    return u;
  } catch (e) { return url; }
}

// fetch Firestore user doc cached
async function fetchUserDoc(uid) {
  if (!uid) return null;
  if (userCache.has(uid)) return userCache.get(uid);
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) { userCache.set(uid, null); return null; }
    const data = snap.data();
    userCache.set(uid, data);
    return data;
  } catch (e) {
    console.warn('fetchUserDoc error', e);
    return null;
  }
}

// hook auth state to populate sidebar
if (firebase && firebase.auth) {
  firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
      // not logged in: optionally clear UI
      return;
    }
    // prefer Firestore user doc (contains fields you saved)
    let udoc = null;
    try { udoc = (await db.collection('users').doc(user.uid).get()).data(); } catch(e){ console.warn('read user doc failed', e); }
    setSidebarProfile(udoc, user);
  });
}

// --- patch to render posts with author avatar + name ---
// Find renderPost() in your script and replace the header-building part with this helper usage.
// If you cannot find it, insert this function and call it after you append a post DOM node.

async function populateAuthorInPostElement(wrapperEl, post) {
  // wrapperEl is the container returned by renderPost, `post` has post.authorId or post.authorName
  const leftBlock = wrapperEl.querySelector('.flex.items-center.space-x-3');
  if (!leftBlock) return;
  // If authorId provided, fetch user
  if (post.authorId) {
    const udoc = await fetchUserDoc(post.authorId);
    const authorName = (udoc && ((udoc.firstName||'') + ' ' + (udoc.lastName||''))) || post.authorName || 'Anonymous';
    const photo = (udoc && udoc.imageUrl) || (udoc && udoc.photoURL) || null;
    // replace avatar area (first child) with image
    const avatarDiv = leftBlock.querySelector('div') || null;
    if (avatarDiv) {
      avatarDiv.innerHTML = '';
      const img = document.createElement('img');
      img.className = 'h-10 w-10 rounded-full object-cover';
      img.alt = authorName;
      img.loading = 'lazy';
      if (photo) img.src = normalizeImgurUrl(photo);
      else img.src = ''; // keep blank — could use placeholder
      avatarDiv.appendChild(img);
    }
    // name and time area
    const nameEl = leftBlock.querySelector('div > h4') || leftBlock.querySelector('h4');
    if (nameEl) nameEl.textContent = authorName;
  } else {
    // no author id: keep existing authorName text but ensure avatar placeholder
    const avatarDiv = leftBlock.querySelector('div') || null;
    if (avatarDiv && avatarDiv.innerHTML.trim() === '') {
      avatarDiv.innerHTML = '<div class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center"><i class="fas fa-user"></i></div>';
    }
  }
}

// modify your post rendering flow: after you append a post node call populateAuthorInPostElement(node, post);
// Example: const node = renderPost(post); container.appendChild(node); populateAuthorInPostElement(node, post);

// ---------- handle Firestore transport errors: offline fallback ----------
function showOfflineBanner() {
  // simple transient message; add more UI if you like
  const id = 'firestore-offline-banner';
  if (document.getElementById(id)) return;
  const el = document.createElement('div');
  el.id = id;
  el.textContent = 'You appear offline or Firestore is blocked — showing cached content.';
  el.style.position = 'fixed';
  el.style.top = '72px';
  el.style.right = '20px';
  el.style.zIndex = '9999';
  el.style.padding = '8px 12px';
  el.style.background = '#f59e0b';
  el.style.color = '#fff';
  el.style.borderRadius = '8px';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 6000);
}

window.addEventListener('online', () => {
  // re-enable firestore network
  if (db && db.enableNetwork) {
    db.enableNetwork().catch(e => console.warn('enableNetwork failed', e));
  }
});
window.addEventListener('offline', () => {
  showOfflineBanner();
});

// Wrap your realtime listener creation with a try/catch and fall back to one-shot .get() if Listen fails.
// Example:
// try { db.collection('posts').orderBy('createdAt','desc').onSnapshot(...); }
// catch(e) { console.warn('onSnapshot failed, falling back', e); db.collection('posts').orderBy('createdAt','desc').get()... }



/* ---------------- DOM anchors (keep UI unchanged) ---------------- */
const startPostBtn = document.querySelector("button.flex-1.text-left.px-4.py-2.bg-gray-100.rounded-full");
const createPostCard = startPostBtn ? startPostBtn.closest(".card") : null;
function findFeedInsertionNode() {
  if (!createPostCard) return document.querySelector("main") || document.body;
  return createPostCard.parentNode;
}

/* ---------------- composer modal (unchanged behaviour) ---------------- */
function createComposerModal() {
  const overlay = document.createElement("div");
  overlay.id = "composer-overlay";
  overlay.style.position = "fixed";
  overlay.style.left = 0; overlay.style.top = 0;
  overlay.style.width = "100%"; overlay.style.height = "100%";
  overlay.style.display = "none"; overlay.style.alignItems = "center"; overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999; overlay.style.backdropFilter = "blur(4px)"; overlay.style.padding = "20px";

  const card = document.createElement("div");
  card.className = "bg-white rounded-lg shadow-lg w-full max-w-2xl p-4";
  card.style.maxHeight = "90vh"; card.style.overflowY = "auto";

  const header = document.createElement("div");
  header.className = "flex justify-between items-center mb-3";
  header.innerHTML = `<h3 class="font-bold">Create a post</h3>`;
  const closeBtn = document.createElement("button");
  closeBtn.className = "px-3 py-1 rounded bghover"; closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", hide);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="mb-3">
      <input id="composer-title" type="text" placeholder="Post title (optional)" class="w-full rounded-md border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
    </div>
    <div class="mb-3">
      <textarea id="composer-body" rows="6" placeholder="Write something to your community..." class="w-full rounded-md border-gray-200 bg-gray-50 px-3 py-2 text-sm"></textarea>
    </div>
    <div class="mb-3 flex items-center gap-3">
      <input id="composer-image" type="file" accept="image/*" class="text-sm" />
      <div id="composer-image-name" class="text-xs text-gray-500"></div>
    </div>
    <div class="flex justify-end gap-2">
      <button id="composer-submit" class="px-4 py-2 rounded-md bg-two text-white">Post</button>
    </div>
  `;

  card.appendChild(header); card.appendChild(body); overlay.appendChild(card);
  function show() { overlay.style.display = "flex"; }
  function hide() { overlay.style.display = "none"; }
  return { el: overlay, show, hide };
}
const composer = createComposerModal();
document.body.appendChild(composer.el);
const composerImageInput = composer.el.querySelector("#composer-image");
const composerImageName = composer.el.querySelector("#composer-image-name");
composerImageInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  composerImageName.textContent = f ? `${f.name} (${Math.round(f.size/1024)} KB)` : "";
});
if (startPostBtn) startPostBtn.addEventListener("click", () => { composer.show(); composer.el.querySelector("#composer-body").focus(); });

/* ---------------- search modal (new) ---------------- */
function createSearchModal() {
  const overlay = document.createElement("div");
  overlay.id = "search-overlay";
  overlay.style.position = "fixed"; overlay.style.left = 0; overlay.style.top = 0; overlay.style.width = "100%"; overlay.style.height = "100%";
  overlay.style.display = "none"; overlay.style.alignItems = "center"; overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999; overlay.style.backdropFilter = "blur(4px)"; overlay.style.padding = "20px";
  const card = document.createElement("div");
  card.className = "bg-white rounded-lg shadow-lg w-full max-w-3xl p-4";
  card.style.maxHeight = "90vh"; card.style.overflowY = "auto";
  const header = document.createElement("div"); header.className = "flex items-center justify-between mb-3";
  header.innerHTML = `<input id="search-input-modal" placeholder="Search users & posts..." class="w-full rounded-md border-gray-200 bg-gray-50 px-3 py-2 text-sm" />`;
  const closeBtn = document.createElement("button"); closeBtn.className = "ml-3 px-3 py-1 rounded bghover"; closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => overlay.style.display = "none");
  header.appendChild(closeBtn);
  const results = document.createElement("div"); results.id = "search-results"; results.className = "space-y-3";
  card.appendChild(header); card.appendChild(results); overlay.appendChild(card);
  return { el: overlay, show: () => overlay.style.display = "flex", hide: () => overlay.style.display = "none", input: header.querySelector("#search-input-modal"), results };
}
const searchModal = createSearchModal();
document.body.appendChild(searchModal.el);
const globalSearch = document.getElementById("global-search");
if (globalSearch) {
  globalSearch.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await doSearch(globalSearch.value.trim());
    }
  });
  // if user clicks magnifier, show modal
  const searchForm = globalSearch.closest("form");
  if (searchForm) {
    searchForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await doSearch(globalSearch.value.trim());
    });
  }
}
document.getElementById("mobile-search-btn")?.addEventListener("click", () => {
  const mobileSearch = document.getElementById("mobile-search");
  if (mobileSearch) mobileSearch.classList.toggle("hidden");
});

/* --------------- user menu toggle + signout --------------- */
const userMenuButton = document.getElementById("user-menu-button");
const userMenu = document.getElementById("user-menu");
if (userMenuButton && userMenu) {
  userMenuButton.addEventListener("click", (e) => {
    e.stopPropagation();
    userMenu.classList.toggle("hidden");
  });
  // close on outside click
  document.addEventListener("click", (e) => {
    if (!userMenu.contains(e.target) && !userMenuButton.contains(e.target)) {
      userMenu.classList.add("hidden");
    }
  });
  // Sign out
  userMenu.querySelectorAll("a").forEach(a => {
    if (a.textContent.toLowerCase().includes("sign out") || a.textContent.toLowerCase().includes("signout")) {
      a.addEventListener("click", async (ev) => {
        ev.preventDefault();
        if (USE_FIREBASE && auth) {
          await auth.signOut();
          // simple redirect or reload
          window.location.reload();
        } else {
          // clear tokens/local session if any
          localStorage.removeItem("auth_token");
          window.location.reload();
        }
      });
    }
  });
}

/* ---------------- posts container insertion ---------------- */
const insertionNode = findFeedInsertionNode();
const postsContainer = document.createElement("div");
postsContainer.id = "posts-feed";
postsContainer.className = "lg:col-span-2 space-y-6";
(function insertFeed() {
  if (!insertionNode) return;
  if (createPostCard && createPostCard.parentNode) createPostCard.parentNode.insertBefore(postsContainer, createPostCard.nextSibling);
  else insertionNode.appendChild(postsContainer);
})();

/* --------------- helper: upload to Imgur (optional) --------------- */
async function uploadToImgur(file) {
  if (!IMGUR_CLIENT_ID) throw new Error("Imgur client id not set");
  const form = new FormData(); form.append("image", file);
  const resp = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
    body: form
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.data?.error || "Imgur upload failed");
  return data.data.link;
}

/* ---------------- render post with avatar, counts, like/comment/share interactions ---------------- */
function renderPost(postDoc) {
  const post = { id: postDoc.id || postDoc.id, ...postDoc };
  const created = post.createdAt && post.createdAt.toDate ? post.createdAt.toDate() : (post.createdAt ? new Date(post.createdAt) : new Date());
  const timeAgo = timeSince(created);

  const wrapper = document.createElement("div");
  wrapper.className = "card bg-white p-6 border border-gray-200 mb-4";
  wrapper.dataset.postId = post.id;

  // header with avatar + name
  const header = document.createElement("div"); header.className = "flex items-center justify-between mb-4";
  const left = document.createElement("div"); left.className = "flex items-center space-x-3";

  // avatar (author)
  const avatarWrap = document.createElement("div");
  const avatarUrl = post.authorImageUrl || post.author?.imageUrl || null;
  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = post.authorName || "avatar";
    img.className = "h-10 w-10 rounded-full object-cover";
    avatarWrap.appendChild(img);
  } else {
    avatarWrap.innerHTML = `<div class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center"><i class="fas fa-user"></i></div>`;
  }
  left.appendChild(avatarWrap);

  const meta = document.createElement("div");
  const fullName = post.authorFirst && post.authorLast ? `${post.authorFirst} ${post.authorLast}` : (post.authorName || "Anonymous");
  meta.innerHTML = `<h4 class="font-bold">${escapeHtml(fullName)}</h4><p class="text-xs text-gray-500">${escapeHtml(timeAgo)}</p>`;
  left.appendChild(meta);

  header.appendChild(left);

  const more = document.createElement("button"); more.className = "text-gray-400 hover"; more.innerHTML = `<i class="fas fa-ellipsis-h"></i>`;
  header.appendChild(more);
  wrapper.appendChild(header);

  // image
  if (post.imageUrl) {
    const imgWrap = document.createElement("div"); imgWrap.className = "mb-4";
    const img = document.createElement("img");
    img.src = post.imageUrl; img.alt = post.title || "post image"; img.loading = "lazy";
    img.className = "w-full h-48 sm:h-60 md:h-72 object-cover rounded-lg border border-gray-100";
    imgWrap.appendChild(img); wrapper.appendChild(imgWrap);
  }

  // title & body
  if (post.title) {
    const t = document.createElement("h3"); t.className = "text-lg font-semibold mb-2"; t.textContent = post.title;
    wrapper.appendChild(t);
  }
  const p = document.createElement("p"); p.className = "mb-3 text-sm text-gray-800"; p.textContent = post.body || "";
  wrapper.appendChild(p);

  // counts default
  const likes = post.likeCount || 0;
  const comments = post.commentCount || 0;
  const shares = post.shareCount || 0;

  // actions area
  const actions = document.createElement("div"); actions.className = "flex justify-between text-sm text-gray-500 border-t border-b border-gray-200 py-2 mb-4";
  // like button:
  const likeBtn = document.createElement("button");
  likeBtn.className = "flex items-center hover like-btn";
  likeBtn.innerHTML = `<i class="far fa-thumbs-up mr-1"></i> <span class="like-label">Like</span> <span class="like-count ml-2">${likes}</span>`;
  actions.appendChild(likeBtn);

  // comment button
  const commentBtn = document.createElement("button");
  commentBtn.className = "flex items-center hover comment-btn";
  commentBtn.innerHTML = `<i class="far fa-comment mr-1"></i> Comment <span class="comment-count ml-2">${comments}</span>`;
  actions.appendChild(commentBtn);

  // share button
  const shareBtn = document.createElement("button");
  shareBtn.className = "flex items-center hover share-btn";
  shareBtn.innerHTML = `<i class="fas fa-share mr-1"></i> Share <span class="share-count ml-2">${shares}</span>`;
  actions.appendChild(shareBtn);

  wrapper.appendChild(actions);

  // comment input area initially hidden (will open on comment click)
  const commentArea = document.createElement("div"); commentArea.className = "comment-area hidden";
  commentArea.innerHTML = `
    <div class="flex items-center space-x-3 mb-2">
      <div class="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center"><i class="fas fa-user text-xs"></i></div>
      <input type="text" class="comment-input w-full rounded-full px-4 py-2 text-sm border-gray-200 bg-gray-50" placeholder="Write a comment..." />
    </div>
    <div class="comment-list space-y-2"></div>
  `;
  wrapper.appendChild(commentArea);

  // Wire actions:
  likeBtn.addEventListener("click", async () => {
    if (!USE_FIREBASE || !auth || !auth.currentUser) {
      alert("Please sign in to like posts.");
      return;
    }
    const uid = auth.currentUser.uid;
    const likeDocRef = db.collection(POSTS_COLLECTION).doc(post.id).collection("likes").doc(uid);
    const postRef = db.collection(POSTS_COLLECTION).doc(post.id);
    try {
      const doc = await likeDocRef.get();
      if (doc.exists) {
        // unlike
        await likeDocRef.delete();
        await postRef.update({ likeCount: firebase.firestore.FieldValue.increment(-1) });
      } else {
        // like
        await likeDocRef.set({ uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        await postRef.update({ likeCount: firebase.firestore.FieldValue.increment(1) });
      }
    } catch (err) {
      console.error("Like error:", err);
    }
  });

  commentBtn.addEventListener("click", async () => {
    // toggle comment area
    commentArea.classList.toggle("hidden");
    if (!commentArea.classList.contains("hidden")) {
      // load comments
      await loadCommentsInto(post.id, commentArea.querySelector(".comment-list"));
      const input = commentArea.querySelector(".comment-input");
      input.focus();
      input.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          const text = input.value.trim();
          if (!text) return;
          if (!USE_FIREBASE || !auth || !auth.currentUser) { alert("Please sign in to comment."); return; }
          try {
            const postRef = db.collection(POSTS_COLLECTION).doc(post.id);
            const commentRef = postRef.collection("comments").doc();
            await commentRef.set({
              uid: auth.currentUser.uid,
              text,
              authorName: auth.currentUser.displayName || auth.currentUser.email || null,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await postRef.update({ commentCount: firebase.firestore.FieldValue.increment(1) });
            input.value = "";
            await loadCommentsInto(post.id, commentArea.querySelector(".comment-list"));
            // update counts in UI quickly
            const cc = wrapper.querySelector(".comment-count");
            if (cc) cc.textContent = (parseInt(cc.textContent || "0", 10) + 1).toString();
          } catch (err) {
            console.error("Comment save error:", err);
            alert("Failed to save comment.");
          }
        }
      }, { once: false });
    }
  });

  shareBtn.addEventListener("click", async () => {
    // attempt native share
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title || "Post", text: post.body || "", url: window.location.href + `#post-${post.id}` });
      } else {
        // fallback: copy link
        const link = window.location.href + `#post-${post.id}`;
        await navigator.clipboard.writeText(link);
        alert("Link copied to clipboard.");
      }
      // increment shareCount
      if (USE_FIREBASE && db) {
        await db.collection(POSTS_COLLECTION).doc(post.id).update({ shareCount: firebase.firestore.FieldValue.increment(1) });
        const sc = wrapper.querySelector(".share-count");
        if (sc) sc.textContent = (parseInt(sc.textContent || "0", 10) + 1).toString();
      }
    } catch (err) {
      console.warn("Share failed:", err);
    }
  });

  // Real-time update for counts & whether current user liked (optional)
  if (USE_FIREBASE && db) {
    // Listen to post doc changes to update counts
    const unsub = db.collection(POSTS_COLLECTION).doc(post.id).onSnapshot(doc => {
      const data = doc.data();
      if (!data) return;
      wrapper.querySelector(".like-count").textContent = data.likeCount || 0;
      wrapper.querySelector(".comment-count").textContent = data.commentCount || 0;
      wrapper.querySelector(".share-count").textContent = data.shareCount || 0;
    });
    // mark liked state for current user
    const markLikeState = async () => {
      if (!auth || !auth.currentUser) {
        likeBtn.classList.remove("text-blue-600");
        likeBtn.querySelector(".like-label").textContent = "Like";
        return;
      }
      try {
        const doc = await db.collection(POSTS_COLLECTION).doc(post.id).collection("likes").doc(auth.currentUser.uid).get();
        if (doc.exists) {
          likeBtn.classList.add("text-blue-600");
          likeBtn.querySelector(".like-label").textContent = "Liked";
        } else {
          likeBtn.classList.remove("text-blue-600");
          likeBtn.querySelector(".like-label").textContent = "Like";
        }
      } catch (err) {
        console.warn("Failed to determine like state:", err);
      }
    };
    // run initially and on auth change
    markLikeState();
    auth && auth.onAuthStateChanged(() => markLikeState());
    // cleanup could be added if we detach posts
  }

  return wrapper;
}

/* ------------ load comments into container -------------- */
async function loadCommentsInto(postId, container) {
  container.innerHTML = "";
  if (!USE_FIREBASE || !db) {
    const arr = JSON.parse(localStorage.getItem("campus_comments_" + postId) || "[]");
    arr.forEach(c => {
      const el = document.createElement("div");
      el.className = "text-sm bg-gray-50 p-2 rounded";
      el.innerHTML = `<strong>${escapeHtml(c.authorName || "User")}</strong> <div>${escapeHtml(c.text)}</div>`;
      container.appendChild(el);
    });
    return;
  }
  const q = await db.collection(POSTS_COLLECTION).doc(postId).collection("comments").orderBy("createdAt", "asc").limit(100).get();
  q.forEach(doc => {
    const d = doc.data();
    const el = document.createElement("div");
    el.className = "text-sm bg-gray-50 p-2 rounded";
    el.innerHTML = `<strong>${escapeHtml(d.authorName || "User")}</strong> <div>${escapeHtml(d.text)}</div>`;
    container.appendChild(el);
  });
}

/* ---------------- render feed (realtime listener) ---------------- */
async function loadPostsRealtime() {
  postsContainer.innerHTML = "";
  if (!USE_FIREBASE || !db) {
    // local demo posts fallback
    const arr = JSON.parse(localStorage.getItem("campus_posts_v1") || "[]");
    arr.reverse().forEach(p => postsContainer.appendChild(renderPost(p)));
    return;
  }
  try {
    db.collection(POSTS_COLLECTION).orderBy("createdAt", "desc").limit(POSTS_PAGE_LIMIT)
      .onSnapshot(snapshot => {
        postsContainer.innerHTML = "";
        snapshot.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          postsContainer.appendChild(renderPost(data));
        });
      });
  } catch (err) {
    console.error("Realtime feed error:", err);
  }
}
loadPostsRealtime();

/* ------------- composer submit (create post) -------------- */
const composerSubmitBtn = composer.el.querySelector("#composer-submit");
composerSubmitBtn.addEventListener("click", async (ev) => {
  ev.preventDefault();
  const title = composer.el.querySelector("#composer-title").value.trim();
  const body = composer.el.querySelector("#composer-body").value.trim();
  const file = composer.el.querySelector("#composer-image").files[0];
  if (!body && !file && !title) { alert("Write something or attach an image before posting."); return; }

  // determine author info
  let authorFirst = null, authorLast = null, authorImageUrl = null, authorId = null, authorState = null, authorAssociation = null, authorYear = null;
  if (USE_FIREBASE && auth && auth.currentUser) {
    authorId = auth.currentUser.uid;
    // try to pull user doc
    try {
      const udoc = await db.collection("users").doc(authorId).get();
      if (udoc.exists) {
        const ud = udoc.data();
        authorFirst = ud.firstName || ud.first || null;
        authorLast = ud.lastName || ud.last || null;
        authorImageUrl = ud.imageUrl || ud.photoURL || null;
        authorState = ud.stateName || ud.state || null;
        authorAssociation = ud.association || null;
        authorYear = ud.yearHeld || ud.year || null;
      } else {
        // fallback to auth profile fields
        authorFirst = auth.currentUser.displayName || auth.currentUser.email;
      }
    } catch (err) {
      console.warn("Failed to read user document:", err);
    }
  } else {
    // no firebase — read profile card present name
    const nameEl = document.querySelector(".card .font-bold");
    if (nameEl) {
      const parts = nameEl.textContent.trim().split(" ");
      authorFirst = parts[0]; authorLast = parts.slice(1).join(" ");
    } else {
      authorFirst = "Guest";
    }
  }

  showSmallOverlay("Posting...");

  // upload image if present
  let imageUrl = null;
  if (file) {
    try {
      if (IMGUR_CLIENT_ID) imageUrl = await uploadToImgur(file);
      else console.warn("Imgur not configured; skipping image upload.");
    } catch (err) {
      console.warn("Image upload failed:", err);
    }
  }

  const newPost = {
    title: title || null,
    body: body || null,
    imageUrl: imageUrl || null,
    authorId: authorId || null,
    authorFirst: authorFirst || null,
    authorLast: authorLast || null,
    authorImageUrl: authorImageUrl || null,
    authorState: authorState || null,
    authorAssociation: authorAssociation || null,
    authorYear: authorYear || null,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    createdAt: USE_FIREBASE ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
  };

  try {
    if (USE_FIREBASE && db) {
      await db.collection(POSTS_COLLECTION).add(newPost);
      composer.el.querySelector("#composer-title").value = "";
      composer.el.querySelector("#composer-body").value = "";
      composer.el.querySelector("#composer-image").value = "";
      composer.el.querySelector("#composer-image-name").textContent = "";
      composer.hide && composer.hide();
      hideSmallOverlay();
      showTransientMessage("Post published.");
      return;
    }
    // non-firebase fallback: localStorage
    const arr = JSON.parse(localStorage.getItem("campus_posts_v1") || "[]");
    newPost.createdAt = new Date().toISOString();
    arr.push(newPost);
    localStorage.setItem("campus_posts_v1", JSON.stringify(arr));
    composer.el.querySelector("#composer-title").value = "";
    composer.el.querySelector("#composer-body").value = "";
    composer.el.querySelector("#composer-image").value = "";
    composer.el.querySelector("#composer-image-name").textContent = "";
    composer.hide && composer.hide();
    hideSmallOverlay();
    showTransientMessage("Post published (local demo).");
    loadPostsRealtime();
  } catch (err) {
    hideSmallOverlay(); console.error("Failed to save post:", err); alert("Failed to publish post.");
  }
});

/* ---------------- auth state handling: populate UI profile card & nav avatar ---------------- */
async function populateProfileUI(user) {
  // profile card assumed to be the left-most first .card in the left column
  const leftCard = document.querySelector("section#dashboard .lg\\:col-span-1 .card") || document.querySelector(".card");
  if (!leftCard) return;
  // find elements inside leftCard to update: avatar div, name h3.font-bold, role p, and the info area
  const avatarEl = leftCard.querySelector(".h-20.w-20.rounded-full") || leftCard.querySelector(".h-10.w-10.rounded-full");
  const nameEl = leftCard.querySelector("h3.font-bold");
  const roleEl = leftCard.querySelector("p.text-sm");
  const infoRow = leftCard.querySelector("div.w-full.border-t");

  if (!user) {
    // show placeholder
    if (avatarEl) avatarEl.innerHTML = `<i class="fas fa-user text-2xl"></i>`;
    if (nameEl) nameEl.textContent = "Guest";
    if (roleEl) roleEl.textContent = "";
    if (infoRow) infoRow.innerHTML = '';
    // nav avatar
    const navAvatar = document.querySelector("#user-menu-button .h-8.w-8.rounded-full");
    if (navAvatar) navAvatar.innerHTML = `<i class="fas fa-user"></i>`;
    return;
  }
  // fetch user doc if available
  let userDoc = null;
  try {
    const doc = await db.collection("users").doc(user.uid).get();
    if (doc.exists) userDoc = doc.data();
  } catch (err) {
    console.warn("Error fetching user doc:", err);
  }
  const first = (userDoc && (userDoc.firstName || userDoc.first)) || user.displayName || null;
  const last = (userDoc && (userDoc.lastName || userDoc.last)) || null;
  const full = [first, last].filter(Boolean).join(" ") || user.email || "Member";
  const role = (userDoc && userDoc.position) || ""; // keep existing UI structure
  const schoolLine = (userDoc && (userDoc.schoolName || userDoc.school)) ? `${userDoc.schoolName || userDoc.school} ${userDoc.yearHeld ? userDoc.yearHeld : ''}` : '';
  const state = (userDoc && (userDoc.stateName || userDoc.state)) || '';
  const assoc = (userDoc && userDoc.association) || '';

  // update left card
  if (avatarEl) {
    const pic = (userDoc && userDoc.imageUrl) || user.photoURL || null;
    if (pic) avatarEl.innerHTML = `<img src="${pic}" alt="avatar" class="h-20 w-20 rounded-full object-cover">`;
    else avatarEl.innerHTML = `<i class="fas fa-user text-2xl"></i>`;
  }
  if (nameEl) nameEl.textContent = full;
  if (roleEl) roleEl.textContent = role || (userDoc && userDoc.position) || "";
  if (infoRow) {
    infoRow.innerHTML = `
      <div class="flex justify-between text-sm mb-2">
        <span class="text-gray-500">${escapeHtml(userDoc?.schoolName || userDoc?.school || '')} ${escapeHtml(userDoc?.yearHeld || '')}</span>
        <span class="font-medium"></span>
      </div>
      <div class="text-xs text-gray-500">State: ${escapeHtml(state)} • Assoc: ${escapeHtml(assoc)}</div>
    `;
  }
  // nav avatar
  const navAvatarWrap = document.querySelector("#user-menu-button > div");
  if (navAvatarWrap) {
    const pic = (userDoc && userDoc.imageUrl) || user.photoURL || null;
    if (pic) navAvatarWrap.innerHTML = `<img src="${pic}" alt="avatar" class="h-8 w-8 rounded-full object-cover">`;
    else navAvatarWrap.innerHTML = `<i class="fas fa-user"></i>`;
  }
}

/* --------------- listen for auth changes --------------- */
if (USE_FIREBASE && auth) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await populateProfileUI(user);
      // optionally reload posts to show any auth-dependent state (likes)
      loadPostsRealtime();
    } else {
      await populateProfileUI(null);
      loadPostsRealtime();
    }
  });
} else {
  // no firebase: attempt to populate from DOM local placeholders
  populateProfileUI(null);
}

/* ---------------- search implementation (client-side fetch & filter) ---------------- */
async function doSearch(q) {
  if (!q) return;
  searchModal.results.innerHTML = `<div class="text-sm text-gray-500">Searching...</div>`;
  searchModal.show();
  const term = q.toLowerCase();

  const matches = { users: [], posts: [] };

  if (USE_FIREBASE && db) {
    try {
      // fetch recent posts & users and filter locally
      const [postsSnap, usersSnap] = await Promise.all([
        db.collection(POSTS_COLLECTION).orderBy("createdAt", "desc").limit(200).get(),
        db.collection("users").orderBy("createdAt", "desc").limit(200).get()
      ]);
      postsSnap.forEach(d => {
        const p = d.data();
        const hay = `${p.title || ""} ${p.body || ""} ${p.authorFirst || ""} ${p.authorLast || ""}`.toLowerCase();
        if (hay.includes(term)) matches.posts.push({ id: d.id, ...p });
      });
      usersSnap.forEach(d => {
        const u = d.data();
        const hay = `${u.firstName || ""} ${u.lastName || ""} ${u.username || ""} ${u.schoolName || ""} ${u.association || ""}`.toLowerCase();
        if (hay.includes(term)) matches.users.push({ id: d.id, ...u });
      });
    } catch (err) {
      console.warn("Search query failed:", err);
    }
  } else {
    // local fallback
    const posts = JSON.parse(localStorage.getItem("campus_posts_v1") || "[]");
    const users = []; // nothing local
    posts.forEach(p => {
      const hay = `${p.title || ""} ${p.body || ""} ${p.authorName || ""}`.toLowerCase();
      if (hay.includes(term)) matches.posts.push(p);
    });
  }

  // render results
  const r = searchModal.results;
  r.innerHTML = "";
  if (matches.users.length === 0 && matches.posts.length === 0) {
    r.innerHTML = `<div class="text-sm text-gray-500">No results for "${escapeHtml(q)}"</div>`;
    return;
  }
  if (matches.users.length) {
    const h = document.createElement("div"); h.className = "mb-2"; h.innerHTML = `<h4 class="font-semibold">Users</h4>`;
    r.appendChild(h);
    matches.users.forEach(u => {
      const el = document.createElement("a");
      el.href = "#";
      el.className = "flex items-center gap-3 p-2 rounded hover:bg-gray-50";
      el.innerHTML = `<div class="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">${u.imageUrl ? `<img src="${u.imageUrl}" class="h-full w-full object-cover">` : `<i class="fas fa-user"></i>`}</div>
        <div><div class="font-medium">${escapeHtml((u.firstName || "") + " " + (u.lastName || ""))}</div><div class="text-xs text-gray-500">${escapeHtml(u.schoolName || "")} • ${escapeHtml(u.association || "")}</div></div>`;
      el.addEventListener("click", (ev) => { ev.preventDefault(); openProfile(u.id); searchModal.hide(); });
      r.appendChild(el);
    });
  }
  if (matches.posts.length) {
    const h = document.createElement("div"); h.className = "mt-3 mb-2"; h.innerHTML = `<h4 class="font-semibold">Posts</h4>`;
    r.appendChild(h);
    matches.posts.forEach(p => {
      const el = document.createElement("a");
      el.href = "#";
      el.className = "block p-2 rounded hover:bg-gray-50";
      el.innerHTML = `<div class="font-medium">${escapeHtml(p.title || (p.body || "").slice(0,50))}</div>
        <div class="text-xs text-gray-500">${escapeHtml((p.authorFirst || "") + " " + (p.authorLast || ""))} • ${escapeHtml(timeSince(p.createdAt && p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt)))}</div>`;
      el.addEventListener("click", (ev) => { ev.preventDefault(); openPostInModal(p.id); searchModal.hide(); });
      r.appendChild(el);
    });
  }
}

/* ---------------- open profile helper (navigates / modal) ---------------- */
async function openProfile(userId) {
  // for now, open a simple modal with user's info and posts
  try {
    const doc = await db.collection("users").doc(userId).get();
    if (!doc.exists) return alert("Profile not found.");
    const u = doc.data();
    const modal = document.createElement("div");
    modal.style.position = "fixed"; modal.style.left = 0; modal.style.top = 0; modal.style.width = "100%"; modal.style.height = "100%";
    modal.style.zIndex = 99999; modal.style.display = "flex"; modal.style.alignItems = "center"; modal.style.justifyContent = "center";
    modal.style.backdropFilter = "blur(4px)"; modal.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-2xl p-4">
        <div class="flex justify-between items-center mb-4"><div class="flex items-center gap-4">
          <div class="h-16 w-16 rounded-full overflow-hidden">${u.imageUrl ? `<img src="${u.imageUrl}" class="h-full w-full object-cover">` : `<i class="fas fa-user"></i>`}</div>
          <div><div class="font-bold">${escapeHtml((u.firstName||"") + " " + (u.lastName||""))}</div><div class="text-xs text-gray-500">${escapeHtml(u.schoolName || "")} • ${escapeHtml(u.association || "")}</div></div>
        </div><button id="close-profile" class="px-3 py-1 rounded bghover">Close</button></div>
        <div id="profile-posts" class="space-y-3"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#close-profile").addEventListener("click", () => modal.remove());
    // load posts by this user
    const postsSnap = await db.collection(POSTS_COLLECTION).where("authorId", "==", userId).orderBy("createdAt", "desc").limit(50).get();
    const list = modal.querySelector("#profile-posts");
    postsSnap.forEach(d => list.appendChild(renderPost({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("Open profile error:", err);
  }
}

/* ---------------- open single post in modal --------------- */
async function openPostInModal(postId) {
  try {
    const doc = await db.collection(POSTS_COLLECTION).doc(postId).get();
    if (!doc.exists) return alert("Post not found.");
    const p = doc.data();
    const modal = document.createElement("div");
    modal.style.position = "fixed"; modal.style.left = 0; modal.style.top = 0; modal.style.width = "100%"; modal.style.height = "100%";
    modal.style.zIndex = 99999; modal.style.display = "flex"; modal.style.alignItems = "center"; modal.style.justifyContent = "center";
    modal.style.backdropFilter = "blur(4px)"; modal.innerHTML = `<div class="bg-white rounded-lg w-full max-w-3xl p-4">
      <div class="flex justify-between items-center mb-3"><h3 class="font-bold">${escapeHtml(p.title || "Post")}</h3><button id="close-post" class="px-3 py-1 rounded bghover">Close</button></div>
      <div class="space-y-3">${renderPost({ id: doc.id, ...p }).outerHTML}</div></div>`;
    document.body.appendChild(modal);
    modal.querySelector("#close-post").addEventListener("click", () => modal.remove());
  } catch (err) { console.error("Open post modal error:", err); }
}

/* ---------------- helpers: small overlay & transient message ---------------- */
function showSmallOverlay(msg = "Working...") {
  let o = document.getElementById("small-overlay");
  if (!o) {
    o = document.createElement("div"); o.id = "small-overlay";
    o.style.position = "fixed"; o.style.right = "20px"; o.style.bottom = "20px"; o.style.zIndex = 99999;
    o.style.background = "rgba(0,0,0,0.8)"; o.style.color = "white"; o.style.padding = "10px 14px"; o.style.borderRadius = "8px";
    document.body.appendChild(o);
  }
  o.textContent = msg; o.style.display = "block";
}
function hideSmallOverlay() { const o = document.getElementById("small-overlay"); if (o) o.style.display = "none"; }
function showTransientMessage(msg) {
  const el = document.createElement("div"); el.textContent = msg;
  el.style.position = "fixed"; el.style.right = "20px"; el.style.bottom = "20px";
  el.style.padding = "10px 14px"; el.style.background = "#111827"; el.style.color = "white"; el.style.borderRadius = "8px"; el.style.zIndex = 99999;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}

/* ----------------- utility: escapeHtml & timeSince ----------------- */
function escapeHtml(s) { if (!s) return ""; return s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[m]); }
function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + "y ago";
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + "mo ago";
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + "d ago";
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + "h ago";
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + "m ago";
  return "just now";
}

/* ---------------- expose manual reload helper ---------------- */
window.CampusLeaders = window.CampusLeaders || {};
window.CampusLeaders.reloadPosts = loadPostsRealtime;
