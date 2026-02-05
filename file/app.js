const firebaseConfig = {
  apiKey: "AIzaSyCDCijRwIxpHJK0gYmElkocvu8tNKFykpc",
  authDomain: "generalstore-b6e17.firebaseapp.com",
  databaseURL: "https://generalstore-b6e17-default-rtdb.firebaseio.com",
  projectId: "generalstore-b6e17",
  storageBucket: "generalstore-b6e17.firebasestorage.app",
  messagingSenderId: "239645257410",
  appId: "1:239645257410:web:43825aac8e30d15d4f955b",
  measurementId: "G-9YQ7BK5TYT"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null, userRole = 'user', userProducts = [], pendingTransactions = [], allProducts = [];
let editingProductId = null, currentQRProduct = null;


// ==========================================
//🔥FIXED BROADCAST - NOW WORKS PERFECTLY
// ==========================================
async function sendBroadcast() {
  if (userRole !== 'admin') return notify('❌ Admin only!', 'error');

  const title = document.getElementById('broadcastTitleInput').value.trim();
  const message = document.getElementById('broadcastMessageInput').value.trim();

  if (!title || !message) return notify('❌ Title aur Message dono bhariye!', 'error');

  try {
    // Ye line database mein "latest_msg" ko naye data se badal degi
    await db.collection('broadcasts').doc("latest_msg").set({
      title: title,
      message: message,
      sentAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: false }); // merge: false matlab purana data poori tarah khatam
    
    notify('message send Success', 'success');
    
    // Naya message turant dikhane ke liye
    showBroadcast(title, message);
    
    // Inputs saaf karne ke liye
    document.getElementById('broadcastTitleInput').value = '';
    document.getElementById('broadcastMessageInput').value = '';
  } catch (error) {
    console.error("Broadcast error:", error);
    notify('❌ Update fail: ' + error.message, 'error');
  }
}



// 🔥 UPDATED: FIXED AUTO-LOAD BROADCAST
async function checkBroadcasts() {
  try {
    // Hum hamesha "latest_msg" wala document hi uthayenge
    const doc = await db.collection('broadcasts').doc("latest_msg").get();
    
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('broadcastTitle').textContent = data.title;
      document.getElementById('broadcastMessage').textContent = data.message;
      document.getElementById('broadcastPopup').style.display = 'block';
      document.getElementById('broadcastPopup').classList.add('show');
    }
  } catch (err) {
    console.log('No saved broadcast');
  }
}

// ==================================================
//🔥 FIXED BROADCAST - NOW WORKS PERFECTLY END
// ==================================================


// =======================================================
// 🔥 USERS CAN SUBMIT TX ID - NO PERMISSION ERRORS
// =======================================================
async function submitTransaction() {
  const txId = document.getElementById('transactionId').value.trim();
  if (!txId) { notify('❌ Enter Transaction ID!', 'error'); return; }
  if (!currentQRProduct) { notify('❌ Select a product first!', 'error'); return; }
  try {
    await db.collection('pendingTransactions').add({
      userId: currentUser.uid,
      userEmail: currentUser.email,
      transactionId: txId,
      productId: currentQRProduct,
      status: 'pending',
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    notify(' TX Submitted! Checking status...', 'success');
    closeQRModal();
    showSection('mykeys'); // <-- Ye line user ko status page par le jayegi
  } catch (error) {
    notify(`❌ Error: ${error.message}`, 'error');
  }
}

// ========================================================
// 🔥 USERS CAN SUBMIT TX ID - NO PERMISSION ERRORS END
// ========================================================


// 🔥 FIXED LOAD PENDING TRANSACTIONS
// 🔥 NO INDEX NEEDED - PERFECTLY WORKS!
async function loadPendingTransactions() {
  if (userRole !== 'admin') return;

  const listDiv = document.getElementById('transactionList');
  const countSpan = document.getElementById('pendingCount');
  
  try {
    listDiv.innerHTML = '<div style="text-align:center; padding:20px;">⌛ Fetching Payments...</div>';
    
    // Sabhi pending payments fetch karein
    const snapshot = await db.collection('pendingTransactions')
      .where('status', '==', 'pending')
      .get();

    countSpan.textContent = snapshot.size;

    if (snapshot.empty) {
      listDiv.innerHTML = '<p style="text-align:center; padding:30px; color:#6dff9a; font-weight:bold;">✨ No Pending Payments! ✨</p>';
      return;
    }

    let html = '';
    // Sorting: Newest first (Manually sorting because no index required)
    const docs = snapshot.docs.sort((a, b) => (b.data().submittedAt?.toMillis() || 0) - (a.data().submittedAt?.toMillis() || 0));

    docs.forEach(doc => {
      const tx = doc.data();
      const time = tx.submittedAt ? new Date(tx.submittedAt.toDate()).toLocaleString('en-GB') : 'Just now';
      
      html += `
        <div class="item" style="border-left: 5px solid #ffeb3b; background: rgba(255,235,59,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="color:#fff;">📧 ${tx.userEmail}</b>
            <span style="background:#ffeb3b; color:#000; padding:2px 8px; border-radius:8px; font-weight:900;">₹${tx.amount || 'PAY'}</span>
          </div>
          <div style="margin: 10px 0; background:rgba(0,0,0,0.2); padding:10px; border-radius:10px;">
            <div style="font-size:12px; color:#aaa;">UTR / Ref Number:</div>
            <div style="font-size:16px; color:#6dff9a; font-weight:bold; letter-spacing:1px;">${tx.transactionId}</div>
          </div>
          <div style="font-size:11px; color:#888;">📅 ${time} | Product: ${tx.productId}</div>
          <div class="row" style="margin-top:15px;">
            <button class="manual-give" onclick="verifyTransaction('${doc.id}', '${tx.userId}', '${tx.productId}')" style="background:#6dff9a !important; font-weight:bold;">APPROVE</button>
            <button class="danger" onclick="rejectTransaction('${doc.id}')" style="font-weight:bold;">❌ REJECT</button>
          </div>
        </div>
      `;
    });
    listDiv.innerHTML = html;
  } catch (err) {
    console.error(err);
    listDiv.innerHTML = '<div class="bad">❌ Error: Use Chrome Console to check if Indexing is needed.</div>';
  }
}


// 🔥 FIXED VERIFY TRANSACTION WITH SOLD OUT FEATURE
// 🔥 SMART VERIFY: User delete hone par bhi kaam karega

async function verifyTransaction(txId, userId, productId) {
  if (!confirm('Verify this payment and grant access?')) return;
  
  try {
    // 1. Pehle check karein ki kya user Firestore mein maujood hai?
    const userDoc = await db.collection('users').doc(userId).get();
    const batch = db.batch();

    if (!userDoc.exists) {
      console.log("User record missing, recreating during verification...");
      const txDoc = await db.collection('pendingTransactions').doc(txId).get();
      const txData = txDoc.data();
      
      batch.set(db.collection('users').doc(userId), {
        email: txData.userEmail || "recovered_user@store.com",
        role: 'user',
        purchasedProducts: [productId], 
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      batch.update(db.collection('users').doc(userId), { 
        purchasedProducts: firebase.firestore.FieldValue.arrayUnion(productId) 
      });
    }

    // 2. Transaction status update karein
    batch.update(db.collection('pendingTransactions').doc(txId), { 
      status: 'verified', 
      verifiedAt: firebase.firestore.FieldValue.serverTimestamp() 
    });
    
    // 3. Product ko sold out mark karein
    batch.update(db.collection('products').doc(productId), { 
      isSoldOut: true,
      soldAt: firebase.firestore.FieldValue.serverTimestamp(),
      soldTo: userId
    });
    
    // Batch commit (Database update)
    await batch.commit();

    // 🔥 NAYA: SOUND LOGIC 🔥
    const sound = document.getElementById("verifysuccessPing");
    if (sound) {
      sound.currentTime = 0; // Har baar shuru se bajne ke liye
      sound.play().catch(e => console.log("Sound error:", e));
    }

    notify(' Approved! User data recovered and verified.', 'success');
    loadPendingTransactions();

  } catch (err) {
    console.error("Verification error:", err);
    notify('❌ Verification failed: ' + err.message, 'error');
  }
}



async function rejectTransaction(txId) {
  if (!confirm('Reject this transaction?')) return;
  
  try {
    await db.collection('pendingTransactions').doc(txId).update({
      status: 'rejected',
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    notify('❌Transaction rejected!', 'success');
    loadPendingTransactions();
  } catch (err) {
    notify('❌ Reject failed!', 'error');
  }
}




// 🔥 FIXED PRODUCTS LIST WITH SOLD OUT CHECK
// --- NEW SORTING LOGIC FOR PRODUCTS ---
async function renderProductsList() {
  try {
    const snapshot = await db.collection('products').get();
    allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (allProducts.length === 0) {
      document.getElementById('productList').innerHTML = '<p style="text-align:center; opacity:0.5;">No products available</p>';
      return;
    }

    // 1. Smart Sorting: Available upar, Sold niche
    allProducts.sort((a, b) => {
      if (a.isSoldOut !== b.isSoldOut) return a.isSoldOut ? 1 : -1;
      return (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0);
    });

    let html = '';
    allProducts.forEach(p => {
      const isPurchased = userProducts.includes(p.id);
      const isSoldOut = p.isSoldOut || false;
      
      // ✅ FIX: Listed Date (Undefined handle karne ke liye)
      let listedDate = "Recently";
      if (p.submittedAt && p.submittedAt.toDate) {
          listedDate = new Date(p.submittedAt.toDate()).toLocaleDateString('en-GB');
      }
      
      if (isSoldOut) {
        // ✅ FIX: Sold Date (Agar string na mile toh timestamp check karega)
        let displaySoldDate = "Recently";
        if (p.soldDate) {
            displaySoldDate = p.soldDate; 
        } else if (p.soldAt && p.soldAt.toDate) {
            displaySoldDate = new Date(p.soldAt.toDate()).toLocaleDateString('en-GB');
        }

        // --- SOLD OUT LOOK: Purana simple design ---
        // --- SOLD OUT LOOK: Premium Punched Ticket Design ---
html += `
  <div style="position: relative; margin-bottom: 25px; width: 100%; overflow: hidden; border-radius: 28px;">
    
    <div style="
        position: absolute;
        top: 20px;
        right: -35px;
        background: #ff0000 !important; 
        color: white;
        padding: 6px 40px;
        transform: rotate(45deg);
        font-size: 12px;
        font-weight: 900;
        z-index: 100;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        letter-spacing: 1px;
    ">SOLD OUT</div>

    <div style="
      background: #111422;
      border: 1.5px solid rgba(255, 255, 255, 0.1);
      border-radius: 28px;
      position: relative;
      clip-path: polygon(0% 0%, 100% 0%, 100% 62%, 97% 65%, 100% 68%, 100% 100%, 0% 100%, 0% 68%, 3% 65%, 0% 62%);
    ">
      
      <div style="filter: grayscale(1) brightness(0.6); pointer-events: none;">
          
          <div style="position: absolute; left: -16px; top: 65%; transform: translateY(-50%); width: 32px; height: 32px; background: #0f121d; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.1); z-index: 10;"></div>
          <div style="position: absolute; right: -16px; top: 65%; transform: translateY(-50%); width: 32px; height: 32px; background: #0f121d; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.1); z-index: 10;"></div>

          <div style="width: 100%; height: 160px; background: #000; overflow: hidden;">
              <img src="${p.image || 'https://blog.boon.so/wp-content/uploads/2024/03/Xiaomi-Logo-scaled.jpg'}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.5;">
          </div>

          <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h3 style="margin: 0; font-size: 17px; color: #888;">${p.name}</h3>
                <div style="margin-top: 6px;">
                  <span style="font-size: 10px; color: #fff; background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.1); font-weight: 800;">❌ OUT OF STOCK</span>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="color: #666; font-size: 24px; font-weight: 900;">₹${p.price}</div>
                
<div style="
    font-size: 10px; 
    color: #ffffff; 
    background: rgba(255, 255, 255, 0.1); 
    padding: 4px 10px; 
    border-radius: 6px; 
    display: flex;        /* Flex se icon aur text ek line mein rahenge */
    align-items: center;
    gap: 4px;             /* Icon aur text ke beech thodi jagah */
    font-weight: 700; 
    border: 1px solid rgba(255, 255, 255, 0.1); 
    white-space: nowrap;  /* Date niche nahi giregi */
    line-height: 1;
">
    <span style="font-size: 12px;">📅</span> 
    Sold on: ${displaySoldDate}
</div>


              </div>
            </div>
            
            <div style="margin: 22px -20px; border-bottom: 1.5px dashed rgba(255,255,255,0.05); height: 1px;"></div>
            
            <div style="margin-top: 10px;">
                <button disabled style="width: 100%; padding: 16px; border-radius: 20px; border: none; background: #222; color: #555; font-weight: 800;">NOT AVAILABLE</button>
            </div>
          </div>
      </div>
    </div>
  </div>
`;


      } else if (isPurchased) {
        // --- PURCHASED LOOK ---
        html += `
          <div class="item" style="border-left: 4px solid #6dff9a; background: rgba(109,255,154,0.05); margin-bottom: 12px; border-radius: 12px;">
            <b style="color: #6dff9a;">${p.name}</b> <small style="color: #6dff9a; opacity: 0.8;">(Purchased)</small><br>
            <button class="action" onclick="showSection('mykeys')" style="padding:6px 12px; font-size:11px; margin-top:8px; border-radius: 8px;">View My Key</button>
          </div>`;

      } else {
        // --- AVAILABLE LOOK: Naya premium design ---
        // --- AVAILABLE LOOK: Naya premium design with Coupon ---
html += `
  <div style="
    position: relative;
    margin-bottom: 25px;
    clip-path: polygon(0% 0%, 100% 0%, 100% 62%, 97% 65%, 100% 68%, 100% 100%, 0% 100%, 0% 68%, 3% 65%, 0% 62%);
    filter: drop-shadow(0 10px 20px rgba(0,0,0,0.4));
  ">
    <div style="
      background: #1a1d2e;
      border: 1.5px solid rgba(255, 255, 255, 0.25);
      border-radius: 28px;
      position: relative;
      overflow: hidden;
    ">
      
      <div style="position: absolute; left: -16px; top: 65%; transform: translateY(-50%); width: 32px; height: 32px; background: #0f121d; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.25); z-index: 10;"></div>
      <div style="position: absolute; right: -16px; top: 65%; transform: translateY(-50%); width: 32px; height: 32px; background: #0f121d; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.25); z-index: 10;"></div>

      <div style="width: 100%; height: 160px; background: #000; overflow: hidden;">
          <img src="${p.image || 'https://blog.boon.so/wp-content/uploads/2024/03/Xiaomi-Logo-scaled.jpg'}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>

      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h3 style="margin: 0; font-size: 19px; color: #fff; font-weight: 700;">${p.name}</h3>
            <div style="margin-top: 6px;">
              <span style="font-size: 10px; color: #00ff88; background: rgba(0, 255, 136, 0.1); padding: 4px 12px; border-radius: 50px; border: 1px solid rgba(0, 255, 136, 0.2); font-weight: 800;">
                ⚡ 100% Working
              </span>
            </div>
          </div>
          <div style="text-align: right;">
            <div id="price-display-${p.id}" style="color: #00ff88; font-size: 24px; font-weight: 900;">₹${p.price}</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 4px;">Listed: ${listedDate}</div>
          </div>
        </div>

<div style="margin-top: 15px;">
    <div onclick="toggleCouponCard('${p.id}')" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
        <span style="font-size: 12px; color: #ffeb3b; font-weight: 600;">🎁 Have a promo code?</span>
        <span id="arrow-${p.id}" style="transition: 0.3s; font-size: 12px; color: #ffeb3b;">▼</span>
    </div>

    <div id="coupon-box-${p.id}" style="display: none; margin-top: 10px; animation: slideDown 0.3s ease-out;">
        <div style="display: flex; gap: 8px;">
            <input type="text" id="coupon-input-${p.id}" placeholder="ENTER YOUR CUPON CODE" 
                   style="flex: 1; background: #0f121d; border: 1px solid #ffeb3b44; border-radius: 8px; color: #ffeb3b; padding: 10px; font-size: 11px; outline: none;">
            <button onclick="applyCardCoupon('${p.id}', ${p.price})" 
                    style="background: #ffeb3b; color: #000; border: none; padding: 0 12px; border-radius: 12px; font-weight: bold; font-size: 15px; cursor: pointer;">
                APPLY
            </button>
        </div>
        <p id="coupon-status-${p.id}" style="font-size: 10px; margin: 5px 0 0 5px; min-height: 12px;"></p>
    </div>
</div>



        <div style="margin-top: 10px;">

<button id="buy-btn-${p.id}" onclick="openQRModal(${p.price}, '${p.id}')" style="
    width: 100%; padding: 16px; border-radius: 30px; border: none; 
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); 
    color: #fff; font-weight: 800; font-size: 14px; text-transform: uppercase;
    letter-spacing: 1.5px; cursor: pointer;">
    💳 BUY THIS ACCOUNT
</button>

        </div>
      </div>
    </div>
  </div>
`;

      }
    });
    
    document.getElementById('productList').innerHTML = html;
  } catch (err) {
    console.error("Render Error:", err);
  }
}


// ==========================================
// --Cupon Box ko Hide/Show karne ka function---
// ==========================================

function toggleCouponCard(prodId) {
    const box = document.getElementById(`coupon-box-${prodId}`);
    const arrow = document.getElementById(`arrow-${prodId}`);
    
    if (box.style.display === "none") {
        box.style.display = "block";
        arrow.style.transform = "rotate(180deg)";
    } else {
        box.style.display = "none";
        arrow.style.transform = "rotate(0deg)";
    }
}


// ==========================================
// -- 2. Coupon Apply logic (Updated for Card)---
// ==========================================
async function applyCardCoupon(prodId, originalPrice) {
    const input = document.getElementById(`coupon-input-${prodId}`);
    const status = document.getElementById(`coupon-status-${prodId}`);
    const priceDisplay = document.getElementById(`price-display-${prodId}`);
    const buyBtn = document.getElementById(`buy-btn-${prodId}`);
    const code = input.value.trim().toUpperCase();

    if (!code || !currentUser) return;
    status.innerText = "Verifying...";
    status.style.color = "#aaa";

    try {
        // 1. Check Coupon Existence
        const snap = await db.collection('coupons').where('code', '==', code).get();
        if (snap.empty) throw new Error("Invalid Code!");

        const d = snap.docs[0].data();
        const couponId = snap.docs[0].id;

        // 2. Double Check Usage for THIS USER
        const alreadyUsedSnap = await db.collection('pendingTransactions')
            .where('userId', '==', currentUser.uid)
            .get(); // Fetch user's all transactions to be safe

        let isUsed = false;
        alreadyUsedSnap.forEach(doc => {
            if(doc.data().couponCode === code) isUsed = true;
        });

        if (isUsed) throw new Error("You already used this code!");

        // 3. Expiry & Limit Check
        const today = new Date().getTime();
        const expDate = d.expiryDate && d.expiryDate !== "No Expiry" ? new Date(d.expiryDate).getTime() : null;
        if (expDate && expDate < today) throw new Error("Coupon Expired!");
        if (d.usedCount >= d.usageLimit) throw new Error("Coupon Limit Reached!");

        // 4. Price Calculation
        let discount = (d.type === 'fixed') ? d.value : (originalPrice * d.value) / 100;
        let finalPrice = Math.max(0, originalPrice - discount);

        // Global Variable Set (Important)
        discountApplied = discount;
        window.appliedCouponId = couponId;
        window.currentCouponCode = code; 

        // 5. UI Updates
        priceDisplay.innerText = `₹${finalPrice}`;
        priceDisplay.style.color = "#ffeb3b";
        status.innerText = `🎉 ₹${discount} Saved!`;
        status.style.color = "#6dff9a";

        if (finalPrice === 0) {
            buyBtn.innerText = "🎁 CLAIM FOR FREE";
            buyBtn.setAttribute('onclick', `directClaimFree('${prodId}', '${couponId}', '${code}')`);
        } else {
            buyBtn.innerText = "💳 BUY NOW";
            buyBtn.setAttribute('onclick', `openQRModal(${finalPrice}, '${prodId}')`);
        }

    } catch (e) {
        status.innerText = e.message;
        status.style.color = "#ff4d4d";
        priceDisplay.innerText = `₹${originalPrice}`;
        priceDisplay.style.color = "#00ff88";
        window.currentCouponCode = null;
    }
}


// ==========================================
// --100% buy Cupon Se direct access ---
// ==========================================
async function directClaimFree(productId, couponDocId, code) {
    if (!auth.currentUser) return;

    const buyBtn = document.getElementById(`buy-btn-${productId}`);
    const originalText = buyBtn.innerText;
    buyBtn.innerText = "Processing... ⏳";
    buyBtn.disabled = true;

    try {
        const userId = auth.currentUser.uid;
        const userEmail = auth.currentUser.email; // Buyer ka email lein
        const userRef = db.collection('users').doc(userId);

        // 1. Transaction Record
        await db.collection('pendingTransactions').add({
            userId: userId,
            userEmail: userEmail,
            productId: productId,
            couponCode: code,
            amount: 0,
            status: 'completed',
            transactionId: "FREE_" + Date.now(),
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 🔥 2. PRODUCT UPDATE FIX: Buyer details add karein
        // Isse Admin panel par "null" ki jagah email dikhega
        await db.collection('products').doc(productId).update({
            status: 'sold',
            isSoldOut: true,
            soldTo: userId,        // Buyer ID
            buyerEmail: userEmail, // Admin yahi field read karta hai display ke liye
            soldAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. User Profile Update (For Dashboard Sync)
        await userRef.update({
            purchasedProducts: firebase.firestore.FieldValue.arrayUnion(productId)
        });

        // 4. Coupon Update
        await db.collection('coupons').doc(couponDocId).update({
            usedCount: firebase.firestore.FieldValue.increment(1)
        });

        // Celebration
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 9999 });
        }

        alert("🎁 Success! Account claimed.");

        // Data Sync
        await loadUserData(); 
        await renderProductsList();

        setTimeout(() => {
            showSection('mykeys');
        }, 500); 

    } catch (error) {
        console.error("Claim Error:", error);
        alert("❌ Error: " + error.message);
        buyBtn.innerText = originalText;
        buyBtn.disabled = false;
    }
}

// ==========================================
// --100% buy Cupon Se direct access ---end
// ==========================================




// ==========================================
/// 🔥 FIXED MY KEYS ---
// ==========================================

async function renderMyKeys() {
  try {
    const keyList = document.getElementById('myKeyList');
    if(!keyList) return;

    keyList.innerHTML = `
        <div class="loading-container">
            <div class="loader"></div>
            <span>Refreshing your products...</span>
        </div>`;

    // 1. User & Transaction data fetch
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data() || {};
    const purchasedIds = userData.purchasedProducts || [];

    const txSnapshot = await db.collection('pendingTransactions')
      .where('userId', '==', currentUser.uid)
      .get();

    const productsSnapshot = await db.collection('products').get();
    const allProducts = productsSnapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = { id: doc.id, ...doc.data() };
      return acc;
    }, {});

    if (txSnapshot.empty && purchasedIds.length === 0) {
      keyList.innerHTML = '<div class="item" style="text-align:center;"><p class="bad">No purchases found. Go to the Accounts section to purchase.</p></div>';
      return;
    }

    let html = '<h4 style="color:#ffeb3b; margin: 10px 0 15px 0;">👉 My Purchase & Access</h4>';

    const sortedTransactions = txSnapshot.docs.sort((a, b) => 
      (b.data().submittedAt?.toMillis() || 0) - (a.data().submittedAt?.toMillis() || 0)
    );

    const displayedViaTx = new Set();

    sortedTransactions.forEach(doc => {
        const tx = doc.data();
        const productId = tx.productId;
        displayedViaTx.add(productId);
        
        const productInfo = allProducts[productId];
        const subDate = tx.submittedAt ? new Date(tx.submittedAt.toDate()).toLocaleString('en-GB') : 'Just Now';

        // --- STATUS LOGIC FIX ---
        let cardStyle = "border-left: 4px solid #ffeb3b; background: rgba(255,235,59,0.05);";
        let statusLabel = "Pending ⏳";
        let statusColor = "#ffeb3b";
        let isUnlocked = false;

        if (tx.status === 'rejected') {
            cardStyle = "border-left: 4px solid #ff4444; background: rgba(255,68,68,0.05);";
            statusLabel = "Rejected❌";
            statusColor = "#ff4444";
        } 
        else if (tx.status === 'verified') {
            cardStyle = "border-left: 4px solid #6dff9a; background: rgba(109,255,154,0.05);";
            statusLabel = "Verified";
            statusColor = "#00ff88";
            isUnlocked = true;
        }
        // 🔥 NAYA FIX: Coupon/Free claim ke liye
        else if (tx.status === 'completed' || tx.amount === 0) {
            cardStyle = "border-left: 4px solid #00ff88; background: rgba(0,255,136,0.1);";
            statusLabel = "🎁Claim (Active)";
            statusColor = "#00ff88";
            isUnlocked = true;
        }

        const detailedInfo = `
            📅 <b>Date:</b> ${subDate}<br>
            🆔 <b>Product ID:</b> ${productId}<br>
            💰 <b>Amount:</b> ₹${tx.amount || '0'}<br>
            💳 <b>Type:</b> ${tx.amount === 0 ? '💲🎁Coupon Claim' : '💲Manual Payment'}
        `;

        html += renderCardUI(
            productId, 
            statusLabel, 
            statusColor, 
            cardStyle, 
            detailedInfo, 
            productInfo, 
            isUnlocked
        );
    });


    
    // --- PART B: DIRECT ACCESS LOGIC (In renderMyKeys) ---
purchasedIds.forEach(pId => {
  if (!displayedViaTx.has(pId)) {
    const productInfo = allProducts[pId];
    if(productInfo) {
      const blueColor = "#6d7cff"; // Royal Blue for Direct Access
      
      // Access Date logic
      const accessDate = userData.createdAt ? 
        new Date(userData.createdAt.toDate()).toLocaleString('en-GB') : 'Direct Gift';

      // Blue side border and background style
      const cardStyle = `border-left: 4px solid ${blueColor}; background: rgba(109,124,255,0.05);`;

      // Detailed Info line: Date, ID, and Amount (Gifted status)
      const infoLine = `
        📅 <b>Access Date:</b> ${accessDate}<br>
        🆔 <b>Product ID:</b> ${pId}<br>
        💰 <b>Price:</b> ₹${productInfo.price || '0'} (Admin Gifted)
      `;

      // renderCardUI call with BLUE theme
      html += renderCardUI(
        pId, 
        "👑DIRECT ACCESS👑", 
        blueColor, 
        cardStyle, 
        infoLine, 
        productInfo, 
        true
      );
    }
  }
});

    keyList.innerHTML = html;
  } catch (err) {
    console.error(err);
    document.getElementById('myKeyList').innerHTML = '<div class="item"><p class="bad">Error loading history.</p></div>';
  }
}

// Helper function to avoid duplicate code
function renderCardUI(id, label, color, style, infoLine, productInfo, isVisible) {
    let cardHtml = `
    <div class="item" style="${style} margin-bottom:20px; padding:15px; border-radius:12px; background:rgba(255,255,255,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
            <b style="font-size:15px; color:#fff;">${productInfo ? productInfo.name : 'Xiaomi Acc'}</b>
            <span style="font-size:12px; font-weight:bold; color:${color};">${label}</span>
        </div>
        <div style="font-size:12px; opacity:0.8; line-height:1.6; margin-bottom:12px; color:#ddd;">
            ${infoLine}
        </div>`;

    if (isVisible && productInfo) {
        cardHtml += `
        <div class="product-creds" style="margin-top:12px; background:rgba(0,0,0,0.2); padding:15px; border-radius:10px; border:1px solid ${color};">
            
            <div style="margin-bottom:15px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <b style="color:${color}; font-size:13px;"><i class="fas fa-id-card"></i> Login ID:</b>
                    <span style="color:#fff; font-size:14px; font-family:monospace;">${productInfo.loginId || 'N/A'}</span>
                </div>
                <button class="copy-btn" style="width:100%; padding:12px; background:${color}; color:#000; border:none; border-radius:8px; font-weight:bold; cursor:pointer;" 
                onclick="copyToClipboard('${productInfo.loginId}', this)">Copy ID</button>
            </div>

            ${productInfo.key ? `
            <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <b style="color:${color}; font-size:13px;"><i class="fas fa-key"></i> Password:</b>
                    <span style="color:#fff; font-size:14px; font-family:monospace;">${productInfo.key}</span>
                </div>
                <button class="copy-btn" style="width:100%; padding:12px; background:${color}; color:#000; border:none; border-radius:8px; font-weight:bold; cursor:pointer;" 
                onclick="copyToClipboard('${productInfo.key}', this)">Copy Key</button>
            </div>` : ''}

        </div>`;
    }
    cardHtml += `</div>`;
    return cardHtml;
}



// ==========================================
// 1. Photo Update Function
// ==========================================

async function updateProfilePhoto() {
  const url = document.getElementById('photoUrlInput').value.trim();
  if(!url) return notify('❌ Please paste an Image URL!', 'error');
  
  try {
    await db.collection('users').doc(currentUser.uid).update({ 
      profilePhoto: url 
    });
    notify('Profile Photo Updated!', 'success');
    document.getElementById('photoUrlInput').value = '';
    
    // Turant UI update karne ke liye dobara load karein
    await loadUserData(); 
  } catch(err) { 
    notify('❌ Update failed!', 'error'); 
  }
}

// ==========================================
// 1. Photo Update Function end
// ==========================================



// ==========================================
// 🔥 FIXED: Sidebar Photo Rendering
// ==========================================

async function loadUserData() {
  try {
    // 1. OFFLINE DATA LOAD
    const cachedData = localStorage.getItem('userDashboardData');
    if (cachedData) {
      const offlineData = JSON.parse(cachedData);
      renderUI(offlineData.userData, offlineData.userEmail, offlineData.availableOnly, offlineData.actualPurchaseCount || 0);
    }

    // 2. ONLINE DATA FETCH
    if (navigator.onLine && currentUser) {
      // Parallel fetch: Profile aur Transactions dono mangwao
      const [userDoc, transSnap, prodSnapshot] = await Promise.all([
        db.collection('users').doc(currentUser.uid).get(),
        db.collection('pendingTransactions')
          .where('userId', '==', currentUser.uid)
          .where('status', '==', 'completed')
          .get(),
        db.collection('products').get()
      ]);
      
      let userData = { role: 'user', purchasedProducts: [], profilePhoto: "" };
      if (userDoc.exists) {
        userData = userDoc.data();
        userRole = userData.role || 'user';
        userProducts = userData.purchasedProducts || [];
      }

      // --- 🔥 TOTAL COUNT LOGIC START ---
      
      // 1. Manual/Old items jo user profile array mein hain
      const profileIds = userData.purchasedProducts || [];
      
      // 2. New items jo transactions table mein hain
      const transIds = transSnap.docs.map(doc => doc.data().productId);
      
      // 3. MERGE & UNIQUE: Dono ko milao aur duplicates hatao
      // Isse Manual + Coupon dono jud jayenge
      const allUniqueIds = [...new Set([...profileIds, ...transIds])];
      const totalCombinedCount = allUniqueIds.length;

      // --- TOTAL COUNT LOGIC END ---

      const userEmail = currentUser.email;
      const availableOnly = prodSnapshot.docs.filter(p => !p.data().isSoldOut).length;

      // Local storage update
      localStorage.setItem('userDashboardData', JSON.stringify({
        userData,
        userEmail,
        availableOnly,
        actualPurchaseCount: totalCombinedCount
      }));

      // Fresh UI update
      renderUI(userData, userEmail, availableOnly, totalCombinedCount);
    }
  } catch (err) {
    console.error("Profile Load Error:", err);
  }
}



// 2. renderUI: Sidebar aur Settings dono jagah data dikhana
function renderUI(userData, userEmail, availableOnly, actualPurchaseCount = 0) {
  const currentRole = userData.role || 'user';
  const photoUrl = userData.profilePhoto || "";

  // 1. PHOTO/AVATAR LOGIC
  const photoHTML = (photoUrl && photoUrl !== "") 
    ? `<img src="${photoUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${userEmail}&background=6d7cff&color=fff'">`
    : `<span style="font-size:20px; font-weight:bold; color:white;">${userEmail.charAt(0).toUpperCase()}</span>`;
  
  if(document.getElementById('sideAvatar')) document.getElementById('sideAvatar').innerHTML = photoHTML;
  if(document.getElementById('settingsAvatar')) document.getElementById('settingsAvatar').innerHTML = photoHTML;

  // 2. NAME & ROLE TEXT LOGIC
  let namePart = userEmail.split('@')[0].toUpperCase();
  if(namePart.length > 10) namePart = namePart.substring(0, 8) + "..";
  const roleDisplayText = currentRole === 'admin' ? '👑Administrator' : 'Verified User✅';

  // Sidebar & Settings Display Updates
  if(document.getElementById('sideName')) document.getElementById('sideName').textContent = namePart;
  if(document.getElementById('sideRole')) document.getElementById('sideRole').textContent = roleDisplayText;
  if(document.getElementById('set-userName')) document.getElementById('set-userName').textContent = namePart;
  if(document.getElementById('set-userRole')) document.getElementById('set-userRole').textContent = roleDisplayText;
  if(document.getElementById('set-userEmail')) document.getElementById('set-userEmail').textContent = userEmail;

  // 3. DASHBOARD STATS (Actual Fix Yahan Hai)
  if(document.getElementById('userInfo')) document.getElementById('userInfo').textContent = userEmail;
  if(document.getElementById('roleBadge')) document.getElementById('roleBadge').textContent = currentRole.toUpperCase();
  if(document.getElementById('totalProducts')) document.getElementById('totalProducts').textContent = availableOnly;
  
  // 🔥 ASLI FIX: Dashboard Count
  // Hum loadUserData se already merged count (Manual + Coupon) bhej rahe hain.
  // Ab yahan kisi extra logic ki zaroorat nahi, seedha count display karein.
  if(document.getElementById('userKeys')) {
      document.getElementById('userKeys').textContent = actualPurchaseCount;
  }

  // 4. ADMIN SECTION VISIBILITY
  const adminSec = document.getElementById('adminSection');
  const userSec = document.getElementById('userSection');
  
  if(currentRole === 'admin') {
    if(adminSec) adminSec.classList.remove('hidden');
    if(userSec) userSec.classList.add('hidden');
  } else {
    if(adminSec) adminSec.classList.add('hidden');
    if(userSec) userSec.classList.remove('hidden');
  }
}



// ==========================================
// 🔥 FIXED: Sidebar Photo Rendering end
// ==========================================



// ==========================================
//🔥 ALL OTHER FUNCTIONS (UNCHANGED BUT WORKING)
// ==========================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('open')) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
  // Sidebar khulte hi button ko hide kar denge
  document.getElementById('menuBtn').style.display = 'none';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
  
  // Sidebar band hone par check karenge ki kya hum dashboard par hain
  const currentSection = document.querySelector('.card:not(.hidden)')?.id;
  handleMenuButton(currentSection);
}

// Naya Simple Helper: Sirf Dashboard check karne ke liye
function handleMenuButton(id) {
  const menuBtn = document.getElementById('menuBtn');
  if (!menuBtn) return;

  // Condition: Sirf 'dashboard' section par dikhe, baaki sab par hide
  if (id === 'dashboard') {
    menuBtn.style.setProperty('display', 'flex', 'important');
    menuBtn.classList.remove('hidden');
  } else {
    menuBtn.style.setProperty('display', 'none', 'important');
  }
}

function showSection(id, fromNav = false) {
    closeSidebar();
    
    // 1. Login Page Check
    if (id === 'lock') {
        document.body.classList.add('login-mode');
    } else {
        document.body.classList.remove('login-mode');
    }

    // 2. Section visibility (Safe hide)
    document.querySelectorAll('.card').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    // 3. Menu Button visibility
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) {
        menuBtn.style.display = (id === 'dashboard' && window.innerWidth < 768) ? 'flex' : 'none';
    }

    // 🔥 4. NAV HIGHLIGHT - NO ID MISMATCH FIX
    // Pehle saare buttons se active class hatao
    const navButtons = document.querySelectorAll('#mobileBottomNav button');
    navButtons.forEach(btn => btn.classList.remove('nav-active'));

    // Sahi button dhundne ka sabse safe tarika:
    navButtons.forEach(btn => {
        // Agar button ke onclick text mein wo 'id' hai, toh usse active kar do
        if (btn.getAttribute('onclick').includes(`'${id}'`)) {
            btn.classList.add('nav-active');
        }
    });
  
    // 5. Data Render Calls (Aapka original logic)
    if(id === 'products') renderProductsList();
    if(id === 'mykeys') renderMyKeys();
    if(id === 'manageUsers') loadUserManagement();
    if(id === 'manageProducts') loadProductManagement();
    if(id === 'verifyTransactions') loadPendingTransactions();
}



function notify(msg, type = 'success') {
    const n = document.getElementById("notify");
    if (!n) return;

    // 1. Icon aur Message set karein
    const icon = type === 'success' ? '✅' : '❌';
    n.innerHTML = `<div style="display:flex; align-items:center; gap:12px;">
                     <span style="font-size:1.2rem;">${icon}</span>
                     <span>${msg}</span>
                   </div>`;

    // 2. Class apply karein
    n.className = type === 'success' ? 'notify-success' : 'notify-error';

    // 3. Animation: Niche se upar slide hona
    n.style.display = "block";
    n.style.opacity = "0";
    n.style.transform = "translateY(-20px)";

    setTimeout(() => {
        n.style.opacity = "1";
        n.style.transform = "translateY(0)";
    }, 10);

    // 4. Auto-hide logic (4 second baad)
    setTimeout(() => {
        n.style.opacity = "0";
        n.style.transform = "translateY(-20px)";
        setTimeout(() => {
            n.style.display = "none";
        }, 300);
    }, 4000);
}


function showBroadcast(title, message) {
  document.getElementById('broadcastTitle').textContent = title;
  document.getElementById('broadcastMessage').textContent = message;
  document.getElementById('broadcastPopup').classList.add('show');
}

function closeBroadcast() {
  document.getElementById('broadcastPopup').classList.remove('show');
}








function showLoginType(type) {
  ['userLogin','adminLogin','userSignup','userForgot'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(type === 'user' ? 'userLogin' : 'adminLogin').classList.remove('hidden');
}

async function userLogin() {
  try {
    await auth.signInWithEmailAndPassword(
      document.getElementById('userEmail').value, 
      document.getElementById('userPassword').value
    );
  } catch(err) {
    document.getElementById('msg').textContent = err.message;
    document.getElementById('msg').className = 'bad';
  }
}

async function adminLogin() {
  try {
    await auth.signInWithEmailAndPassword(
      document.getElementById('adminEmail').value, 
      document.getElementById('adminPassword').value
    );
  } catch(err) {
    document.getElementById('msg').textContent = 'Admin login failed!';
    document.getElementById('msg').className = 'bad';
  }
}

async function userSignup() {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(
      document.getElementById('signupEmail').value, 
      document.getElementById('signupPassword').value
    );
    await db.collection('users').doc(userCredential.user.uid).set({
      email: document.getElementById('signupEmail').value,
      role: 'user',
      purchasedProducts: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    notify('Account created successfully!');
  } catch(err) {
    document.getElementById('msg').textContent = err.message;
    document.getElementById('msg').className = 'bad';
  }
}

async function forgotPassword() {
  try {
    await auth.sendPasswordResetEmail(document.getElementById('forgotEmail').value);
    notify('Reset email sent!');
  } catch(err) {
    document.getElementById('msg').textContent = err.message;
    document.getElementById('msg').className = 'bad';
  }
}
async function updateUserPassword() {
  const currPass = document.getElementById('currPass').value;
  const newPass = document.getElementById('newPass').value;
  const reNewPass = document.getElementById('reNewPass').value;
  const user = firebase.auth().currentUser;

  if (!currPass || !newPass || !reNewPass) return notify('❌ Fill all fields!', 'error');
  if (newPass !== reNewPass) return notify('❌ Passwords do not match!', 'error');
  if (newPass.length < 6) return notify('❌ Min 6 characters required!', 'error');

  try {
    // Re-verify the user
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currPass);
    await user.reauthenticateWithCredential(credential);

    // Update to new password
    await user.updatePassword(newPass);

    notify('Password Changed!', 'success');
    
    // Clear the form
    document.getElementById('currPass').value = '';
    document.getElementById('newPass').value = '';
    document.getElementById('reNewPass').value = '';

  } catch (error) {
    if (error.code === 'auth/wrong-password') {
      notify('❌ Current password wrong!', 'error');
    } else {
      notify('❌ Failed: ' + error.message, 'error');
    }
  }
}


// ==========================================
// -- glass effects 
// ==========================================
function toggleGlassMode() {
    const isChecked = document.getElementById('glassToggle').checked;
    
    if (isChecked) {
        document.body.classList.add('glass-mode');
        localStorage.setItem('theme', 'glass'); // Save preference
    } else {
        document.body.classList.remove('glass-mode');
        localStorage.setItem('theme', 'dark');
    }
}

// Page load par check karein ki user ne pehle kya select kiya tha
window.onload = function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'glass') {
        document.getElementById('glassToggle').checked = true;
        document.body.classList.add('glass-mode');
    }
};

// ==========================================
// -- glass effects end
// ==========================================



// 1. Logout Function
function logout() {
  auth.signOut().then(() => {
    location.reload(); 
  }).catch((err) => {
    console.error("Logout Error:", err);
  });
  closeSidebar();
}



// 🔥 MODIFIED: Auto-recreate user if deleted from Firestore
// Variable ko script mein sabse upar (onAuthStateChanged ke bahar) rakhein
let couponListenerStarted = false; 

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    
    const userDocRef = db.collection('users').doc(user.uid);
    let userDoc = await userDocRef.get();
    
    // 1. User Record Check & Creation
    if (!userDoc.exists) {
      console.log("Re-creating missing user record...");
      const newUserData = {
        email: user.email,
        role: 'user',
        purchasedProducts: [], 
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        timer: { isRunning: false, savedRemaining: 72 * 60 * 60 * 1000, totalBase: 72 * 60 * 60 * 1000 }
      };
      await userDocRef.set(newUserData);
    }

    // 2. --- COUPON AUTO-LOAD ---
    if (!couponListenerStarted) {
        loadActiveCoupons();
        couponListenerStarted = true;
    }

    // 3. --- REAL-TIME SYNC ---
    userDocRef.onSnapshot((doc) => {
      const userData = doc.data();
      if (userData) {
          if (userData.timer) syncUserTimer(userData.timer);
          
          // ✅ FIX: updateDashboard hata diya, loadUserData call kiya
          // Isse count hamesha sync rahega
          loadUserData(); 
      }
    });

    // 4. App Initialization
    await loadUserData();
    unlockApp();
    if (typeof checkBroadcasts === 'function') checkBroadcasts();    
    
  } else {
    showLockScreen();     
    if(typeof timerInterval !== 'undefined') clearInterval(timerInterval); 
    couponListenerStarted = false;
  }
});

// ✅ Error Backup: Agar code mein kahin aur updateDashboard call ho raha ho
// toh ye function error aane se rokega
function updateDashboard() {
    loadUserData();
}





// 3. App Unlock logic
function unlockApp() {
  document.body.classList.remove('login-mode');
  document.getElementById('lock').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  showSection('dashboard');
}

// 4. Lock Screen logic
function showLockScreen() {
  document.body.classList.add('login-mode');
  document.getElementById('lock').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  showLoginType('user');
}

// 5. Broadcast Popup Band karne ka function
function closeBroadcast() {
  const popup = document.getElementById('broadcastPopup');
  popup.style.display = 'none';
  popup.classList.remove('show');
}

// 6. User Signup/Forgot Password toggles
function showUserSignup() {
  document.getElementById('userSignup').classList.remove('hidden');
  document.getElementById('userLogin').classList.add('hidden');
}

function showUserForgot() {
  document.getElementById('userForgot').classList.remove('hidden');
  document.getElementById('userLogin').classList.add('hidden');
}



// ==========================================
// 2.--- MODAL FUNCTIONS (FIXED) --- 
// ==========================================

function handleUPIPayment() {
    const upiId = "igrishu2024@okaxis"; 
    const storeName = "Xiaomi Accounts Store";

    // Debugging ke liye alert (Check karne ke liye ki function chal raha hai)
    console.log("Paying Amount:", currentProductPrice);

    if (!currentProductPrice || currentProductPrice <= 0) {
        alert("❌Error: Price zero hai! Please product ko phir se select karein.");
        return;
    }

    // UPI Link
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(storeName)}&am=${currentProductPrice}&cu=INR`;

    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        // Mobile par app kholne ki koshish karega
        window.location.href = upiLink;
        
        setTimeout(() => {
    // Alert ki jagah Toast dikhayega
    var x = document.getElementById("toast");
    x.className = "show";
    
    // 5 second baad toast apne aap gayab ho jayega
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 4000);
}, 1000);

    } else {
        alert("Desktop par UPI Apps nahi khulte. Please phone se QR scan karein.");
    }
}


// --- MODAL FUNCTIONS (FIXED) ---

// Ye function 'Buy Now' click karne par modal kholega
function openQRModal(price, productId) {
    currentProductPrice = parseFloat(price);
    currentQRProduct = productId;
    
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'flex';
        // Input box ko khali kar dega naye transaction ke liye
        document.getElementById('transactionId').value = '';
    }
}

// Ye 'X' button click karne par modal band karega
function closeQRModal() {
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Ye Submit button ke liye hai (Firebase mein data jayega)

async function submitTransaction() {
    const txInput = document.getElementById('transactionId');
    const txId = txInput ? txInput.value.trim() : "";
    const sound = document.getElementById("successPing");

    if (!currentQRProduct) {
        alert("❌ Error: First Select Xaiomi Account ! then click Buy now");
        return;
    }
    if (!txId) {
        alert("❌ UTR / Transaction ID daalna zaroori hai.");
        return;
    }

    try {
        // Firebase Firestore mein entry
        await db.collection('pendingTransactions').add({
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            transactionId: txId,
            productId: currentQRProduct,
            amount: currentProductPrice,
            status: 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 🔥 Sound Play Karo
        if (sound) {
            sound.currentTime = 0; 
            sound.play().catch(e => console.log("Sound block:", e));
        }

        // 📱 Mobile Vibration (200ms)
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

        alert("✅ Success! Admin 5m mein aprove kar dega");
        closeQRModal(); 
        showSection('mykeys');

    } catch (error) {
        alert("❌ Error: " + error.message);
    }
}


// ==========================================
// 2.--- MODAL FUNCTIONS (FIXED) --- END
// ==========================================




// ==========================================
//--- STEP 3: TELEGRAM NOTIFICATION FUNCTION ---
// ==========================================

async function sendTelegramAlert(msg) {
    const token = "7955185832:AAH4_TJyi_P78BFkHnBl32d3CgD4sdZ7Gxo"; // Apna Bot Token yaha dalo
    const chatId = "6931353821";   // Apni Chat ID yaha dalo
    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}&parse_mode=HTML`;
    
    try {
        await fetch(url);
    } catch(err) {
        console.log("Telegram alert failed", err);
    }
}

// --- STEP 6: FIREWORKS (CONFETTI) FUNCTION ---
function launchFireworks() {
    var duration = 3 * 1000;
    var end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#6d7cff', '#6dff9a', '#ffffff']
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#6d7cff', '#6dff9a', '#ffffff']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

// --- UPDATED SUBMIT FUNCTION ---
async function submitTransaction() {
    const txInput = document.getElementById('transactionId');
    const txId = txInput ? txInput.value.trim() : "";
    const sound = document.getElementById("successPing");

    if (!currentQRProduct || !txId) {
        alert("❌ Error: Missing details!");
        return;
    }

    try {
        await db.collection('pendingTransactions').add({
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            transactionId: txId,
            productId: currentQRProduct,
            amount: currentProductPrice,
            status: 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 📢 Telegram Alert (Idea 3)
        const alertMsg = `🚀 <b>New Order!</b>\n\n📧 Email: ${auth.currentUser.email}\n💳 UTR: ${txId}\n📦 Product: ${currentQRProduct}\n💰 Amount: ₹${currentProductPrice}`;
        sendTelegramAlert(alertMsg);

        // 🎆 Fireworks (Idea 6)
        launchFireworks();

        // 📱 Sound & Vibration
        if (sound) { sound.currentTime = 0; sound.play(); }
        if (navigator.vibrate) { navigator.vibrate(200); }

        alert("✅ Success! Admin 5m mein aprove kar dega");
        closeQRModal(); 
        showSection('mykeys');

    } catch (error) {
        alert("❌ Error: " + error.message);
    }
}

// ==========================================
// --- STEP 3: TELEGRAM NOTIFICATION FUNCTION --- End
// ==========================================





// ==========================================
// --- YEH LOGIN PAGE STATS KA CODE HAI ---
// ==========================================

async function fetchPublicStats() {
  try {
    // Bina login kiye products ka count lene ke liye
    const snapshot = await db.collection('products').get();
    let available = 0;
    let sold = 0;

    snapshot.forEach(doc => {
      if (doc.data().isSoldOut === true) {
        sold++;
      } else {
        available++;
      }
    });

    // Dashboard IDs ke saath confusion na ho isliye checks lagaye hain
    const stockEl = document.getElementById('loginStock');
    const soldEl = document.getElementById('loginSold');
    
    if(stockEl) stockEl.textContent = available;
    if(soldEl) soldEl.textContent = sold;
    
  } catch (err) {
    console.error("Public Stats Error:", err);
  }
}

// Page load hote hi ise turant chalana hai
fetchPublicStats();

// Har 30 second mein automatic update (Optional)
setInterval(fetchPublicStats, 30000); 

// ==========================================
// --- YEH LOGIN PAGE STATS KA CODE HAI ---END
// ==========================================



// Admin functions
async function giveManualAccess() {
  if (userRole !== 'admin') {
    notify('❌Admin only!', 'error');
    return;
  }
  const userEmail = document.getElementById('manualUserEmail').value.trim();
  const productId = document.getElementById('manualProductId').value.trim();
  if (!userEmail || !productId) {
    notify('❌Enter both email & product ID!', 'error');
    return;
  }
  try {
    const usersSnapshot = await db.collection('users').where('email', '==', userEmail).get();
    if (usersSnapshot.empty) {
      notify('❌User not found!', 'error');
      return;
    }
    const userDoc = usersSnapshot.docs[0];
    await db.collection('users').doc(userDoc.id).update({
      purchasedProducts: firebase.firestore.FieldValue.arrayUnion(productId)
    });
    // Mark product as sold out
    await db.collection('products').doc(productId).update({
      isSoldOut: true,
      soldAt: firebase.firestore.FieldValue.serverTimestamp(),
      soldTo: userDoc.id
    });
    notify(`Access granted to ${userEmail}!`, 'success');
    document.getElementById('manualUserEmail').value = '';
    document.getElementById('manualProductId').value = '';
    renderProductsList();
  } catch (err) {
    notify('❌ Failed to grant access!', 'error');
  }
}

// 🔥 PERFECTLY FIXED - NO MORE "Error loading users"
async function loadUserManagement() {
  if (userRole !== 'admin') return notify('❌Admin only!', 'error');
  
  try {
    document.getElementById('userManagementList').innerHTML = 'Loading users...';
    
    // 1. Users aur Transactions dono ka data fetch karein
    const [userSnapshot, transSnapshot] = await Promise.all([
      db.collection('users').get(),
      db.collection('pendingTransactions').get() // Humne status filter hata diya taaki sab fetch ho
    ]);
    
    const allTransactions = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort: New users first
    const sortedUsers = userSnapshot.docs.sort((a, b) => {
      const dateA = a.data().createdAt?.toMillis() || 0;
      const dateB = b.data().createdAt?.toMillis() || 0;
      return dateB - dateA;
    });
    
    let html = '';
    sortedUsers.forEach(doc => {
      const u = doc.data();
      const userId = doc.id;
      const regDate = u.createdAt ? new Date(u.createdAt.toDate()).toLocaleDateString('en-GB') : 'N/A';
      
      // ✅ FIX: Transactions aur Array dono ka combination use karein
      // Pehle Transactions table se completed gino
      const transCount = allTransactions.filter(t => t.userId === userId && t.status === 'completed').length;
      // Phir backup ke liye purane profile array ki length dekho agar transactions 0 hain
      const arrayCount = u.purchasedProducts ? u.purchasedProducts.length : 0;
      
      // Jo zyada ho wahi asli count hai (Purana data + Naya data merge)
      const purchaseCount = Math.max(transCount, arrayCount);
      
      const userRoleColor = u.role === 'admin' ? '#ff6b35' : '#6dff9a';
      
      html += `
        <div class="item" style="
          background: linear-gradient(145deg, #1e244a, #15193a);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 12px 15px;
          margin: 10px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        ">
          <div style="flex: 1; overflow: hidden; margin-right: 10px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
              <b style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff;">
                ${u.email}
              </b>
              <span style="color: ${userRoleColor}; font-size: 9px; font-weight: 800; text-transform: uppercase;">
                [${u.role || 'user'}]
              </span>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <small style="font-size: 10px; color: #a5b1ff; opacity: 0.8;">📅 Registered: ${regDate}</small>
              <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                <span style="font-size: 10px; background: rgba(109,124,255,0.2); color: #6d7cff; padding: 2px 8px; border-radius: 20px; font-weight: bold; border: 1px solid rgba(109,124,255,0.3);">
                  🛒 Purchased: ${purchaseCount}
                </span>
              </div>
            </div>
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button class="manual-verify" onclick="viewUserHistory('${userId}', '${u.email}')" 
              style="width: 38px; height: 38px; min-width: 38px; border-radius: 12px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; background: #ffeb3b; border: none; cursor: pointer;" title="History">
              👁️
            </button>
            <button class="danger" onclick="deleteUser('${userId}')" 
              style="width: 38px; height: 38px; min-width: 38px; border-radius: 12px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; background: #ff4444; border: none; cursor: pointer;" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      `;
    });
    
    document.getElementById('userManagementList').innerHTML = html;
    document.getElementById('usersCount').textContent = userSnapshot.size;
    
  } catch(err) {
    console.error(err);
    notify('❌ Error loading users', 'error');
  }
}



// ==========================================
// --- User Ka History View Karne Ke liye---
// ==========================================

async function viewUserHistory(userId, userEmail) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data() || {};
        const registrationDate = userData.createdAt ? 
            new Date(userData.createdAt.toDate()).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown';
        
        const purchasedIds = userData.purchasedProducts || [];
        const txSnapshot = await db.collection('pendingTransactions').where('userId', '==', userId).get();
        const productsSnapshot = await db.collection('products').get();
        const allProducts = {};
        productsSnapshot.forEach(doc => { allProducts[doc.id] = doc.data(); });

        let html = `<h4>📜 History for: ${userEmail}</h4>`;
        
        
        html += `
            <div style="background:rgba(109,124,255,0.1); padding:12px; border-radius:10px; margin-bottom:15px; border:1px solid #6d7cff; text-align:center;">
                <span style="color:#6dff9a; font-weight:bold;">📅 Joined On:</span> ${registrationDate}
            </div>
            <button class="action" onclick="showSection('manageUsers')" style="margin-bottom:15px; width:100%;">⬅️ Back to Users List</button>
        `;

        const txProductIds = new Set();

        // PART A: Transactions (UTR, Date, Time, Amount)
        if (!txSnapshot.empty) {
            const sorted = txSnapshot.docs.sort((a,b) => (b.data().submittedAt?.toMillis() || 0) - (a.data().submittedAt?.toMillis() || 0));
            sorted.forEach(doc => {
                const tx = doc.data();
                txProductIds.add(tx.productId);
                const pInfo = allProducts[tx.productId] || { name: "Xiaomi Acc" };
                const dateObj = tx.submittedAt ? tx.submittedAt.toDate() : null;
                const dateStr = dateObj ? dateObj.toLocaleDateString('en-GB') : 'N/A';
                const timeStr = dateObj ? dateObj.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}) : '';
                const color = tx.status === 'verified' ? '#6dff9a' : (tx.status === 'rejected' ? '#ff4444' : '#ffeb3b');

                html += `
                <div class="item" style="border-left: 4px solid ${color}; margin-bottom:15px; padding:15px; background:rgba(255,255,255,0.02); border-radius:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <b style="color:#fff;">📦 ${pInfo.name}</b>
                        <b style="color:${color}">${tx.status.toUpperCase()}</b>
                    </div>
                    <div style="font-size:12px; line-height:1.6; color:#ddd;">
                        📅 Date: ${dateStr} | ⏰ Time: ${timeStr}<br>
                        💳 UTR: <span style="font-family:monospace; color:#fff;">${tx.transactionId}</span><br>
                        💰 Amount: <span style="color:#6dff9a;">₹${tx.amount || '0'}</span><br>
                        🆔 ID: ${tx.productId}
                    </div>
                    <div style="margin-top:12px;">
                        <button class="danger" style="width:100%; padding:10px; background:#ff4444; border-radius:8px; border:none; color:#fff; font-weight:bold; cursor:pointer;" 
                        onclick="deleteTransaction('${doc.id}', '${userId}', '${userEmail}')">🗑️Delete& Remove Access</button>
                    </div>
                </div>`;
            });
        }

        // PART B: Direct Access (Gifted)
        // PART B: Direct Access (Gifted) - Inside viewUserHistory
purchasedIds.forEach(pId => {
    if (!txProductIds.has(pId)) {
        const pInfo = allProducts[pId] || { name: "Gifted Account" };
        html += `
        <div class="item" style="border-left: 4px solid #6d7cff; background: rgba(109,124,255,0.05); margin-bottom:15px; padding:15px; border-radius:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <b style="color:#fff;">📦 ${pInfo.name}</b>
                <b style="color:#6d7cff; font-size:12px; border:1px solid #6d7cff; padding:2px 6px; border-radius:4px;">DIRECT ACCESS👑</b>
            </div>
            <div style="font-size:12px; margin:10px 0; color:#aaa;">
                🆔 <b>Product ID:</b> ${pId}<br>
                🎁 <b>Type:</b> Administrator Gift
            </div>
            <button class="danger" style="width:100%; padding:10px; background:#e67e22; border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer;" 
            onclick="revokeDirectAccess('${userId}', '${pId}', '${userEmail}')">⚠️Remove Access</button>
        </div>`;
    }
});


        document.getElementById('userManagementList').innerHTML = html;
    } catch (err) { console.error(err); notify('❌ Error', 'error'); }
}

async function deleteTransaction(docId, userId, userEmail) {
    if (!confirm("Warning: Delete history and remove user access?")) return;

    try {
        const txDoc = await db.collection('pendingTransactions').doc(docId).get();
        
        if (txDoc.exists) {
            const txData = txDoc.data();
            const pId = txData.productId;

            // 🔥 BUG FIX: Status chahe 'verified' ho ya 'completed' (Coupon wala), access remove hona chahiye
            const successfulStatuses = ['verified', 'completed', 'success'];
            
            if (successfulStatuses.includes(txData.status)) {
                // 1. User ke array se ID nikalo
                await db.collection('users').doc(userId).update({
                    purchasedProducts: firebase.firestore.FieldValue.arrayRemove(pId)
                });

                // 2. OPTIONAL: Product ko wapas 'available' mark karein agar aap chahte hain
                await db.collection('products').doc(pId).update({
                    status: 'available',
                    isSoldOut: false,
                    buyerEmail: null,
                    soldTo: null
                });
            }
        }

        // 3. Transaction record uda do
        await db.collection('pendingTransactions').doc(docId).delete();
        
        notify('History & Access Deleted!', 'success');
        
        // Refresh the history view
        viewUserHistory(userId, userEmail); 
        
    } catch (err) {
        console.error("Delete Error:", err);
        notify('❌ Delete Failed', 'error');
    }
}





// Function to delete specific history entry
async function revokeDirectAccess(userId, productId, userEmail) {
    if (!confirm("Are you sure you want to remove this product?")) return;

    try {
        // Access remove karein
        await db.collection('users').doc(userId).update({
            purchasedProducts: firebase.firestore.FieldValue.arrayRemove(productId)
        });

        // Product ko wapas list mein layein
        await db.collection('products').doc(productId).update({
            status: 'available',
            isSoldOut: false,
            buyerEmail: null,
            soldTo: null
        });

        notify('Access Remove&Account Restored', 'success');
        viewUserHistory(userId, userEmail); 
    } catch (err) {
        notify('❌ Revoke Failed', 'error');
    }
}




// 🔥 UPDATED: Admin can now see WHO bought the product
async function loadProductManagement() {
  try {
    document.getElementById('productManagementList').innerHTML = 'Loading products...';
    
    const [prodSnapshot, userSnapshot] = await Promise.all([
      db.collection('products').get(),
      db.collection('users').get()
    ]);

    const userMap = {};
    userSnapshot.forEach(doc => { userMap[doc.id] = doc.data().email; });

    let products = prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if(products.length === 0) {
      document.getElementById('productManagementList').innerHTML = '<p style="text-align:center; opacity:0.5;">No products found</p>';
      return;
    }

    // 🔥 SORTING LOGIC: Available upar (Active), Sold niche
    products.sort((a, b) => {
      if (a.isSoldOut !== b.isSoldOut) {
        return a.isSoldOut ? 1 : -1; // false (Active) pehle, true (Sold) baad mein
      }
      // Agar dono same status ke hain toh naya wala upar
      return (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0);
    });

    let html = '';
    products.forEach(p => {
      const isSold = p.isSoldOut || false;
      
      // Date Formatting
      let dateStr = "New";
      if (p.submittedAt) {
          const d = p.submittedAt.toDate();
          dateStr = d.toLocaleDateString('en-GB') + " " + d.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit', hour12: true});
      }

      const buyerEmail = isSold && p.soldTo ? (userMap[p.soldTo] || "Unknown User") : null;

      // --- PREMIUM SIMPLE DESIGN ---
      html += `
        <div style="
          background: #1a1f3c; 
          border: 1px solid ${isSold ? 'rgba(255, 68, 68, 0.2)' : 'rgba(109, 255, 154, 0.2)'};
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 15px;
          position: relative;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h3 style="margin: 0; font-size: 16px; color: #fff; letter-spacing: 0.5px;">${p.name}</h3>
              <div style="font-size: 10px; color: #6d7cff; margin-top: 4px; opacity: 0.8;">ID: ${p.id}</div>
            </div>
            <div style="
              background: ${isSold ? 'rgba(255, 68, 68, 0.1)' : 'rgba(109, 255, 154, 0.1)'};
              color: ${isSold ? '#ff4444' : '#6dff9a'};
              padding: 5px 12px;
              border-radius: 20px;
              font-size: 9px;
              font-weight: 800;
              border: 1px solid ${isSold ? 'rgba(255, 68, 68, 0.2)' : 'rgba(109, 255, 154, 0.2)'};
              display: flex; align-items: center; gap: 4px;
            ">
              <span style="font-size: 12px;">●</span> ${isSold ? 'SOLD OUT' : 'ACTIVE'}
            </div>
          </div>

          <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 12px;">
             <span style="color: #bbb;">Price: <b style="color: #6dff9a;">₹${p.price}</b></span>
             <span style="color: #bbb;">Key: <b style="color: #ffeb3b;">${p.key || '@notset'}</b></span>
          </div>
          <div style="color: #555; font-size: 10px; margin-top: 6px;">📅 Added on: ${dateStr}</div>

          ${isSold ? `
            <div style="margin-top: 15px; padding: 12px; background: rgba(255,68,68,0.05); border-radius: 12px; border: 1px dashed rgba(255,68,68,0.3);">
              <div style="color: #ff8a8a; font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">👤BOUGHT BY</div>
              <div style="color: #fff; font-size: 12px; opacity: 0.9;">${buyerEmail}</div>
            </div>
          ` : ''}

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px;">
            <button onclick="editProduct('${p.id}','${p.name}','${p.loginId}','${p.key}',${p.price})" style="
              background: transparent;
              color: #6d7cff;
              border: 1px solid rgba(109, 124, 255, 0.4);
              padding: 10px;
              border-radius: 12px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              display: flex; align-items: center; justify-content: center; gap: 6px;
            ">✏️Edit</button>
            
            <button onclick="deleteProduct('${p.id}')" style="
              background: transparent;
              color: #ff4444;
              border: 1px solid rgba(255, 68, 68, 0.4);
              padding: 10px;
              border-radius: 12px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              display: flex; align-items: center; justify-content: center; gap: 6px;
            ">🗑️Delete</button>
          </div>
        </div>`;
    });
    
    document.getElementById('productManagementList').innerHTML = html;
    document.getElementById('productsCount').textContent = products.length;
  } catch(err) {
    console.error(err);
    document.getElementById('productManagementList').innerHTML = '<p style="color:#ff4444; text-align:center;">Error loading list</p>';
  }
}




async function addProduct() {
  const name = document.getElementById('productName').value;
  const accessId = document.getElementById('productAccessId').value;
  const key = document.getElementById('productKey').value;
  const price = parseInt(document.getElementById('productPrice').value);

  if (!name || !accessId || !key || !price) {
    return notify('Fill all fields!', 'error');
  }

  try {
    if (editingProductId) {
      // 🔥 Edit karte waqt bhi timestamp update hoga (Optional)
      await db.collection('products').doc(editingProductId).update({
        name, loginId: accessId, key, price,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp() 
      });
      notify(' Product updated!');
      editingProductId = null;
    } else {
      // 🔥 Naya product add karte waqt server date
      await db.collection('products').add({
        name: name, 
        loginId: accessId, 
        key: key, 
        price: price, 
        isSoldOut: false,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp() 
      });
      notify(' Product added!');
    }

    // Inputs Clear karein
    document.getElementById('productName').value = 'Xiaomi Account';
    document.getElementById('productAccessId').value = '';
    document.getElementById('productKey').value = '@helproot';
    document.getElementById('productPrice').value = '1000';

    loadProductManagement(); // Turant list refresh karein
  } catch (err) {
    notify('Error adding product!', 'error');
  }
}




function editProduct(productId, name, accessId, key, price) {
  editingProductId = productId;
  document.getElementById('productName').value = name;
  document.getElementById('productAccessId').value = accessId;
  document.getElementById('productKey').value = key;
  document.getElementById('productPrice').value = price;
  showSection('addProduct');
  notify(`Editing: ${name}`);
}

async function deleteUser(userId) {
  if(!confirm('Delete this user?')) return;
  try {
    await db.collection('users').doc(userId).delete();
    notify(' User deleted!');
    loadUserManagement();
  } catch(err) {
    notify('Delete failed!', 'error');
  }
}

async function deleteProduct(productId) {
  if(!confirm('Delete this product?')) return;
  try {
    await db.collection('products').doc(productId).delete();
    notify(' Product deleted!');
    loadProductManagement();
    loadUserData();
    renderProductsList();
  } catch(err) {
    notify('Delete failed!', 'error');
  }
}


function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // 1. Alert ya Toast dikhao
        alert(" Copied to Clipboard!");

        // 2. Haptic Feedback (Vibration) - Sirf Mobile par kaam karega
        if (navigator.vibrate) {
            navigator.vibrate(50); // 50ms ka halka vibration
        }
    });
}

// ==========================================
// -- whatsapp floting 
// ==========================================

const dragElement = document.getElementById("draggableWA");
let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

dragElement.ontouchstart = dragMouseDown; // For Mobile
dragElement.onmousedown = dragMouseDown;  // For PC

function dragMouseDown(e) {
    e = e || window.event;
    // e.preventDefault(); // Click handle karne ke liye ise hataya hai

    // Get current position
    if (e.type === 'touchstart') {
        pos3 = e.touches[0].clientX;
        pos4 = e.touches[0].clientY;
    } else {
        pos3 = e.clientX;
        pos4 = e.clientY;
    }

    document.onmouseup = closeDragElement;
    document.ontouchend = closeDragElement;
    
    document.onmousemove = elementDrag;
    document.ontouchmove = elementDrag;
}

function elementDrag(e) {
    e = e || window.event;
    
    let clientX, clientY;
    if (e.type === 'touchmove') {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // Calculate new position
    pos1 = pos3 - clientX;
    pos2 = pos4 - clientY;
    pos3 = clientX;
    pos4 = clientY;

    // Set element's new position
    let newTop = dragElement.offsetTop - pos2;
    let newLeft = dragElement.offsetLeft - pos1;

    // Screen ke bahar na jaye uske liye checks
    if (newTop > 0 && newTop < (window.innerHeight - 50)) {
        dragElement.style.top = newTop + "px";
        dragElement.style.bottom = "auto";
    }
    if (newLeft > 0 && newLeft < (window.innerWidth - 150)) {
        dragElement.style.left = newLeft + "px";
        dragElement.style.right = "auto";
    }
}

function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    document.ontouchend = null;
    document.ontouchmove = null;
}
// ==========================================
// -- whatsapp floting end
// ==========================================



// ==========================================
// -- Fake Sales Data
// ==========================================

const fakeSales = [
    "Someone from Delhi just bought Xiaomi Acc-29! ⚡",
    "New order received from Kolkata! ✅",
    "User 'Ankit***' just unlocked a bootloader! 🔑",
    "Someone from Punjab just paid ₹1000! 💰",
    "Xiaomi Premium Account sold 2 mins ago! 🔥",
    "User 'Vikram_99' just purchased Redmi Note 13 Pro Account! 📱",
    "Someone from Mumbai just sent payment for 2 Accounts! ✅",
    "Order verified for 'Suresh***' from Bangalore! ⚡",
    "New sale from Hyderabad! Xiaomi Acc-25 delivered! ✅",
    "User 'Rahul_Mi' just successfully unlocked! 🔑",
    "Someone from Chennai just bought Premium Access! 🔥",
    "New order from Pune! Payment of ₹1500 received! 💰",
    "User 'Soni_***' from Jaipur just got their login! ✅",
    "Someone from Ahmedabad just bought a Bulk Pack! ⚡",
    "User 'Deepak_root' just unlocked Redmi 12 5G! 🔑",
    "New sale in Lucknow! Xiaomi Acc-29 gone! 🔥",
    "Someone from Patna just joined the Premium membership! ✅",
    "User 'Arun_V' from Kerala just paid! Order pending! 💰",
    "Xiaomi Acc-30 sold to 'Imran***' from Bhopal! ⚡",
    "Someone from Surat just bought 3 Accounts at once! 🔥",
    "User 'Pooja_***' from Odisha just unlocked her phone! 🔑",
    "New order from Guwahati! Payment of ₹1000 verified! ✅",
    "Someone from Chandigarh just bought the High Quality Acc! ⚡",
    "User 'Nitin_X' from Indore just received credentials! 🔥",
    "Order completed for 'Rohan***' from Nagpur! ✅"
];
function showFakeSale() {
    const popup = document.createElement('div');
    // CSS Styling (Glassmorphism look add kiya hai)
    popup.style = `
        position: fixed; bottom: 85px; left: 15px; 
        background: rgba(30, 33, 58, 0.9); color: white;
        padding: 14px 18px; border-radius: 16px;
        font-size: 13px; font-weight: 500;
        border: 1px solid rgba(255,255,255,0.1);
        border-left: 5px solid #6d7cff;
        box-shadow: 0 15px 35px rgba(0,0,0,0.4);
        z-index: 10000; transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        opacity: 0; transform: translateY(20px);
        backdrop-filter: blur(12px);
    `;
    
    popup.innerText = fakeSales[Math.floor(Math.random() * fakeSales.length)];
    document.body.appendChild(popup);

    // Animation: Upar aate hue dikhega
    setTimeout(() => { 
        popup.style.opacity = "1"; 
        popup.style.transform = "translateY(0)";
    }, 100);

    // Remove logic
    setTimeout(() => {
        popup.style.opacity = "0";
        popup.style.transform = "translateY(-10px)";
        setTimeout(() => { popup.remove(); }, 600);
    }, 5000); 

    // Agla popup kab aayega? (Randomly 15 se 45 sec ke beech)
    let nextTime = Math.random() * (45000 - 15000) + 15000;
    setTimeout(showFakeSale, nextTime);
}

// First time start karne ke liye
setTimeout(showFakeSale, 5000); 

// ==========================================
// -- Fake Sales Data End
// ==========================================



// ==========================================
// -- Automatic suggest 
// ==========================================

const techTips = [
    "Tip: Use original USB cables for stable fastboot connection. 🔌",
    "Fact: HyperOS unlocking requires your Mi Account to be active for 3 days. ⏳",
    "Security: Always backup your data before unlocking, it will be wiped! ⚠️",
    "Note: If UTR verification fails, wait 5 mins and try again. 🔄",
    "Pro Tip: Keep your battery above 50% during the unlocking process. 🔋",
    "Status: All premium accounts are 100% verified and ready. ✅"
];

function updateDashboardTip() {
    const tipElement = document.getElementById('dynamic-tip');
    if (tipElement) {
        // Halka fade out effect ke liye opacity 0 karein
        tipElement.style.opacity = 0;
        
        setTimeout(() => {
            const randomTip = techTips[Math.floor(Math.random() * techTips.length)];
            tipElement.innerText = `"${randomTip}"`;
            // Waapas dikhane ke liye opacity 1
            tipElement.style.opacity = 1;
        }, 500);
    }
}

// Fade effect ke liye CSS transition add karein
document.getElementById('dynamic-tip').style.transition = "opacity 0.5s ease";

// Har 12 second mein tip change karein
setInterval(updateDashboardTip, 12000);

// ==========================================
// -- Automatic suggest end
// ==========================================




// ==========================================
// -- SYNC Timmer WITH FIREBASE ---
// ==========================================

// Global Variable
let timerInterval = null;
const DEFAULT_MS = 72 * 60 * 60 * 1000;

function syncUserTimer(timerData) {
    clearInterval(timerInterval);
    const startBtn = document.getElementById("timerBtn");

    if (timerData.isRunning && timerData.endTime) {
        if (startBtn) startBtn.style.display = "none";
        
        // Live calculation from Server EndTime
        timerInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = timerData.endTime - now;

            if (distance <= 0) {
                clearInterval(timerInterval);
                updateClockUI(0, timerData.totalBase || DEFAULT_MS);
                handleExpiry();
                return;
            }
            updateClockUI(distance, timerData.totalBase || DEFAULT_MS);
        }, 1000);
    } else {
        if (startBtn) startBtn.style.display = "inline-block";
        const displayTime = timerData.savedRemaining || timerData.totalBase || DEFAULT_MS;
        updateClockUI(displayTime, timerData.totalBase || DEFAULT_MS);
    }
}

// --- 2. START TIMER (Save to Firestore) ---
async function toggleTimer() {
    if (!currentUser) return;
    const userRef = db.collection('users').doc(currentUser.uid);
    const doc = await userRef.get();
    const timerData = doc.data().timer || {};

    if (!timerData.isRunning) {
        const duration = timerData.savedRemaining || timerData.totalBase || DEFAULT_MS;
        const endTime = new Date().getTime() + duration;
        
        await userRef.update({
            "timer.isRunning": true,
            "timer.endTime": endTime
        });
        if(window.showToast) showToast("Timer Started! 🚀");
    }
}

// --- 3. STOP TIMER (Save Remaining to Firestore) ---
async function stopTimer() {
    if (!currentUser) return;
    const userRef = db.collection('users').doc(currentUser.uid);
    const doc = await userRef.get();
    const timerData = doc.data().timer;

    if (timerData && timerData.isRunning) {
        const now = new Date().getTime();
        const remaining = Math.max(0, timerData.endTime - now);
        
        await userRef.update({
            "timer.isRunning": false,
            "timer.savedRemaining": remaining,
            "timer.endTime": null
        });
        if(window.showToast) showToast("Timer Paused! ⏸️");
    }
}

// --- 4. RESET & EDIT (For Individual User) ---
async function resetTimer() {
    if (!currentUser) return;
    const userRef = db.collection('users').doc(currentUser.uid);
    const doc = await userRef.get();
    const base = doc.data().timer.totalBase || DEFAULT_MS;

    await userRef.update({
        "timer.isRunning": false,
        "timer.savedRemaining": base,
        "timer.endTime": null
    });
}

async function editTime() {
    const h = prompt("Enter custom hours for your account:", "72");
    if (h && !isNaN(h) && currentUser) {
        const ms = parseInt(h) * 60 * 60 * 1000;
        await db.collection('users').doc(currentUser.uid).update({
            "timer.totalBase": ms,
            "timer.savedRemaining": ms,
            "timer.isRunning": false,
            "timer.endTime": null
        });
        showToast("Access time updated!");
    }
}

// --- 5. UI UPDATE (Line moves based on user's own totalBase) ---
function updateClockUI(distance, totalBase) {
    const h = Math.floor(distance / (1000 * 60 * 60));
    const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((distance % (1000 * 60)) / 1000);
    
    document.getElementById("hrs").innerText = h.toString().padStart(2, '0');
    document.getElementById("mins").innerText = m.toString().padStart(2, '0');
    document.getElementById("secs").innerText = s.toString().padStart(2, '0');
    
    // Percentage Logic for Line
    const progressPercent = (distance / totalBase) * 100;
    const line = document.getElementById("timerProgress");
    if (line) {
        line.style.width = Math.max(0, Math.min(100, progressPercent)) + "%";
        // Color Change
        line.style.background = progressPercent < 15 ? "#ff4444" : "linear-gradient(90deg, #00d4ff, #00ff88)";
    }
}

function toggleSettings() {
    const panel = document.getElementById("settingsPanel");
    const icon = document.getElementById("settingsToggle");
    panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
    icon.innerText = panel.style.display === "flex" ? "❌" : "⚙️";
}

// ==========================================
// -- SYNC Timmer WITH FIREBASE ---END
// ==========================================





// ==========================================
// -- Random Code Generator (Working Fine) ---
// ==========================================

function autoGenerateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    document.getElementById('cpCode').value = 'XIAOMI' + res;
}

// 2. Save to Firestore with all fields
async function saveCouponToDb() {
    const code = document.getElementById('cpCode').value.trim().toUpperCase();
    const value = parseFloat(document.getElementById('cpValue').value);
    const type = document.getElementById('cpType').value;
    const expiry = document.getElementById('cpExpiry').value;
    const limit = parseInt(document.getElementById('cpLimit').value);

    if (!code || isNaN(value)) {
        return alert("Please enter Code and Discount Value!");
    }

    try {
        await db.collection('coupons').add({
            code: code,
            value: value,
            type: type,
            expiryDate: expiry || "No Expiry",
            usageLimit: limit || 9999,
            usedCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("🎉Coupon '" + code + "' Created Successfully!");
        
        // Reset fields
        document.getElementById('cpCode').value = '';
        document.getElementById('cpValue').value = '';
        document.getElementById('cpExpiry').value = '';
        document.getElementById('cpLimit').value = '';
        
        loadActiveCoupons(); // Refresh list
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    }
}

// 3. Load & Display Coupons with better UI
async function loadActiveCoupons() {
    const list = document.getElementById('activeCouponsList');
    if(!list) return;
    
    list.innerHTML = '<p style="text-align:center; color:#555;">Loading coupons...</p>';

    try {
        const snap = await db.collection('coupons').orderBy('createdAt', 'desc').get();
        let html = '';
        
        if(snap.empty) {
            list.innerHTML = '<p style="text-align:center; color:#555; font-size:12px;">No active coupons found.</p>';
            return;
        }

        snap.forEach(doc => {
            const d = doc.data();
            const symbol = d.type === 'fixed' ? '₹' : '%';
            
            html += `
                <div style="background: #15193a; border: 1px solid #2a2f4a; padding: 12px; border-radius: 10px; margin-bottom: 10px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <span style="background: #ffeb3b; color: #000; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">${d.code}</span>
                            <div style="margin-top: 8px; font-size: 14px; color: #fff;">
                                Discount: <b>${d.value}${symbol} Off</b>
                            </div>
                        </div>
                        <button onclick="deleteCoupon('${doc.id}')" style="background: rgba(255,68,68,0.1); color: #ff4444; border: 1px solid #ff4444; border-radius: 5px; padding: 4px 8px; font-size: 10px; cursor: pointer;">DELETE</button>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 15px; font-size: 11px; color: #888; border-top: 1px solid #222; padding-top: 8px;">
                        <span>📅 Exp: ${d.expiryDate}</span>
                        <span>👥 Limit: ${d.usedCount}/${d.usageLimit}</span>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = '<p style="color:red;">Failed to load coupons.</p>';
    }
}

// 4. Delete Function
async function deleteCoupon(id) {
    if(confirm("Are you sure you want to delete this coupon?")) {
        await db.collection('coupons').doc(id).delete();
        loadActiveCoupons();
    }
}
// ==========================================
// --Random Code Generator (Working Fine)---END
// ==========================================
