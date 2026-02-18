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
// Google Provider initialize karein
const googleProvider = new firebase.auth.GoogleAuthProvider();

let currentUser = null, userRole = 'user', userProducts = [], pendingTransactions = [], allProducts = [];
let editingProductId = null, currentQRProduct = null;


// ==========================================
//🔥FIXED BROADCAST - NOW WORKS PERFECTLY
// ==========================================
// 1. Send Broadcast (Unique ID ke saath save karega)
// 1. Send Broadcast
async function sendBroadcast() {
  if (userRole !== 'admin') return notify('❌ Admin access only!', 'error');

  const title = document.getElementById('broadcastTitleInput').value.trim();
  const message = document.getElementById('broadcastMessageInput').value.trim();

  if (!title || !message) return notify('⚠️ Please fill all fields', 'error');

  try {
    await db.collection('broadcasts').add({
      title: title,
      message: message,
      sentAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    notify('🚀 Broadcast Sent Successfully!', 'success');
    
    // Clear & Refresh
    document.getElementById('broadcastTitleInput').value = '';
    document.getElementById('broadcastMessageInput').value = '';
    loadPreviousBroadcasts();
  } catch (error) {
    notify('❌ Failed: ' + error.message, 'error');
  }
}

// 2. Load History with Premium Look
async function loadPreviousBroadcasts() {
  const listDiv = document.getElementById('previousBroadcastsList');
  if (!listDiv) return;

  try {
    // Latest 10 messages fetch karein
    const snapshot = await db.collection('broadcasts').orderBy('sentAt', 'desc').limit(10).get();
    
    if (snapshot.empty) {
      listDiv.innerHTML = '<div style="text-align:center; padding:30px; opacity:0.3; font-size:13px;">No previous broadcasts found</div>';
      return;
    }

    let html = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const time = data.sentAt ? new Date(data.sentAt.toDate()).toLocaleString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'Just now';
      
      html += `
<div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 18px; border-radius: 18px; margin-bottom: 15px; position: relative; transition: 0.3s; border-left: 4px solid #00c6ff;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1; padding-right: 35px; text-align: left;">
            <div style="color: #00c6ff; font-weight: 800; font-size: 14px; margin-bottom: 6px; letter-spacing: 0.5px;">${data.title}</div>
            <p style="margin: 0; font-size: 13px; color: #e0e0e0; line-height: 1.6; opacity: 0.9;">${data.message}</p>
            <div style="margin-top: 10px; font-size: 10px; color: #6dff9a; opacity: 0.7; font-weight: 600;">
                <i class="far fa-clock"></i> ${time}
            </div>
        </div>
        <button onclick="deleteBroadcast('${doc.id}')" 
                style="background: rgba(255,68,68,0.1); border: 1px solid rgba(255,68,68,0.2); color: #ff4444; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; transition: 0.2s;">
            <i class="fas fa-trash-alt" style="font-size: 12px;"></i>
        </button>
    </div>
</div>
`;

    });
    listDiv.innerHTML = html;
  } catch (err) {
    console.error(err);
    listDiv.innerHTML = '<p style="color:#ff4444; font-size:11px; text-align:center;">Failed to load history</p>';
  }
}

// 3. Delete Broadcast
async function deleteBroadcast(id) {
  if (!confirm('Permanently delete this broadcast from history?')) return;
  try {
    await db.collection('broadcasts').doc(id).delete();
    notify('🗑️ Deleted!');
    loadPreviousBroadcasts();
  } catch (err) {
    notify('Delete failed!', 'error');
  }
}


// 4. Auto-show latest for users (Modified checkBroadcasts)
async function checkBroadcasts() {
  try {
    // Latest message fetch karein jo time ke hisaab se sabse upar ho
    const snapshot = await db.collection('broadcasts').orderBy('sentAt', 'desc').limit(1).get();
    
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      document.getElementById('broadcastTitle').textContent = data.title;
      document.getElementById('broadcastMessage').textContent = data.message;
      document.getElementById('broadcastPopup').style.display = 'block';
      document.getElementById('broadcastPopup').classList.add('show');
    }
  } catch (err) {
    console.log('No broadcast found');
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
          <img src="${p.image || 'https://helproot.github.io/img/Xiaomi-2.png'}" style="width: 100%; height: 100%; object-fit: cover;">
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
    const originalText = buyBtn ? buyBtn.innerText : "CLAIM";
    if (buyBtn) {
        buyBtn.innerText = "Processing... ⏳";
        buyBtn.disabled = true;
    }

    try {
        const userId = auth.currentUser.uid;
        const userEmail = auth.currentUser.email || "No Email";
        
        // 1. References Define Karein
        const userRef = db.collection('users').doc(userId);
        const productRef = db.collection('products').doc(productId);
        const couponRef = db.collection('coupons').doc(couponDocId);
        const transRef = db.collection('pendingTransactions').doc();

        // User ki poori details nikaalo (Profile details ke liye)
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? userSnap.data() : {};
        
        const fullName = userData.name || "Not Provided";
        const mobile = userData.mobile || "Not Provided";
        const telegramUser = userData.telegram || "Not Provided";
        
        // Product ka data nikalna zaroori hai Telegram alert ke liye
        const prodSnap = await productRef.get();
        if (!prodSnap.exists) throw new Error("Account Database mein nahi mila!");
        const prodData = prodSnap.data();

        // 🔥 FIX: Batch ko yahan define karna zaroori hai
        const batch = db.batch();

        // 2. Product Update (Mark as SOLD)
        batch.update(productRef, {
            status: 'sold',
            isSoldOut: true,
            soldTo: userId,
            buyerEmail: userEmail,
            soldAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. User Profile Update
        batch.update(userRef, {
            purchasedProducts: firebase.firestore.FieldValue.arrayUnion(productId)
        });

        // 4. Coupon Count Update
        batch.update(couponRef, {
            usedCount: firebase.firestore.FieldValue.increment(1)
        });

        // 5. Transaction Record
        batch.set(transRef, {
            userId: userId,
            userEmail: userEmail,
            productId: productId,
            couponCode: code,
            amount: 0,
            status: 'completed',
            transactionId: "FREE_" + Date.now(),
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 🔥 Sab kuch ek saath commit karein
        await batch.commit();

        // 📢 Telegram Alert (Aapka Function)
        // 📢 3. Telegram Alert (With Full Details)
        const alertMsg = `🎁 <b>Free Claim! (100% Discount)</b>\n\n` +
            `👤 <b>User Info:</b>\n` +
            `📝 Name: ${fullName}\n` +
            `📧 Email: ${userEmail}\n` +
            `📞 Mobile: ${mobile}\n` +
            `✈️ Telegram: ${telegramUser}\n\n` +
            `📦 <b>Order Details:</b>\n` +
            `🎫 Coupon: ${code}\n` +
            `📦 Account: ${prodData.name || productId}\n` +
            `✅ Status: Auto-Delivered`;

        if (typeof sendTelegramAlert === 'function') {
            sendTelegramAlert(alertMsg);
        }

        // 🎆 Fireworks & Celebration
        if (typeof launchFireworks === 'function') {
            launchFireworks();
        } else if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }

        alert("🎁 Success! Account claimed.");

        // Data Sync
        await loadUserData(); 
        if (typeof renderProductsList === 'function') {
            await renderProductsList();
        } else if (typeof renderProducts === 'function') {
            await renderProducts();
        }

        setTimeout(() => {
            showSection('mykeys');
        }, 800); 

    } catch (error) {
        console.error("Claim Error:", error);
        alert("❌ Error: " + error.message);
        if (buyBtn) {
            buyBtn.innerText = originalText;
            buyBtn.disabled = false;
        }
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
    // OFFLINE DATA LOAD (Pehle screen par purana data dikhao)
    const cachedData = localStorage.getItem('userDashboardData');
    if (cachedData) {
      const offlineData = JSON.parse(cachedData);
      renderUI(offlineData.userData, offlineData.userEmail, offlineData.availableOnly);
    }

    // ONLINE DATA FETCH (Agar net hai toh fresh data lao)
    if (navigator.onLine && currentUser) {
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      const prodSnapshot = await db.collection('products').get();
      
      let userData = {
        role: 'user',
        purchasedProducts: [],
        profilePhoto: ""
      };

      if (userDoc.exists) {
        userData = userDoc.data();
        // Global variables ko update karna zaroori hai admin features ke liye
        userRole = userData.role || 'user'; 
        userProducts = userData.purchasedProducts || [];
      }

      const userEmail = currentUser.email;
      const availableOnly = prodSnapshot.docs.filter(p => !p.data().isSoldOut).length;

      // Data save karo agli baar ke liye
      localStorage.setItem('userDashboardData', JSON.stringify({
        userData,
        userEmail,
        availableOnly
      }));

      // Fresh UI update
      renderUI(userData, userEmail, availableOnly);
    }
  } catch (err) {
    console.error("Profile Load Error:", err);
  }
}

// 2. renderUI: Sidebar aur Settings dono jagah data dikhana
function renderUI(userData, userEmail, availableOnly) {
  const currentRole = userData.role || 'user';
  const currentProducts = userData.purchasedProducts || [];
  const photoUrl = userData.profilePhoto || "";

  // PHOTO/AVATAR LOGIC (Sidebar + Settings Dono ke liye)
  const photoHTML = (photoUrl && photoUrl !== "") 
    ? `<img src="${photoUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${userEmail}&background=6d7cff&color=fff'">`
    : `<span style="font-size:20px; font-weight:bold; color:white;">${userEmail.charAt(0).toUpperCase()}</span>`;
  
  const sideAvatar = document.getElementById('sideAvatar');
  const settingsAvatar = document.getElementById('settingsAvatar');
  
  if(sideAvatar) sideAvatar.innerHTML = photoHTML;
  if(settingsAvatar) settingsAvatar.innerHTML = photoHTML;

  // NAME & ROLE TEXT
  let namePart = userEmail.split('@')[0].toUpperCase();
  if(namePart.length > 10) namePart = namePart.substring(0, 8) + "..";
  const roleDisplayText = currentRole === 'admin' ? '👑Administrator' : 'Verified User✅';

  // Sidebar Updates
  if(document.getElementById('sideName')) document.getElementById('sideName').textContent = namePart;
  if(document.getElementById('sideRole')) document.getElementById('sideRole').textContent = roleDisplayText;
  
  // Settings Page Updates
  if(document.getElementById('set-userName')) document.getElementById('set-userName').textContent = namePart;
  if(document.getElementById('set-userRole')) document.getElementById('set-userRole').textContent = roleDisplayText;
  if(document.getElementById('set-userEmail')) document.getElementById('set-userEmail').textContent = userEmail;

  // DASHBOARD STATS
  if(document.getElementById('userInfo')) document.getElementById('userInfo').textContent = userEmail;
  if(document.getElementById('roleBadge')) document.getElementById('roleBadge').textContent = currentRole.toUpperCase();
  if(document.getElementById('totalProducts')) document.getElementById('totalProducts').textContent = availableOnly;
  if(document.getElementById('userKeys')) document.getElementById('userKeys').textContent = currentProducts.length;

  // ADMIN SECTION CONTROL (Fix: Isse admin section sahi se dikhega)
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
    if(id === 'broadcast') loadPreviousBroadcasts();
    
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
    
    if (!userDoc.exists) {
      const newUserData = {
        email: user.email,
        role: 'user',
        purchasedProducts: [], 
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        timer: { isRunning: false, savedRemaining: 72 * 60 * 60 * 1000, totalBase: 72 * 60 * 60 * 1000 }
      };
      await userDocRef.set(newUserData);
      userDoc = await userDocRef.get();
    }

    if (!couponListenerStarted) {
        loadActiveCoupons();
        couponListenerStarted = true;
    }

    // REAL-TIME SYNC & INPUT AUTO-FILL
    userDocRef.onSnapshot((doc) => {
      const userData = doc.data();
      if (userData) {
          if (userData.timer) syncUserTimer(userData.timer);
          
          // IDs Matched with your HTML
          const eInp = document.getElementById('upd-email');
          const nInp = document.getElementById('upd-name');
          const mInp = document.getElementById('upd-mobile');
          const tInp = document.getElementById('upd-telegram');

          if (eInp) eInp.value = user.email || '';
          if (nInp) nInp.value = userData.name || '';
          if (mInp) mInp.value = userData.mobile || '';
          if (tInp) tInp.value = userData.telegram || '';

          loadUserData(); 
      }
    });

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
window.forceClosePopup = function() {
    const popup = document.getElementById('broadcastPopup');
    if (popup) {
        popup.classList.remove('show');
        setTimeout(() => { popup.style.display = 'none'; }, 400); // Animation ke baad hide
    }
};

// Function 2: Got it! ke liye (Band + Navigation)
window.handleGotItAction = function() {
    // 1. Popup band karo
    window.forceClosePopup();

    // 2. Direct Firestore se check karo (ID Mismatch se bachne ke liye)
    if (!currentUser) return;

    db.collection('users').doc(currentUser.uid).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            // In charo fields ko check kar rahe hain
            const isIncomplete = !data.name || !data.mobile || !data.telegram;

            if (isIncomplete) {
                // Profile Incomplete: Settings -> Profile Panel
                if (typeof showSection === 'function') {
                    showSection('settings'); 
                    
                    setTimeout(() => {
                        // Profile panel open karne ka logic
                        toggleSettingsPanel('profile-panel');
                        if(window.showToast) showToast("Pehle apni profile poori karein! 👤");
                    }, 400);
                }
            } else {
                // Profile Complete: Go to Products
                if (typeof showSection === 'function') {
                    showSection('products');
                }
            }
        }
    }).catch((error) => {
        console.error("Error checking profile:", error);
        // Fallback: Agar error aaye toh products par bhej do
        showSection('products');
    });
};







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

// ==========================================
//--- STEP 1: TELEGRAM NOTIFICATION FUNCTION ---
// ==========================================
async function sendTelegramAlert(msg) {
    const token = "7955185832:AAH4_TJyi_P78BFkHnBl32d3CgD4sdZ7Gxo"; 
    const chatId = "6931353821";   
    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}&parse_mode=HTML`;
    
    try {
        await fetch(url);
    } catch(err) {
        console.log("Telegram alert failed", err);
    }
}

// ==========================================
//--- STEP 2: FIREWORKS (CONFETTI) FUNCTION ---
// ==========================================
function launchFireworks() {
    if (typeof confetti === 'undefined') return; // Check if library loaded
    var duration = 3 * 1000;
    var end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60, spread: 55,
            origin: { x: 0 },
            colors: ['#6d7cff', '#6dff9a', '#ffffff']
        });
        confetti({
            particleCount: 5,
            angle: 120, spread: 55,
            origin: { x: 1 },
            colors: ['#6d7cff', '#6dff9a', '#ffffff']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

// ==========================================
//--- STEP 3: THE MAIN SUBMIT FUNCTION (FIXED) ---
// ==========================================
async function submitTransaction() {
    const txInput = document.getElementById('transactionId');
    const txId = txInput ? txInput.value.trim() : "";
    const sound = document.getElementById("successPing");

    if (!currentQRProduct) {
        alert("❌ Error: First Select Xaiomi Account! then click Buy now");
        return;
    }
    if (!txId) {
        alert("❌ UTR / Transaction ID daalna zaroori hai.");
        return;
    }

    // Final price calculate karo
    const finalAmount = (window.discountApplied > 0) ? (currentProductPrice - window.discountApplied) : currentProductPrice;

    try {
        // --- [ID MATCH FIX] User Profile Details Fetch ---
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        // Wahi keys use kar rahe hain jo aapne updateFullProfile mein save ki hain
        const fullName = userData.name || "Not Set"; 
        const mobile = userData.mobile || "Not Set";
        const telegramUser = userData.telegram || "Not Set";

        // 1. Coupon usage count increment
        if (window.appliedCouponId) {
            await db.collection('coupons').doc(window.appliedCouponId).update({
                usedCount: firebase.firestore.FieldValue.increment(1)
            });
        }

        // 2. Save Transaction to Firestore
        await db.collection('pendingTransactions').add({
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            userName: fullName,
            userMobile: mobile,
            userTelegram: telegramUser,
            transactionId: txId,
            productId: currentQRProduct,
            amount: finalAmount,
            status: 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            couponUsed: window.currentCouponCode || "none"
        });

        // 3. ✅ [PREMIUM ALERT] Telegram Message with User Profile
        const alertMsg = `🚀 <b>New Order Received!</b>\n\n` +
            `👤 <b>User Info:</b>\n` +
            `📝 Name: ${fullName}\n` +
            `📧 Email: ${auth.currentUser.email}\n` +
            `📞 Mobile: ${mobile}\n` +
            `✈️ Telegram: ${telegramUser}\n\n` +
            `📦 <b>Product Info:</b>\n` +
            `💳 UTR: ${txId}\n` +
            `📂 Account: ${currentQRProduct}\n` +
            `💰 Amount: ₹${finalAmount}\n` +
            `🎫 Coupon: ${window.currentCouponCode || 'None'}`;
        
        sendTelegramAlert(alertMsg);

        // 4. Effects
        if (typeof launchFireworks === 'function') launchFireworks();
        if (sound) { sound.currentTime = 0; sound.play().catch(e => {}); }
        if (navigator.vibrate) { navigator.vibrate(200); }

        alert("✅ Success! Admin 5m mein approve kar dega");

        // 5. Cleanup
        window.appliedCouponId = null;
        window.currentCouponCode = null;
        window.discountApplied = 0;

        closeQRModal(); 
        showSection('mykeys');

    } catch (error) {
        console.error("Submit Error:", error);
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

// --- Fixed Avatar Logic (profilePhoto) ---
const profileImg = u.profilePhoto || ''; 

// Name logic: Agar name khali hai toh "Not Set" dikhayega
const finalDisplayName = (u.name && u.name.trim() !== "") ? u.name : "Not Set";

html += `
<div class="user-item" style="
  /* Background Blue Gradient Fix */
  background: linear-gradient(145deg, rgba(13, 25, 48, 0.9), rgba(10, 15, 30, 0.95));
  border: 1px solid rgba(0, 242, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 15px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: 0.3s;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
">
  <div style="flex: 1; display: flex; align-items: center; gap: 12px;">
    
    <div style="width: 50px; height: 50px; background: rgba(0, 242, 255, 0.1); border-radius: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(0, 242, 255, 0.2); overflow: hidden;">
      ${profileImg ? 
        `<img src="${profileImg}" style="width: 100%; height: 100%; object-fit: cover;">` : 
        `<i class="fas fa-user-shield" style="color: #00f2ff; font-size: 20px;"></i>`
      }
    </div>

    <div style="flex: 1; overflow: hidden;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="font-size: 15px; font-weight: 700; color: ${u.name ? '#fff' : '#ffb3b3'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;">
          ${finalDisplayName}
        </span>
        <span style="background: rgba(0, 242, 255, 0.15); color: #00f2ff; font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 50px; text-transform: uppercase; border: 1px solid rgba(0, 242, 255, 0.3); letter-spacing: 0.5px;">
          ${u.role || 'user'}
        </span>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 3px; width: 100%;">
    <div style="
        font-size: 11px; 
        color: #a5b1ff; 
        opacity: 0.7; 
        display: flex; 
        align-items: center; 
        gap: 5px;
        /* Gmail Hide Logic (No Dots) */
        white-space: nowrap; 
        overflow: hidden; 
        max-width: 155px; /* Isse zyada bada Gmail apne aap hide ho jayega */
    ">
        <i class="far fa-envelope" style="font-size: 12px; flex-shrink: 0;"></i> 
        <span style="overflow: hidden; white-space: nowrap;">
            ${u.email}
        </span>
    </div>

        <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
           <span style="font-size: 10px; color: #6dff9a; display: flex; align-items: center; gap: 4px;">
             <i class="fas fa-shopping-cart" style="font-size: 9px;"></i> Orders: ${purchaseCount}
           </span>
           <span style="font-size: 10px; color: rgba(255,255,255,0.4);">
             <i class="far fa-calendar-alt"></i> ${regDate}
           </span>
        </div>
      </div>
    </div>
  </div>
  
  <div style="display: flex; gap: 10px; margin-left: 10px;">
    <button onclick="viewUserHistory('${userId}', '${u.email}')" 
      style="width: 40px; height: 40px; border-radius: 12px; border: 1px solid rgba(0, 210, 255, 0.3); background: rgba(0, 210, 255, 0.1); color: #00d2ff; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; font-size: 14px;">
      <i class="fas fa-user-edit"></i>
    </button>

    <button onclick="deleteUser('${userId}')" 
      style="width: 40px; height: 40px; border-radius: 12px; border: 1px solid rgba(255, 68, 68, 0.3); background: rgba(255, 68, 68, 0.1); color: #ff4444; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; font-size: 14px;">
      <i class="fas fa-trash-alt"></i>
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
        
        // --- Extra Data Fetching (Using original userData) ---
        const name = userData.name || userData.displayName || 'N/A';
        const mobile = userData.mobile || userData.phoneNumber || 'N/A';
        const telegram = userData.telegram || userData.telegramUsername || 'N/A';
        
        const registrationDate = userData.createdAt ? 
            new Date(userData.createdAt.toDate()).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown';
        
        const purchasedIds = userData.purchasedProducts || [];
        const txSnapshot = await db.collection('pendingTransactions').where('userId', '==', userId).get();
        const productsSnapshot = await db.collection('products').get();
        const allProducts = {};
        productsSnapshot.forEach(doc => { allProducts[doc.id] = doc.data(); });

        let html = `<h4>📜 History for: ${userEmail}</h4>`;
        
// 1. Firebase data extraction
const timerData = userData.timer || {}; 
const endTime = timerData.endTime; 
const isRunning = timerData.isRunning === true;
const savedRemaining = timerData.savedRemaining || 0; // Paused time handle karne ke liye

html += `
<div style="
    background: linear-gradient(145deg, rgba(20, 24, 45, 0.98), rgba(13, 17, 33, 1));
    padding: 18px;
    border-radius: 20px;
    margin-bottom: 15px;
    border: 1px solid ${isRunning ? 'rgba(0, 242, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
">
    <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px;">
        
        <div style="min-width: 0; text-align: center;">
            <div style="font-size: 11px; margin-bottom: 8px;">
                <span style="color: #94a3b8;">👤Name</span><br>
                <b style="color: #fff; font-size: 13px; display: block; overflow: hidden; text-overflow: ellipsis;">${name}</b>
            </div>
            <div style="font-size: 11px;">
                <span style="color: #94a3b8;">✈️Telegram</span><br>
                <b style="color: #38bdf8; font-size: 12px; display: block; overflow: hidden; text-overflow: ellipsis;">${telegram}</b>
            </div>
        </div>

        <div style="text-align: center;">
            <div style="background: rgba(0, 242, 255, 0.05); border: 1px solid ${isRunning ? 'rgba(0, 242, 255, 0.35)' : 'rgba(255, 255, 255, 0.15)'}; border-radius: 14px; padding: 8px 10px; min-width: 90px; box-shadow: 0 0 15px rgba(0, 242, 255, 0.1);">
                <div style="font-size: 7px; color: ${isRunning ? '#00f2ff' : '#94a3b8'}; font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">
                    ${isRunning ? 'Unlock In' : 'Paused'}
                </div>
                <div id="db_timer_${userId}" style="color: #fff; font-size: 11px; font-weight: 800; font-family: 'Courier New', monospace;">
                    ${isRunning ? '--:--:--' : formatStaticTime(savedRemaining)}
                </div>
            </div>
        </div>

        <div style="min-width: 0; text-align: center; display: flex; flex-direction: column; align-items: flex-end;">
            <div style="font-size: 11px; margin-bottom: 8px; width: 100%;">
                <span style="color: #94a3b8;">📞Mobile</span><br>
                <b style="color: #fff; font-size: 13px;">${mobile}</b>
            </div>
            
            <div style="width: 100%; display: flex; flex-direction: column; align-items:center;">
             <span style="color: #94a3b8; font-size: 11px; display: block; margin-bottom: 2px;">Status</span>
                <b style="color: ${isRunning ? '#6dff9a' : '#ffeb3b'}; font-size: 10px; display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <span style="width: 6px; height: 6px; background: ${isRunning ? '#6dff9a' : '#ffeb3b'}; border-radius: 50%; box-shadow: 0 0 5px ${isRunning ? '#6dff9a' : '#ffeb3b'};"></span> 
                    ${isRunning ? 'ACTIVE' : 'STOPPED'}
                </b>
            </div>
        </div>

    </div>
</div>
`;


// --- Real-time Logic (Fixed Function Call) ---
if (isRunning && endTime) {
    // Thoda delay taaki modal DOM mein render ho jaye
    setTimeout(() => startLiveSync(userId, endTime), 50);
}

// Helper for Static Display
function formatStaticTime(ms) {
    if (!ms || ms <= 0) return "00:00:00";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function startLiveSync(id, endMs) {
    const timerBox = document.getElementById(`db_timer_${id}`);
    if (!timerBox) return;

    const run = () => {
        const remaining = endMs - Date.now();
        if (remaining <= 0) {
            timerBox.innerHTML = "READY";
            timerBox.style.color = "#6dff9a";
            return;
        }

        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        const s = Math.floor((remaining % 60000) / 1000);

        timerBox.innerHTML = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        requestAnimationFrame(run);
    };
    run();
}



        
        // --- Aapka Purana Joined On Box ---
        html += `
            <div style="background:rgba(109,124,255,0.1); padding:12px; border-radius:10px; margin-bottom:15px; border:1px solid #6d7cff; text-align:center;">
                <span style="color:#6dff9a; font-weight:bold;">📅 Joined On:</span> ${registrationDate}
            </div>
              <button class="action" onclick="showSection('manageUsers')" style="
        margin-bottom: 20px; 
        width: 100%; 
        padding: 12px; 
        border-radius: 12px; 
        background: rgba(255, 255, 255, 0.05); 
        color: #fff; 
        border: 1px solid rgba(255, 255, 255, 0.1); 
        font-weight: bold; 
        font-size: 13px; 
        cursor: pointer; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        gap: 10px;
        transition: all 0.3s ease;
    " onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='rgba(255,255,255,0.2)';" 
      onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='rgba(255,255,255,0.1)';"
    >
        <span style="font-size: 16px;">⬅️</span> Back to Users List
    </button>
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
      // 1. Pehle Active (false) aur Sold (true) ko alag karein
      if (a.isSoldOut !== b.isSoldOut) {
        return a.isSoldOut ? 1 : -1; 
      }

      // 2. Agar dono ACTIVE hain, toh "submittedAt" (Add Date) ke hisab se sort karein
      if (!a.isSoldOut) {
        return (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0);
      }

      // 3. Agar dono SOLD hain, toh "soldAt" (Sold Date) ke hisab se sort karein
      // Jo abhi-abhi sold hua hai wo Sold list mein sabse upar rahega
      return (b.soldAt?.toMillis() || 0) - (a.soldAt?.toMillis() || 0);
    });

    let html = '';
    products.forEach(p => {
      const isSold = p.isSoldOut || false;
      
      // Date Formatting (Added Date)
      let dateStr = "New";
      if (p.submittedAt) {
          const d = p.submittedAt.toDate();
          dateStr = d.toLocaleDateString('en-GB') + " " + d.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit', hour12: true});
      }

      // Buyer Email
      const buyerEmail = isSold && p.soldTo ? (userMap[p.soldTo] || "Unknown User") : null;

      // --- PREMIUM SIMPLE DESIGN ---
      html += `
<div class="product-item" style="
  background: linear-gradient(145deg, rgba(20, 24, 45, 0.9), rgba(13, 17, 33, 0.98));
  border: 1px solid ${isSold ? 'rgba(255, 68, 68, 0.15)' : 'rgba(0, 242, 255, 0.15)'};
  border-radius: 22px;
  padding: 20px;
  margin-bottom: 10px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  transition: 0.3s ease;
  text-align: center;
">
  
  <div style="display: flex; justify-content: center; margin-bottom: 10px;">
    <div style="
      background: ${isSold ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 242, 255, 0.08)'};
      color: ${isSold ? '#ff4444' : '#00f2ff'};
      padding: 6px 14px;
      border-radius: 50px;
      font-size: 10px;
      font-weight: 900;
      border: 1px solid ${isSold ? 'rgba(255, 68, 68, 0.2)' : 'rgba(0, 242, 255, 0.2)'};
      display: flex; align-items: center; gap: 6px;
      text-transform: uppercase;
      letter-spacing: 1px;
    ">
      <span style="height: 6px; width: 6px; background: ${isSold ? '#ff4444' : '#00f2ff'}; border-radius: 50%; box-shadow: 0 0 8px ${isSold ? '#ff4444' : '#00f2ff'};"></span>
      ${isSold ? 'Sold Out' : 'Active'}
    </div>
  </div>

  <div style="margin-bottom: 10px;">
    <h3 style="margin: 0; font-size: 18px; color: #fff; font-weight: 800; letter-spacing: 0.3px;">
      ${p.name}
    </h3>
    
     <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;">
      <span style="font-size: 10px; color: #00d2ff; opacity: 0.7; font-family: monospace; letter-spacing: 0.5px;">
        ID: ${p.id}
      </span>
      
      <i class="far fa-copy" 
         onclick="copyToClipboard('${p.id}', this)" 
         style="
           cursor: pointer;
           color: #00d2ff;
           font-size: 11px;
           opacity: 0.6;
           transition: 0.2s;
         " 
         onmouseover="this.style.opacity='1'; this.style.transform='scale(1.1)';" 
         onmouseout="this.style.opacity='0.6'; this.style.transform='scale(1)';"
         title="Copy ID">
      </i>
    </div>   
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
     <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
        <div style="font-size: 9px; color: #a5b1ff; text-transform: uppercase; margin-bottom: 4px;">Price</div>
        <div style="color: #6dff9a; font-size: 16px; font-weight: 800;">₹${p.price}</div>
     </div>
     <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden;">
        <div style="font-size: 9px; color: #a5b1ff; text-transform: uppercase; margin-bottom: 4px;">Key</div>
        <div style="color: #ffeb3b; font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${p.key || '@notset'}
        </div>
     </div>
  </div>

  <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 10px;">
    <div style="color: rgba(255,255,255,0.3); font-size: 10px; display: flex; align-items: center; gap: 5px;">
      <i class="far fa-calendar-plus"></i> Added: ${dateStr}
    </div>
    ${isSold && p.soldAt ? `
    <div style="color: #ff8a8a; font-size: 10px; display: flex; align-items: center; gap: 5px; opacity: 0.8;">
      <i class="fas fa-calendar-check"></i> Sold: ${new Date(p.soldAt.toDate()).toLocaleString()}
    </div>
    ` : ''}
  </div>

  ${isSold ? `
    <div style="margin-bottom: 10px; padding: 12px; background: rgba(255,68,68,0.05); border-radius: 14px; border: 1px dashed rgba(255,68,68,0.2);">
      <div style="color: #ff8a8a; font-size: 9px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px;">
        <i class="fas fa-user-tag"></i> Buyer Email
      </div>
      <div style="color: #fff; font-size: 12px; opacity: 0.9; word-break: break-all;">
        ${buyerEmail}
      </div>
    </div>
  ` : ''}

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
    <button onclick="editProduct('${p.id}','${p.name}','${p.loginId}','${p.key}',${p.price})" style="
      background: rgba(109, 124, 255, 0.08);
      color: #00d2ff;
      border: 1px solid rgba(0, 210, 255, 0.2);
      padding: 12px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    ">
      <i class="fas fa-pen-nib"></i> Edit
    </button>
    
    <button onclick="deleteProduct('${p.id}')" style="
      background: rgba(255, 68, 68, 0.08);
      color: #ff4444;
      border: 1px solid rgba(255, 68, 68, 0.2);
      padding: 12px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    ">
      <i class="fas fa-trash-alt"></i> Delete
    </button>
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
    // 1. Check karein ki Admin Panel mein ye ID exist karti hai
    const list = document.getElementById('activeCouponsList');
    if(!list) {
        console.error("Error: 'activeCouponsList' element nahi mila!");
        return;
    }
    
    list.innerHTML = '<p style="text-align:center; color:#888; font-size:12px;">⌛ Loading coupons...</p>';

    try {
        // Real-time listener taaki delete/add turant dikhe
        db.collection('coupons').orderBy('createdAt', 'desc').onSnapshot((snap) => {
            let html = '';
            
            if(snap.empty) {
                list.innerHTML = '<p style="text-align:center; color:#555; font-size:12px;">📭 No active coupons found.</p>';
                return;
            }

            snap.forEach(doc => {
                const d = doc.data();
                const symbol = d.type === 'fixed' ? '₹' : '%';
                
                // Expiry Date check (Safe handling)
                const exp = d.expiryDate || 'No Expiry';
                
                // Usage color logic: Jab limit khatam ho jaye toh red dikhe
                const isLimitFull = (d.usedCount >= d.usageLimit);
                const limitColor = isLimitFull ? '#ff4444' : '#6dff9a';

                html += `
    <div style="
        background: linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6)); 
        border: 1px solid rgba(255, 235, 59, 0.1); 
        padding: 15px; 
        border-radius: 18px; 
        margin-bottom: 5px; 
        position: relative;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="
                    background: linear-gradient(90deg, #ffeb3b, #fbc02d); 
                    color: #000; 
                    padding: 4px 12px; 
                    border-radius: 8px; 
                    font-weight: 900; 
                    font-size: 12px; 
                    text-transform: uppercase;
                    letter-spacing: 1px;
                ">${d.code}</span>

                <div onclick="copyToClipboard('${d.code}', this)" style="cursor: pointer; display: flex; align-items: center; transition: 0.2s; padding: 4px;" title="Copy Code">
                    <svg id="copy_icon_${doc.id}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 2px rgba(56, 189, 248, 0.3));">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </div>
            </div>

            <button onclick="deleteCoupon('${doc.id}')" style="background: rgba(255, 68, 68, 0.05); color: #ff4444; border: 1px solid rgba(255, 68, 68, 0.3); border-radius: 8px; padding: 6px 12px; font-size: 10px; font-weight: 800; cursor: pointer; text-transform: uppercase;">
                🗑️ Remove
            </button>
        </div>

        <div style="margin-bottom: 5px;">
            <div style="font-size: 16px; color: #fff; font-weight: 800;">
                <span style="color: #6dff9a;">${d.value}${symbol}</span> OFF
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 10px;">
            <span style="color: #94a3b8;">⏳ Exp: <b style="color: #ddd;">${exp}</b></span>
            <div style="background: rgba(255, 255, 255, 0.03); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: ${limitColor}; font-weight: 900;">${d.usedCount || 0} / ${d.usageLimit} USED</span>
            </div>
        </div>
    </div>
`;



            });
            list.innerHTML = html;
        });
    } catch (e) {
        console.error("Coupon Load Error:", e);
        list.innerHTML = '<p style="color:#ff4444; text-align:center; font-size:12px;">❌ Error loading coupons.</p>';
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


function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = "✅ COPIED";
        btn.style.color = "#6dff9a";
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.color = "#fff";
        }, 2000);
    });
}




function toggleSettingsPanel(panelId) {
    // 1. Panel ko hide/show karo
    const panel = document.getElementById(panelId);
    panel.classList.toggle('hidden');

    // 2. Arrow ko rotate karo
    const arrow = document.getElementById('arrow-' + panelId);
    if (arrow) {
        arrow.classList.toggle('rotate-arrow');
    }
}


// ==========================================
// --Complete profile function(Working Fine)
// ==========================================

async function updateFullProfile() {
    // Current User check zaroori hai
    if (!auth.currentUser) {
        alert("Session expired! Please login again.");
        return;
    }
    const newName = document.getElementById('upd-name').value.trim();
    const newMobile = document.getElementById('upd-mobile').value.trim();
    const newTelegram = document.getElementById('upd-telegram').value.trim();

    // 1. Validation check
    if(!newName || !newMobile) {
        alert("Bhai, Name aur Mobile toh zaroori hai!");
        return;
    }

    try {
        const userRef = db.collection('users').doc(auth.currentUser.uid);
        
        // 2. Database Update
        // Note: 'name' use kar rahe hain taaki loadUserData() se mismatch na ho
        await userRef.update({
            name: newName, 
            mobile: newMobile,
            telegram: newTelegram,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. LIVE DOM UPDATE (Refresh ke bina name badalne ke liye)
        // Aapke profile header ke liye (Rishu Kumarr wala part)
        const profileHeaderName = document.querySelector('.profile-header h3'); 
        if(profileHeaderName) {
            profileHeaderName.textContent = newName;
        }

        // Sidebar ya baaki sections ke liye
        if(document.getElementById('sideName')) {
            document.getElementById('sideName').textContent = newName;
        }

        alert("✅ Profile Update Ho Gayi!");
        
        // Panel close logic
        if (typeof toggleSettingsPanel === 'function') {
            toggleSettingsPanel('profile-panel'); 
        }

    } catch (error) {
        console.error("Error updating profile:", error);
        alert("❌ Kuch gadbad ho gayi: " + error.message);
    }
}

// ==========================================
// --Complete profile function(Working Fine) end
// ==========================================



// ==========================================
// --ID pass login Show hide function(Working Fine)
// ==========================================

function toggleEmailSection() {
    const section = document.getElementById('emailSection');
    const arrow = document.getElementById('arrow-icon');
    
    // Check if section is closed
    if (section.style.maxHeight === "0px" || section.style.maxHeight === "") {
        section.style.maxHeight = "400px"; // Expand (Itna kaafi hai saare fields ke liye)
        section.style.opacity = "1";
        section.style.paddingTop = "10px";
        arrow.style.transform = "rotate(180deg)"; // Arrow turns up
        arrow.style.color = "#bd00ff"; // Glow color for arrow
    } else {
        section.style.maxHeight = "0px"; // Collapse
        section.style.opacity = "0";
        section.style.paddingTop = "0px";
        arrow.style.transform = "rotate(0deg)"; // Arrow turns down
        arrow.style.color = "rgba(255,255,255,0.4)";
    }
}

// ==============================================
// --ID pass login Show hide function(Working Fine)end
// ==============================================





// ==========================================
// --Login with Google function(Working Fine)
// ==========================================
async function loginWithGoogle() {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        
        const userDocRef = db.collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();
        
        // Agar user naya hai toh uska record banayein
        if (!userDoc.exists) {
            console.log("Creating new Google user record...");
            await userDocRef.set({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                role: 'user',
                purchasedProducts: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                timer: { 
                    isRunning: false, 
                    savedRemaining: 72 * 60 * 60 * 1000, 
                    totalBase: 72 * 60 * 60 * 1000 
                }
            });
        }
        
        // Aapka Auth.onAuthStateChanged automatically baki kaam sambhal lega
        console.log("Google Login Successful!");

    } catch (error) {
        console.error("Google Auth Error:", error);
        alert("❌ Google Login Failed: " + error.message);
    }
}
// ==========================================
// --Login with Google function(Working Fine) end
// ==========================================

function openErrorPage() {
    // Agar aapka error code wala file 'errors.html' naam se save hai:
    window.location.href = 'error_codes.html'; 
}


// ===================
// --Vesion:- 21
// ===================
