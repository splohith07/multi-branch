// Multi-Branch Restaurant Script with Hardened Firebase Security
import {
    auth,
    db,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "./firebase-config.js";

// =========================================
// DEFAULT FALLBACK DATA
// =========================================
const DEFAULT_SETTINGS = {
    restaurantName: "The Spice Table",
    tagline: "MULTI-BRANCH RESTAURANT",
    heroTitle: "One Brand.\nEvery Branch.",
    heroDescription: "Experience the same signature flavours, warm hospitality and premium dining experience across every Spice Table location.",
    aboutHeading: "A Taste That Brings Everyone Together",
    aboutDescription: "From family dinners to celebrations with friends, The Spice Table brings authentic flavours, contemporary presentation and memorable hospitality to every location.",
    phone: "+91 87789 60660",
    email: "splohith07@gmail.com",
    whatsapp: "918778960660",
    footerTagline: "Authentic flavours. Multiple destinations.",
    copyrightYear: "2026"
};

const DEFAULT_BRANCHES = [
    {
        id: "branch-1",
        branchNumber: "BRANCH 01",
        city: "COIMBATORE",
        name: "Gandhipuram",
        description: "Our flagship restaurant in the heart of Coimbatore.",
        address: "24 Avinashi Road, Gandhipuram",
        hours: "11:00 AM – 11:00 PM",
        phone: "+91 87789 60660",
        mapQuery: "Gandhipuram+Coimbatore",
        imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85",
        order: 1
    },
    {
        id: "branch-2",
        branchNumber: "BRANCH 02",
        city: "POLLACHI",
        name: "Main Road",
        description: "A warm dining destination for families and food lovers.",
        address: "18 Main Road, Pollachi",
        hours: "11:00 AM – 10:30 PM",
        phone: "+91 87789 60660",
        mapQuery: "Main+Road+Pollachi",
        imageUrl: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85",
        order: 2
    },
    {
        id: "branch-3",
        branchNumber: "BRANCH 03",
        city: "TIRUPPUR",
        name: "Avinashi Road",
        description: "Contemporary interiors, traditional flavours and premium dining.",
        address: "52 Avinashi Road, Tiruppur",
        hours: "11:00 AM – 11:00 PM",
        phone: "+91 87789 60660",
        mapQuery: "Avinashi+Road+Tiruppur",
        imageUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=85",
        order: 3
    },
    {
        id: "branch-4",
        branchNumber: "BRANCH 04",
        city: "CHENNAI",
        name: "Anna Nagar",
        description: "A modern urban dining experience with our signature flavours.",
        address: "11 Anna Nagar, Chennai",
        hours: "11:00 AM – 11:30 PM",
        phone: "+91 87789 60660",
        mapQuery: "Anna+Nagar+Chennai",
        imageUrl: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=85",
        order: 4
    }
];

const DEFAULT_MENU = [
    {
        id: "item-1",
        name: "Signature Chicken Biryani",
        description: "Fragrant basmati rice, tender chicken and spices.",
        price: "₹320",
        available: true,
        order: 1
    },
    {
        id: "item-2",
        name: "Mutton Pepper Roast",
        description: "Slow-cooked mutton with roasted pepper.",
        price: "₹420",
        available: true,
        order: 2
    },
    {
        id: "item-3",
        name: "Paneer Tikka",
        description: "Char-grilled paneer with peppers and onions.",
        price: "₹280",
        available: true,
        order: 3
    },
    {
        id: "item-4",
        name: "Butter Naan & Curry",
        description: "Freshly baked naan with house curry.",
        price: "₹240",
        available: true,
        order: 4
    }
];

// In-memory state
let currentSettings = { ...DEFAULT_SETTINGS };
let branchesList = [...DEFAULT_BRANCHES];
let menuList = [...DEFAULT_MENU];
let reservationsList = [];
let unsubscribeReservations = null;
let currentAuthUser = null;
let lastReservationSubmissionTime = 0;

// =========================================
// SANITIZATION & SECURITY HELPERS
// =========================================
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function sanitizeUrl(url) {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed) || /^\//.test(trimmed) || /^\.\//.test(trimmed)) {
        return encodeURI(trimmed).replace(/["'<>]/g, "");
    }
    return "";
}

function cleanPhoneDigits(phone) {
    if (!phone) return "";
    return phone.replace(/[^0-9+]/g, "");
}

// =========================================
// TOAST NOTIFICATIONS
// =========================================
function showToast(message, isError = false) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast-msg";
    if (isError) {
        toast.style.borderColor = "#e53935";
    }
    toast.innerHTML = `<span>${isError ? "⚠️" : "✅"}</span> <span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        toast.style.transition = ".3s";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =========================================
// DATA LOADERS & DOM SYNC
// =========================================

// 1. Settings (Public Read)
async function loadWebsiteSettings() {
    try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentSettings = { ...DEFAULT_SETTINGS, ...docSnap.data() };
        }
    } catch (err) {
        console.warn("Could not load settings from Firestore, using local defaults:", err);
    }
    applySettingsToDOM();
}

function applySettingsToDOM() {
    const s = currentSettings;

    // Document title
    document.title = `${s.restaurantName} | Multi-Branch Restaurant`;

    // Logo & footer brand
    const logoEl = document.getElementById("brandLogo");
    if (logoEl) {
        logoEl.innerHTML = `<span>THE</span> ${escapeHtml(s.restaurantName.replace(/^the\s+/i, "").toUpperCase())}`;
    }

    const footerBrand = document.getElementById("footerBrand");
    if (footerBrand) footerBrand.textContent = s.restaurantName;

    // Eyebrow & Hero
    const heroEyebrow = document.getElementById("heroEyebrow");
    if (heroEyebrow) heroEyebrow.textContent = s.tagline || "MULTI-BRANCH RESTAURANT";

    const heroTitle = document.getElementById("heroTitle");
    if (heroTitle) {
        const parts = (s.heroTitle || "One Brand.\nEvery Branch.").split("\n");
        if (parts.length > 1) {
            heroTitle.innerHTML = `${escapeHtml(parts[0])}<br><span>${escapeHtml(parts.slice(1).join(" "))}</span>`;
        } else {
            heroTitle.textContent = s.heroTitle;
        }
    }

    const heroDesc = document.getElementById("heroDescription");
    if (heroDesc) heroDesc.textContent = s.heroDescription;

    // About
    const aboutBadge = document.getElementById("aboutBadge");
    if (aboutBadge) aboutBadge.textContent = s.restaurantName.toUpperCase();

    const aboutHeading = document.getElementById("aboutHeading");
    if (aboutHeading) {
        aboutHeading.innerHTML = escapeHtml(s.aboutHeading).replace(/\n/g, "<br>");
    }

    const aboutDesc = document.getElementById("aboutDescription");
    if (aboutDesc) aboutDesc.textContent = s.aboutDescription;

    // Contact buttons
    const waDigits = cleanPhoneDigits(s.whatsapp || s.phone).replace(/\+/g, "");
    const waBtn = document.getElementById("contactWhatsAppBtn");
    if (waBtn) {
        waBtn.href = `https://wa.me/${waDigits}?text=Hi%2C%20I%20would%20like%20to%20make%20a%20reservation%20at%20${encodeURIComponent(s.restaurantName)}.`;
    }

    const emailBtn = document.getElementById("contactEmailBtn");
    if (emailBtn) {
        emailBtn.href = `mailto:${encodeURIComponent(s.email)}?subject=Table%20Reservation%20-%20${encodeURIComponent(s.restaurantName)}`;
    }

    const phoneBtn = document.getElementById("contactPhoneBtn");
    if (phoneBtn) {
        phoneBtn.href = `tel:${cleanPhoneDigits(s.phone)}`;
    }

    // Footer
    const footerTagline = document.getElementById("footerTagline");
    if (footerTagline) footerTagline.textContent = s.footerTagline;

    const footerEmail = document.getElementById("footerEmail");
    if (footerEmail) {
        footerEmail.textContent = s.email;
        footerEmail.href = `mailto:${encodeURIComponent(s.email)}`;
    }

    const footerPhone = document.getElementById("footerPhone");
    if (footerPhone) {
        footerPhone.textContent = s.phone;
        footerPhone.href = `tel:${cleanPhoneDigits(s.phone)}`;
    }

    const footerCopyright = document.getElementById("footerCopyright");
    if (footerCopyright) {
        footerCopyright.textContent = `© ${s.copyrightYear || "2026"} ${s.restaurantName}`;
    }

    // Fill settings form inside dashboard
    const settingRestName = document.getElementById("settingRestName");
    if (settingRestName) settingRestName.value = s.restaurantName || "";

    const settingTagline = document.getElementById("settingTagline");
    if (settingTagline) settingTagline.value = s.tagline || "";

    const settingHeroTitle = document.getElementById("settingHeroTitle");
    if (settingHeroTitle) settingHeroTitle.value = s.heroTitle || "";

    const settingHeroDesc = document.getElementById("settingHeroDesc");
    if (settingHeroDesc) settingHeroDesc.value = s.heroDescription || "";

    const settingAboutHeading = document.getElementById("settingAboutHeading");
    if (settingAboutHeading) settingAboutHeading.value = s.aboutHeading || "";

    const settingAboutDesc = document.getElementById("settingAboutDesc");
    if (settingAboutDesc) settingAboutDesc.value = s.aboutDescription || "";

    const settingPhone = document.getElementById("settingPhone");
    if (settingPhone) settingPhone.value = s.phone || "";

    const settingEmail = document.getElementById("settingEmail");
    if (settingEmail) settingEmail.value = s.email || "";

    const settingWhatsapp = document.getElementById("settingWhatsapp");
    if (settingWhatsapp) settingWhatsapp.value = s.whatsapp || "";

    const settingFooterTagline = document.getElementById("settingFooterTagline");
    if (settingFooterTagline) settingFooterTagline.value = s.footerTagline || "";
}

// 2. Branches (Public Read)
async function loadBranches() {
    try {
        const q = query(collection(db, "branches"), orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            branchesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.warn("Could not load branches from Firestore, using local defaults:", err);
    }
    renderBranches();
    updateReservationBranchDropdown();
    renderBranchesInDashboard();
}

function renderBranches() {
    const grid = document.getElementById("branchesGrid");
    if (!grid) return;

    grid.innerHTML = "";

    branchesList.forEach(b => {
        const card = document.createElement("article");
        card.className = "branch-card";

        const mapUrl = b.mapQuery ?
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.mapQuery)}` :
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address || b.name)}`;

        const phoneDigits = cleanPhoneDigits(b.phone) || "+918778960660";
        const phoneCall = `tel:${phoneDigits}`;
        const safeImageUrl = sanitizeUrl(b.imageUrl);
        const imageStyle = safeImageUrl ? `background-image: url('${safeImageUrl}');` : "";

        card.innerHTML = `
            <div class="branch-image" style="${imageStyle}">
                <span class="branch-number">${escapeHtml(b.branchNumber || "BRANCH")}</span>
            </div>
            <div class="branch-content">
                <span class="location">📍 ${escapeHtml(b.city || "LOCATION")}</span>
                <h3>${escapeHtml(b.name || "")}</h3>
                <p>${escapeHtml(b.description || "")}</p>
                <div class="details">
                    <div>📍 ${escapeHtml(b.address || "")}</div>
                    <div>🕐 ${escapeHtml(b.hours || "")}</div>
                    <div>📞 ${escapeHtml(b.phone || "")}</div>
                </div>
                <div class="actions">
                    <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="branch-button">
                        Get Directions →
                    </a>
                    <a href="${phoneCall}" class="branch-button outline">
                        Call
                    </a>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    observeCards();
}

function updateReservationBranchDropdown() {
    const select = document.getElementById("resBranch");
    if (!select) return;

    select.innerHTML = '<option value="">Choose a branch...</option>';
    branchesList.forEach(b => {
        const opt = document.createElement("option");
        opt.value = `${b.name} (${b.city})`;
        opt.textContent = `${b.name} (${b.city})`;
        select.appendChild(opt);
    });
}

// 3. Menu (Public Read)
async function loadMenu() {
    try {
        const q = query(collection(db, "menu"), orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            menuList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.warn("Could not load menu from Firestore, using local defaults:", err);
    }
    renderMenu();
    renderMenuInDashboard();
}

function renderMenu() {
    const grid = document.getElementById("menuGrid");
    if (!grid) return;

    grid.innerHTML = "";

    menuList.forEach(item => {
        const div = document.createElement("div");
        div.className = `menu-item ${item.available === false ? "unavailable" : ""}`;

        div.innerHTML = `
            <div>
                <div class="menu-header-row">
                    <h3>${escapeHtml(item.name)}</h3>
                    ${item.available === false ? '<span class="badge-sold-out">Sold Out</span>' : ""}
                </div>
                <p>${escapeHtml(item.description || "")}</p>
            </div>
            <strong>${escapeHtml(item.price || "")}</strong>
        `;
        grid.appendChild(div);
    });
}

// =========================================
// RESERVATION SUBMISSION (Public Create with Anti-Spam & Validation)
// =========================================
function setupReservationForm() {
    const form = document.getElementById("reservationForm");
    const statusMsg = document.getElementById("resStatusMsg");
    const submitBtn = document.getElementById("resSubmitBtn");

    if (!form) return;

    // Set minimum date to today
    const dateInput = document.getElementById("resDate");
    if (dateInput) {
        const today = new Date().toISOString().split("T")[0];
        dateInput.min = today;
        if (!dateInput.value) dateInput.value = today;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // 1. Anti-spam Honeypot Check (Silently drop spam bots)
        const honeypot = document.getElementById("resWebsiteUrl");
        if (honeypot && honeypot.value.trim() !== "") {
            console.warn("Spam bot submission blocked via honeypot field.");
            form.reset();
            if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
            statusMsg.className = "reservation-status-msg success";
            statusMsg.textContent = "Thank you! Your reservation request has been received.";
            return;
        }

        // 2. Cooldown / Rate-limiting to prevent rapid repeated submissions
        const now = Date.now();
        if (now - lastReservationSubmissionTime < 5000) {
            statusMsg.className = "reservation-status-msg error";
            statusMsg.textContent = "Please wait a moment before submitting another reservation.";
            return;
        }

        const branch = document.getElementById("resBranch").value.trim();
        const guestsStr = document.getElementById("resGuests").value.trim();
        const name = document.getElementById("resName").value.trim();
        const phone = document.getElementById("resPhone").value.trim();
        const date = document.getElementById("resDate").value.trim();
        const time = document.getElementById("resTime").value.trim();
        const email = document.getElementById("resEmail").value.trim();
        const notes = document.getElementById("resNotes").value.trim();

        // 3. Robust Client Validation (matching Firestore Rules)
        if (!branch || !name || !phone || !date || !time) {
            statusMsg.className = "reservation-status-msg error";
            statusMsg.textContent = "Please fill in all required fields.";
            return;
        }

        if (name.length < 2 || name.length > 100) {
            statusMsg.className = "reservation-status-msg error";
            statusMsg.textContent = "Please enter a valid customer name (2 to 100 characters).";
            return;
        }

        const digits = cleanPhoneDigits(phone).replace(/\+/g, "");
        if (digits.length < 7 || phone.length > 25) {
            statusMsg.className = "reservation-status-msg error";
            statusMsg.textContent = "Please enter a valid phone number (at least 7 digits).";
            return;
        }

        const guests = parseInt(guestsStr, 10);
        if (isNaN(guests) || guests < 1 || guests > 50) {
            statusMsg.className = "reservation-status-msg error";
            statusMsg.textContent = "Please select a valid guest count (between 1 and 50).";
            return;
        }

        if (email && (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            statusMsg.className = "reservation-status-msg error";
            statusMsg.textContent = "Please enter a valid email address.";
            return;
        }

        if (notes && notes.length > 500) {
            statusMsg.className = "reservation-status-msg error";
            statusMsg.textContent = "Special requests must not exceed 500 characters.";
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "<span>Submitting Reservation...</span>";
        statusMsg.style.display = "none";

        try {
            const resData = {
                customerName: name,
                customerPhone: phone,
                customerEmail: email || null,
                branch: branch,
                date: date,
                time: time,
                guests: guests,
                notes: notes || null,
                status: "Pending",
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, "reservations"), resData);
            lastReservationSubmissionTime = Date.now();

            statusMsg.className = "reservation-status-msg success";
            statusMsg.innerHTML = `
                <strong>Reservation Request Received!</strong><br>
                Thank you, ${escapeHtml(name)}. We have reserved a table for ${escapeHtml(String(guests))} at our ${escapeHtml(branch)} location on ${escapeHtml(date)} at ${escapeHtml(time)}.<br>
                Our team will reach out at <strong>${escapeHtml(phone)}</strong> to confirm.
            `;
            form.reset();

            if (dateInput) {
                dateInput.value = new Date().toISOString().split("T")[0];
            }

            showToast("Reservation saved successfully!");
        } catch (err) {
            console.error("Error creating reservation:", err);
            statusMsg.className = "reservation-status-msg error";
            // Safe, generic error message avoiding leaking internal database errors
            statusMsg.textContent = "Unable to submit reservation. Please check your details and try again.";
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "<span>Confirm Reservation</span> →";
        }
    });
}

const AUTHORIZED_OWNER_EMAIL = "splohith07@gmail.com";

// =========================================
// OWNER AUTHORIZATION CHECK
// =========================================
// Authoritative owner verification:
// 1. Firebase Auth Custom Claims: token.role === 'owner'
// 2. Authoritative role record at /roles/{uid} where role === 'owner'
// 3. Settings document ownerUid: /settings/general.ownerUid === user.uid
// 4. Primary designated restaurant owner account (splohith07@gmail.com)
async function checkIsAuthorizedOwner(user) {
    if (!user) return false;
    try {
        // 1. Check verified custom claims on Firebase Auth token
        const idTokenResult = await user.getIdTokenResult(true);
        if (idTokenResult && idTokenResult.claims && idTokenResult.claims.role === "owner") {
            return true;
        }

        // 2. Check authoritative /roles/{uid} document where role === 'owner'
        const roleDoc = await getDoc(doc(db, "roles", user.uid));
        if (roleDoc.exists() && roleDoc.data() && roleDoc.data().role === "owner") {
            return true;
        }

        // 3. Check settings/general ownerUid
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists() && settingsDoc.data() && settingsDoc.data().ownerUid === user.uid) {
            return true;
        }

        // 4. Primary designated owner email authenticated via Firebase Auth
        if (user.email && user.email.toLowerCase() === AUTHORIZED_OWNER_EMAIL.toLowerCase()) {
            return true;
        }

        return false;
    } catch (e) {
        console.warn("Owner authorization verification failed:", e);
        if (user.email && user.email.toLowerCase() === AUTHORIZED_OWNER_EMAIL.toLowerCase()) {
            return true;
        }
        return false;
    }
}

// =========================================
// AUTHENTICATION & OWNER DASHBOARD
// =========================================
function setupAuthAndModals() {
    const ownerTopBar = document.getElementById("ownerTopBar");
    const ownerUserEmail = document.getElementById("ownerUserEmail");
    const openDashboardBtn = document.getElementById("openDashboardBtn");
    const ownerSignOutBtn = document.getElementById("ownerSignOutBtn");
    const navOwnerBtn = document.getElementById("navOwnerBtn");
    const footerOwnerLink = document.getElementById("footerOwnerLink");
    const mobileOwnerBtn = document.getElementById("mobileOwnerBtn");

    const loginModal = document.getElementById("ownerLoginModal");
    const closeLoginModalBtn = document.getElementById("closeLoginModalBtn");
    const loginForm = document.getElementById("ownerLoginForm");
    const loginErrorMsg = document.getElementById("loginErrorMsg");
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

    const dashboardModal = document.getElementById("ownerDashboardModal");
    const closeDashboardModalBtn = document.getElementById("closeDashboardModalBtn");

    // Modal open/close helpers
    function openLogin() {
        loginErrorMsg.style.display = "none";
        loginModal.classList.add("active");
    }

    function closeLogin() {
        loginModal.classList.remove("active");
    }

    function openDashboard() {
        if (!currentAuthUser) {
            openLogin();
            return;
        }
        dashboardModal.classList.add("active");
        renderBranchesInDashboard();
        renderMenuInDashboard();
        loadReservationsRealtime();
    }

    function closeDashboard() {
        dashboardModal.classList.remove("active");
    }

    // Nav & footer triggers
    if (navOwnerBtn) {
        navOwnerBtn.addEventListener("click", () => {
            if (currentAuthUser) {
                openDashboard();
            } else {
                openLogin();
            }
        });
    }

    if (footerOwnerLink) {
        footerOwnerLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (currentAuthUser) {
                openDashboard();
            } else {
                openLogin();
            }
        });
    }

    if (mobileOwnerBtn) {
        mobileOwnerBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (window._closeMobileMenu) {
                window._closeMobileMenu();
            }
            if (currentAuthUser) {
                openDashboard();
            } else {
                openLogin();
            }
        });
    }

    if (openDashboardBtn) openDashboardBtn.addEventListener("click", openDashboard);
    if (closeLoginModalBtn) closeLoginModalBtn.addEventListener("click", closeLogin);
    if (closeDashboardModalBtn) closeDashboardModalBtn.addEventListener("click", closeDashboard);

    // Close on backdrop click
    [loginModal, dashboardModal].forEach(m => {
        if (!m) return;
        m.addEventListener("click", (e) => {
            if (e.target === m) {
                m.classList.remove("active");
            }
        });
    });

    // Sign in form with authorization enforcement
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("ownerEmail").value.trim();
            const password = document.getElementById("ownerPassword").value;
            const submitBtn = document.getElementById("loginSubmitBtn");

            submitBtn.disabled = true;
            submitBtn.innerHTML = "<span>Authenticating...</span>";
            loginErrorMsg.style.display = "none";

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const isAuthorized = await checkIsAuthorizedOwner(userCredential.user);

                if (!isAuthorized) {
                    await signOut(auth);
                    currentAuthUser = null;
                    loginErrorMsg.style.display = "block";
                    loginErrorMsg.textContent = "Access denied: This account is not an authorized owner.";
                    return;
                }

                currentAuthUser = userCredential.user;
                closeLogin();
                openDashboard();
            } catch (err) {
                console.error("Login attempt failed:", err);
                loginErrorMsg.style.display = "block";
                if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
                    loginErrorMsg.textContent = "Incorrect password. Please verify your password or use 'Forgot Password' below.";
                } else if (err.code === "auth/user-not-found") {
                    loginErrorMsg.textContent = "No user found with this email. Please verify your email address.";
                } else if (err.code === "auth/too-many-requests") {
                    loginErrorMsg.textContent = "Access temporarily blocked due to multiple failed attempts. Please reset password or try again later.";
                } else {
                    loginErrorMsg.textContent = err.message || "Failed to sign in. Please verify your credentials.";
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = "<span>Sign In to Dashboard</span>";
            }
        });
    }

    // Forgot password
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const email = document.getElementById("ownerEmail").value.trim();
            if (!email) {
                loginErrorMsg.style.display = "block";
                loginErrorMsg.className = "reservation-status-msg error";
                loginErrorMsg.textContent = "Please enter your email address in the field above first.";
                return;
            }
            try {
                await sendPasswordResetEmail(auth, email);
                loginErrorMsg.style.display = "block";
                loginErrorMsg.className = "reservation-status-msg success";
                loginErrorMsg.textContent = `Password reset link sent to ${email}! Please check your email inbox and spam folder.`;
                showToast(`Password reset link sent to ${email}`);
            } catch (err) {
                console.error("Password reset error:", err);
                loginErrorMsg.style.display = "block";
                loginErrorMsg.className = "reservation-status-msg error";
                if (err.code === "auth/user-not-found") {
                    loginErrorMsg.textContent = "No Firebase user found with this email.";
                } else {
                    loginErrorMsg.textContent = "Unable to send password reset email. Please check your network and try again.";
                }
            }
        });
    }

    // Secure Sign out
    if (ownerSignOutBtn) {
        ownerSignOutBtn.addEventListener("click", async () => {
            try {
                await signOut(auth);
                currentAuthUser = null;
                closeDashboard();
                if (unsubscribeReservations) {
                    unsubscribeReservations();
                    unsubscribeReservations = null;
                }
                reservationsList = [];
                ownerTopBar.classList.remove("visible");
                if (ownerUserEmail) ownerUserEmail.textContent = "";
                if (navOwnerBtn) {
                    navOwnerBtn.textContent = "Owner Login";
                    navOwnerBtn.style.color = "";
                    navOwnerBtn.style.borderColor = "";
                }
                if (mobileOwnerBtn) {
                    mobileOwnerBtn.innerHTML = '<span class="owner-icon">🔐</span> <span id="mobileOwnerBtnText">Owner Login</span>';
                    mobileOwnerBtn.classList.remove("logged-in");
                }
                showToast("Signed out successfully");
            } catch (err) {
                console.error("Sign out error:", err);
            }
        });
    }

    // Listen to Firebase Auth state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const isAuthorized = await checkIsAuthorizedOwner(user);
            if (!isAuthorized) {
                console.warn("Unauthorized user attempted session:", user.email);
                await signOut(auth);
                currentAuthUser = null;
                ownerTopBar.classList.remove("visible");
                if (ownerUserEmail) ownerUserEmail.textContent = "";
                if (navOwnerBtn) {
                    navOwnerBtn.textContent = "Owner Login";
                    navOwnerBtn.style.color = "";
                    navOwnerBtn.style.borderColor = "";
                }
                if (mobileOwnerBtn) {
                    mobileOwnerBtn.innerHTML = '<span class="owner-icon">🔐</span> <span id="mobileOwnerBtnText">Owner Login</span>';
                    mobileOwnerBtn.classList.remove("logged-in");
                }
                showToast("Access denied: Not an authorized owner.", true);
                return;
            }

            currentAuthUser = user;
            ownerTopBar.classList.add("visible");
            if (ownerUserEmail) ownerUserEmail.textContent = user.email;
            if (navOwnerBtn) {
                navOwnerBtn.innerHTML = "👑 Owner Dashboard";
                navOwnerBtn.style.color = "#d8b66c";
                navOwnerBtn.style.borderColor = "#d8b66c";
            }
            if (mobileOwnerBtn) {
                mobileOwnerBtn.innerHTML = '<span class="owner-icon">👑</span> <span id="mobileOwnerBtnText">Owner Dashboard</span>';
                mobileOwnerBtn.classList.add("logged-in");
            }
            loadReservationsRealtime();
        } else {
            currentAuthUser = null;
            ownerTopBar.classList.remove("visible");
            if (ownerUserEmail) ownerUserEmail.textContent = "";
            if (navOwnerBtn) {
                navOwnerBtn.textContent = "Owner Login";
                navOwnerBtn.style.color = "";
                navOwnerBtn.style.borderColor = "";
            }
            if (mobileOwnerBtn) {
                mobileOwnerBtn.innerHTML = '<span class="owner-icon">🔐</span> <span id="mobileOwnerBtnText">Owner Login</span>';
                mobileOwnerBtn.classList.remove("logged-in");
            }
            if (unsubscribeReservations) {
                unsubscribeReservations();
                unsubscribeReservations = null;
            }
            reservationsList = [];
        }
    });

    setupDashboardTabs();
    setupSettingsForm();
    setupBranchesManager();
    setupMenuManager();
    setupReservationsManager();
}

// Tab Switching
function setupDashboardTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const targetId = btn.getAttribute("data-tab");
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) targetPanel.classList.add("active");
        });
    });
}

// 1. Settings Form (Owner Write Protected)
function setupSettingsForm() {
    const form = document.getElementById("settingsForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentAuthUser) {
            showToast("Unauthorized. Please log in as owner.", true);
            return;
        }

        const saveBtn = document.getElementById("saveSettingsBtn");
        saveBtn.disabled = true;
        saveBtn.innerHTML = "💾 Saving to Firestore...";

        const updated = {
            restaurantName: document.getElementById("settingRestName").value.trim(),
            tagline: document.getElementById("settingTagline").value.trim(),
            heroTitle: document.getElementById("settingHeroTitle").value.trim(),
            heroDescription: document.getElementById("settingHeroDesc").value.trim(),
            aboutHeading: document.getElementById("settingAboutHeading").value.trim(),
            aboutDescription: document.getElementById("settingAboutDesc").value.trim(),
            phone: document.getElementById("settingPhone").value.trim(),
            email: document.getElementById("settingEmail").value.trim(),
            whatsapp: document.getElementById("settingWhatsapp").value.trim(),
            footerTagline: document.getElementById("settingFooterTagline").value.trim(),
            updatedAt: serverTimestamp()
        };

        try {
            await setDoc(doc(db, "settings", "general"), updated, { merge: true });
            currentSettings = { ...currentSettings, ...updated };
            applySettingsToDOM();
            showToast("Settings saved and updated live!");
        } catch (err) {
            console.error("Error saving settings:", err);
            showToast("Failed to save settings. Please try again.", true);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = "💾 Save Settings to Firestore";
        }
    });
}

// 2. Branches Manager (Owner Write Protected)
function setupBranchesManager() {
    const showAddBtn = document.getElementById("showAddBranchBtn");
    const formCard = document.getElementById("branchFormCard");
    const formTitle = document.getElementById("branchFormTitle");
    const editForm = document.getElementById("branchEditForm");
    const cancelBtn = document.getElementById("cancelBranchFormBtn");

    if (showAddBtn) {
        showAddBtn.addEventListener("click", () => {
            editForm.reset();
            document.getElementById("branchEditId").value = "";
            document.getElementById("branchEditNumber").value = `BRANCH 0${branchesList.length + 1}`;
            formTitle.textContent = "Add New Branch";
            formCard.style.display = "block";
            formCard.scrollIntoView({ behavior: "smooth" });
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            formCard.style.display = "none";
        });
    }

    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentAuthUser) {
                showToast("Unauthorized. Please log in as owner.", true);
                return;
            }

            const editId = document.getElementById("branchEditId").value.trim();
            const branchNumber = document.getElementById("branchEditNumber").value.trim();
            const city = document.getElementById("branchEditCity").value.trim();
            const name = document.getElementById("branchEditName").value.trim();
            const phone = document.getElementById("branchEditPhone").value.trim();
            const address = document.getElementById("branchEditAddress").value.trim();
            const hours = document.getElementById("branchEditHours").value.trim();
            const mapQuery = document.getElementById("branchEditMap").value.trim();
            const rawImageUrl = document.getElementById("branchEditImage").value.trim();
            const imageUrl = sanitizeUrl(rawImageUrl) || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85";
            const description = document.getElementById("branchEditDesc").value.trim();

            const branchData = {
                branchNumber,
                city,
                name,
                phone,
                address,
                hours,
                mapQuery: mapQuery || `${name}+${city}`,
                imageUrl,
                description,
                order: branchesList.length + 1
            };

            try {
                if (editId) {
                    await setDoc(doc(db, "branches", editId), branchData, { merge: true });
                    showToast(`Branch "${name}" updated successfully!`);
                } else {
                    const newRef = doc(collection(db, "branches"));
                    await setDoc(newRef, branchData);
                    showToast(`Branch "${name}" added successfully!`);
                }

                formCard.style.display = "none";
                await loadBranches();
            } catch (err) {
                console.error("Error saving branch:", err);
                showToast("Failed to save branch. Please check inputs and try again.", true);
            }
        });
    }
}

function renderBranchesInDashboard() {
    const container = document.getElementById("branchesMgmtGrid");
    const countBadge = document.getElementById("branchCountBadge");
    if (countBadge) countBadge.textContent = branchesList.length;
    if (!container) return;

    container.innerHTML = "";

    branchesList.forEach(b => {
        const card = document.createElement("div");
        card.className = "mgmt-card";

        card.innerHTML = `
            <div>
                <h4>
                    <span>${escapeHtml(b.name)}</span>
                    <small style="color: #999; font-size: 11px;">${escapeHtml(b.branchNumber)}</small>
                </h4>
                <div class="mgmt-meta" style="margin-top: 10px;">
                    <div><strong>City:</strong> ${escapeHtml(b.city)}</div>
                    <div><strong>Address:</strong> ${escapeHtml(b.address)}</div>
                    <div><strong>Hours:</strong> ${escapeHtml(b.hours)}</div>
                    <div><strong>Phone:</strong> ${escapeHtml(b.phone)}</div>
                </div>
            </div>
            <div class="mgmt-actions">
                <button class="btn-small edit" data-edit-branch="${escapeHtml(b.id)}">✏️ Edit</button>
                <button class="btn-small delete" data-delete-branch="${escapeHtml(b.id)}">🗑️ Delete</button>
            </div>
        `;
        container.appendChild(card);
    });

    // Wire edit & delete buttons
    container.querySelectorAll("[data-edit-branch]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-edit-branch");
            const b = branchesList.find(x => x.id === id);
            if (!b) return;

            document.getElementById("branchEditId").value = b.id;
            document.getElementById("branchEditNumber").value = b.branchNumber || "";
            document.getElementById("branchEditCity").value = b.city || "";
            document.getElementById("branchEditName").value = b.name || "";
            document.getElementById("branchEditPhone").value = b.phone || "";
            document.getElementById("branchEditAddress").value = b.address || "";
            document.getElementById("branchEditHours").value = b.hours || "";
            document.getElementById("branchEditMap").value = b.mapQuery || "";
            document.getElementById("branchEditImage").value = b.imageUrl || "";
            document.getElementById("branchEditDesc").value = b.description || "";

            const formCard = document.getElementById("branchFormCard");
            document.getElementById("branchFormTitle").textContent = `Edit Branch: ${b.name}`;
            formCard.style.display = "block";
            formCard.scrollIntoView({ behavior: "smooth" });
        });
    });

    container.querySelectorAll("[data-delete-branch]").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!currentAuthUser) {
                showToast("Unauthorized. Please log in as owner.", true);
                return;
            }

            const id = btn.getAttribute("data-delete-branch");
            const b = branchesList.find(x => x.id === id);
            if (!b) return;

            if (confirm(`Are you sure you want to delete branch "${b.name}"?`)) {
                try {
                    await deleteDoc(doc(db, "branches", id));
                    showToast(`Branch "${b.name}" deleted.`);
                    await loadBranches();
                } catch (err) {
                    console.error("Error deleting branch:", err);
                    showToast("Failed to delete branch. Please try again.", true);
                }
            }
        });
    });
}

// 3. Menu Manager (Owner Write Protected)
function setupMenuManager() {
    const showAddBtn = document.getElementById("showAddMenuBtn");
    const formCard = document.getElementById("menuFormCard");
    const formTitle = document.getElementById("menuFormTitle");
    const editForm = document.getElementById("menuEditForm");
    const cancelBtn = document.getElementById("cancelMenuFormBtn");

    if (showAddBtn) {
        showAddBtn.addEventListener("click", () => {
            editForm.reset();
            document.getElementById("menuEditId").value = "";
            document.getElementById("menuEditAvailable").checked = true;
            formTitle.textContent = "Add New Dish";
            formCard.style.display = "block";
            formCard.scrollIntoView({ behavior: "smooth" });
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            formCard.style.display = "none";
        });
    }

    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentAuthUser) {
                showToast("Unauthorized. Please log in as owner.", true);
                return;
            }

            const editId = document.getElementById("menuEditId").value.trim();
            const name = document.getElementById("menuEditName").value.trim();
            const price = document.getElementById("menuEditPrice").value.trim();
            const description = document.getElementById("menuEditDesc").value.trim();
            const available = document.getElementById("menuEditAvailable").checked;

            const itemData = {
                name,
                price,
                description,
                available,
                order: menuList.length + 1
            };

            try {
                if (editId) {
                    await setDoc(doc(db, "menu", editId), itemData, { merge: true });
                    showToast(`Item "${name}" updated!`);
                } else {
                    const newRef = doc(collection(db, "menu"));
                    await setDoc(newRef, itemData);
                    showToast(`Item "${name}" added to menu!`);
                }

                formCard.style.display = "none";
                await loadMenu();
            } catch (err) {
                console.error("Error saving dish:", err);
                showToast("Failed to save menu item. Please try again.", true);
            }
        });
    }
}

function renderMenuInDashboard() {
    const container = document.getElementById("menuMgmtGrid");
    const countBadge = document.getElementById("menuCountBadge");
    if (countBadge) countBadge.textContent = menuList.length;
    if (!container) return;

    container.innerHTML = "";

    menuList.forEach(item => {
        const card = document.createElement("div");
        card.className = "mgmt-card";

        card.innerHTML = `
            <div>
                <h4>
                    <span>${escapeHtml(item.name)}</span>
                    <strong style="color: #d8b66c; font-size: 16px;">${escapeHtml(item.price)}</strong>
                </h4>
                <div class="mgmt-meta" style="margin-top: 10px;">
                    <div>${escapeHtml(item.description || "")}</div>
                    <div style="margin-top: 6px;">
                        <strong>Availability:</strong> 
                        <span class="status-badge ${item.available !== false ? 'confirmed' : 'cancelled'}">
                            ${item.available !== false ? "In Stock" : "Sold Out"}
                        </span>
                    </div>
                </div>
            </div>
            <div class="mgmt-actions">
                <button class="btn-small edit" data-edit-menu="${escapeHtml(item.id)}">✏️ Edit</button>
                <button class="btn-small ${item.available !== false ? 'delete' : 'success'}" data-toggle-menu="${escapeHtml(item.id)}">
                    ${item.available !== false ? "Mark Sold Out" : "Mark In Stock"}
                </button>
                <button class="btn-small delete" data-delete-menu="${escapeHtml(item.id)}">🗑️ Delete</button>
            </div>
        `;
        container.appendChild(card);
    });

    // Wire buttons
    container.querySelectorAll("[data-edit-menu]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-edit-menu");
            const item = menuList.find(x => x.id === id);
            if (!item) return;

            document.getElementById("menuEditId").value = item.id;
            document.getElementById("menuEditName").value = item.name || "";
            document.getElementById("menuEditPrice").value = item.price || "";
            document.getElementById("menuEditDesc").value = item.description || "";
            document.getElementById("menuEditAvailable").checked = item.available !== false;

            const formCard = document.getElementById("menuFormCard");
            document.getElementById("menuFormTitle").textContent = `Edit Dish: ${item.name}`;
            formCard.style.display = "block";
            formCard.scrollIntoView({ behavior: "smooth" });
        });
    });

    container.querySelectorAll("[data-toggle-menu]").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!currentAuthUser) {
                showToast("Unauthorized. Please log in as owner.", true);
                return;
            }

            const id = btn.getAttribute("data-toggle-menu");
            const item = menuList.find(x => x.id === id);
            if (!item) return;

            const newStatus = !(item.available !== false);
            try {
                await updateDoc(doc(db, "menu", id), { available: newStatus });
                showToast(`"${item.name}" marked as ${newStatus ? "In Stock" : "Sold Out"}`);
                await loadMenu();
            } catch (err) {
                console.error("Error toggling item availability:", err);
                showToast("Failed to update dish availability. Please try again.", true);
            }
        });
    });

    container.querySelectorAll("[data-delete-menu]").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!currentAuthUser) {
                showToast("Unauthorized. Please log in as owner.", true);
                return;
            }

            const id = btn.getAttribute("data-delete-menu");
            const item = menuList.find(x => x.id === id);
            if (!item) return;

            if (confirm(`Are you sure you want to remove "${item.name}" from the menu?`)) {
                try {
                    await deleteDoc(doc(db, "menu", id));
                    showToast(`Dish "${item.name}" removed.`);
                    await loadMenu();
                } catch (err) {
                    console.error("Error deleting dish:", err);
                    showToast("Failed to remove dish. Please try again.", true);
                }
            }
        });
    });
}

// 4. Reservations Manager (Owner Read/Update/Delete Protected)
function setupReservationsManager() {
    const refreshBtn = document.getElementById("refreshReservationsBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadReservationsRealtime();
            showToast("Reservations refreshed");
        });
    }
}

function loadReservationsRealtime() {
    if (!currentAuthUser) return;

    if (unsubscribeReservations) {
        unsubscribeReservations();
    }

    try {
        const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"));
        unsubscribeReservations = onSnapshot(q, (snapshot) => {
            reservationsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderReservationsInDashboard();
        }, (err) => {
            console.error("Error listening to reservations:", err);
            // Non-owners or failed rules clear list immediately
            reservationsList = [];
            renderReservationsInDashboard();
        });
    } catch (err) {
        console.error("Could not setup reservations listener:", err);
    }
}

function renderReservationsInDashboard() {
    const tbody = document.getElementById("reservationsTableBody");
    const countBadge = document.getElementById("resCountBadge");
    if (countBadge) countBadge.textContent = String(reservationsList.length);
    if (!tbody) return;

    if (reservationsList.length === 0) {
        tbody.innerHTML = "";
        const emptyTr = document.createElement("tr");
        const emptyTd = document.createElement("td");
        emptyTd.colSpan = 7;
        emptyTd.style.textAlign = "center";
        emptyTd.style.color = "#888";
        emptyTd.style.padding = "25px";
        emptyTd.textContent = "No reservations recorded yet. New requests will appear here in real time.";
        emptyTr.appendChild(emptyTd);
        tbody.appendChild(emptyTr);
        return;
    }

    tbody.innerHTML = "";

    reservationsList.forEach(res => {
        const tr = document.createElement("tr");

        // 1. Date & Time (safe textContent)
        const dateTd = document.createElement("td");
        const dateStrong = document.createElement("strong");
        dateStrong.textContent = res.date || "N/A";
        dateTd.appendChild(dateStrong);
        if (res.time) {
            const timeBr = document.createElement("br");
            const timeSmall = document.createElement("small");
            timeSmall.style.color = "#aaa";
            timeSmall.textContent = res.time;
            dateTd.appendChild(timeBr);
            dateTd.appendChild(timeSmall);
        }
        tr.appendChild(dateTd);

        // 2. Branch (safe textContent)
        const branchTd = document.createElement("td");
        branchTd.textContent = res.branch || "General";
        tr.appendChild(branchTd);

        // 3. Customer Name & Notes (safe textContent)
        const customerTd = document.createElement("td");
        const nameStrong = document.createElement("strong");
        nameStrong.textContent = res.customerName || "Guest";
        customerTd.appendChild(nameStrong);
        if (res.notes) {
            const noteBr = document.createElement("br");
            const noteSmall = document.createElement("small");
            noteSmall.style.color = "#e8cd8f";
            noteSmall.textContent = `Note: ${res.notes}`;
            customerTd.appendChild(noteBr);
            customerTd.appendChild(noteSmall);
        }
        tr.appendChild(customerTd);

        // 4. Phone & Email (safe textContent and safe href)
        const contactTd = document.createElement("td");
        const phone = res.customerPhone || "";
        const cleanPhone = cleanPhoneDigits(phone);
        const phoneLink = document.createElement("a");
        phoneLink.href = `tel:${cleanPhone}`;
        phoneLink.style.color = "#d8b66c";
        phoneLink.textContent = phone;
        contactTd.appendChild(phoneLink);
        if (res.customerEmail) {
            const emailBr = document.createElement("br");
            const emailSmall = document.createElement("small");
            emailSmall.style.color = "#888";
            emailSmall.textContent = res.customerEmail;
            contactTd.appendChild(emailBr);
            contactTd.appendChild(emailSmall);
        }
        tr.appendChild(contactTd);

        // 5. Guests (safe textContent)
        const guestsTd = document.createElement("td");
        guestsTd.textContent = `${res.guests || 1} Guest(s)`;
        tr.appendChild(guestsTd);

        // 6. Status Badge (safe textContent)
        const statusTd = document.createElement("td");
        const statusBadge = document.createElement("span");
        const statusText = res.status || "Pending";
        statusBadge.className = `status-badge ${statusText.toLowerCase()}`;
        statusBadge.textContent = statusText;
        statusTd.appendChild(statusBadge);
        tr.appendChild(statusTd);

        // 7. Actions (buttons with event listeners)
        const actionsTd = document.createElement("td");
        const actionsDiv = document.createElement("div");
        actionsDiv.style.display = "flex";
        actionsDiv.style.gap = "6px";
        actionsDiv.style.flexWrap = "wrap";

        if (res.status !== "Confirmed") {
            const confirmBtn = document.createElement("button");
            confirmBtn.className = "btn-small success";
            confirmBtn.textContent = "Confirm";
            confirmBtn.addEventListener("click", async () => {
                if (!currentAuthUser) return;
                try {
                    await updateDoc(doc(db, "reservations", res.id), { status: "Confirmed" });
                    showToast("Reservation confirmed!");
                } catch (err) {
                    console.error("Error confirming reservation:", err);
                    showToast("Failed to confirm reservation.", true);
                }
            });
            actionsDiv.appendChild(confirmBtn);
        }

        if (res.status !== "Cancelled") {
            const cancelBtn = document.createElement("button");
            cancelBtn.className = "btn-small delete";
            cancelBtn.textContent = "Cancel";
            cancelBtn.addEventListener("click", async () => {
                if (!currentAuthUser) return;
                try {
                    await updateDoc(doc(db, "reservations", res.id), { status: "Cancelled" });
                    showToast("Reservation cancelled.");
                } catch (err) {
                    console.error("Error cancelling reservation:", err);
                    showToast("Failed to cancel reservation.", true);
                }
            });
            actionsDiv.appendChild(cancelBtn);
        }

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-small outline";
        deleteBtn.style.border = "1px solid #555";
        deleteBtn.style.color = "#bbb";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", async () => {
            if (!currentAuthUser) return;
            if (confirm("Permanently delete this reservation record?")) {
                try {
                    await deleteDoc(doc(db, "reservations", res.id));
                    showToast("Reservation deleted.");
                } catch (err) {
                    console.error("Error deleting reservation:", err);
                    showToast("Failed to delete reservation.", true);
                }
            }
        });
        actionsDiv.appendChild(deleteBtn);

        actionsTd.appendChild(actionsDiv);
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
    });
}

// =========================================
// SMOOTH SCROLLING & CARD ANIMATIONS
// =========================================
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
            const targetId = this.getAttribute("href");
            if (targetId === "#") return;

            const target = document.querySelector(targetId);
            if (target) {
                event.preventDefault();
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
    });
}

function observeCards() {
    const cards = document.querySelectorAll(".branch-card");
    const observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("show");
                }
            });
        },
        { threshold: 0.15 }
    );

    cards.forEach(function (card) {
        observer.observe(card);
    });
}

// =========================================
// RESPONSIVE MOBILE NAVIGATION
// =========================================
function setupMobileNavigation() {
    const mobileMenuToggle = document.getElementById("mobileMenuToggle");
    const closeMobileMenuBtn = document.getElementById("closeMobileMenuBtn");
    const mobileNavDrawer = document.getElementById("mobileNavDrawer");
    const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
    const mobileNavLinks = document.querySelectorAll(".mobile-nav-link");

    function openMenu() {
        if (!mobileNavDrawer || !mobileNavBackdrop) return;
        mobileNavDrawer.classList.add("is-open");
        mobileNavBackdrop.classList.add("is-open");
        if (mobileMenuToggle) {
            mobileMenuToggle.classList.add("is-active");
            mobileMenuToggle.setAttribute("aria-expanded", "true");
        }
        document.body.style.overflow = "hidden";
    }

    function closeMenu() {
        if (!mobileNavDrawer || !mobileNavBackdrop) return;
        mobileNavDrawer.classList.remove("is-open");
        mobileNavBackdrop.classList.remove("is-open");
        if (mobileMenuToggle) {
            mobileMenuToggle.classList.remove("is-active");
            mobileMenuToggle.setAttribute("aria-expanded", "false");
        }
        document.body.style.overflow = "";
    }

    window._closeMobileMenu = closeMenu;

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener("click", () => {
            if (mobileNavDrawer && mobileNavDrawer.classList.contains("is-open")) {
                closeMenu();
            } else {
                openMenu();
            }
        });
    }

    if (closeMobileMenuBtn) {
        closeMobileMenuBtn.addEventListener("click", closeMenu);
    }

    if (mobileNavBackdrop) {
        mobileNavBackdrop.addEventListener("click", closeMenu);
    }

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && mobileNavDrawer && mobileNavDrawer.classList.contains("is-open")) {
            closeMenu();
        }
    });

    // Close when any mobile nav link is clicked
    mobileNavLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            const href = link.getAttribute("href");
            closeMenu();
            if (href === "index.html" || href === "#" || href === "#top") {
                if (window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/")) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }
            }
        });
    });

    // Close if resized to desktop width
    window.addEventListener("resize", () => {
        if (window.innerWidth > 900 && mobileNavDrawer && mobileNavDrawer.classList.contains("is-open")) {
            closeMenu();
        }
    });
}

// =========================================
// INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", async () => {
    setupMobileNavigation();
    setupSmoothScrolling();
    setupReservationForm();
    setupAuthAndModals();

    // Load live Firestore content
    await loadWebsiteSettings();
    await loadBranches();
    await loadMenu();
});
