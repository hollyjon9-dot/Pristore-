import { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyDef4V0YWxFLVNKjY8qWXPld6iLR9jWpcE",
  authDomain: "pristore-3cd7d.firebaseapp.com",
  projectId: "pristore-3cd7d",
  messagingSenderId: "521855008847",
  appId: "1:521855008847:web:bb0bf7c8f758b8a7c16a3a",
};

const VAPID_KEY =
  "BJZlLjKZqxecyE5oouL1CdFjZct7LLZmB1g0gdDTGd8naqTWzGKzfr3hmhe6eN8s9Ou1BFTiC9Y8_9UevU54dhw";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= CONFIG =================
const WEBSITE_URL = "https://pristore.vercel.app";
const WA_ADMIN = "https://wa.me/6289652422346";
const SAMPLE_VIDEO_LINK =
  "https://drive.google.com/drive/folders/1PKn9VQJp2_sK7C5H9GIVdZ9wmk9dD4XJ";

// ================= HELPERS =================
const nowTs = () => Date.now();

const formatRp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

const getHargaPaket = (paket) => {
  if (paket === "Premium") return 250000;
  if (paket === "Gold") return 500000;
  return 100000;
};

const getHargaPaketLabel = (paket) => {
  if (paket === "Premium") return "Rp250.000";
  if (paket === "Gold") return "Rp500.000";
  return "Rp100.000";
};

const getKomisiPaket = (paket) => {
  if (paket === "Premium") return 70000;
  if (paket === "Gold") return 200000;
  return 40000;
};

const normalizeText = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const copyText = async (text, okMsg = "Berhasil disalin.") => {
  try {
    await navigator.clipboard.writeText(text || "");
    alert(okMsg);
  } catch {
    alert("Gagal menyalin.");
  }
};

const makeNotif = (title, message) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  message,
  createdAt: nowTs(),
  read: false,
});

const safe = (v) => (v === undefined || v === null || v === "" ? "-" : v);

const toDateKey = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDateTime = (ts) => {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("id-ID");
};

const setAppBadgeCount = async (count) => {
  try {
    if (count > 0 && "setAppBadge" in navigator) {
      await navigator.setAppBadge(count);
    } else if (count <= 0 && "clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
    }
  } catch (err) {
    console.log("Badge API tidak aktif:", err);
  }
};

// ================= APP =================
export default function App() {
  // ================= GLOBAL =================
  const [page, setPage] = useState("home");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ================= FORM =================
  const [namaLengkap, setNamaLengkap] = useState("");
  const [paket, setPaket] = useState("Standar");
  const [bankNomorRekening, setBankNomorRekening] = useState("");
  const [noHp, setNoHp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");

  // ================= UI =================
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [resetInfo, setResetInfo] = useState("");

  // ================= ADMIN STATE =================
  const [usersAdmin, setUsersAdmin] = useState([]);
  const [adminFeed, setAdminFeed] = useState([]);
  const [komisiRows, setKomisiRows] = useState([]);
  const [search, setSearch] = useState("");
  const [filterPaket, setFilterPaket] = useState("all");
  const [selectedDate, setSelectedDate] = useState(toDateKey(nowTs()));
  const [openSection, setOpenSection] = useState("overview");
  const [openNotifGroup, setOpenNotifGroup] = useState("daftar");

  // ================= BADGE STATE =================
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [customerUnreadCount, setCustomerUnreadCount] = useState(0);

  // ================= PUSH SETUP =================
  useEffect(() => {
    const setupMessaging = async () => {
      try {
        if (!("Notification" in window)) return;
        if (!auth.currentUser) return;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const messaging = getMessaging(app);

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
        });

        if (token) {
          console.log("TOKEN:", token);

          await setDoc(
            doc(db, "device_tokens", token),
            {
              token,
              uid: auth.currentUser?.uid || "",
              role: isAdmin ? "admin" : "customer",
              createdAt: Date.now(),
            },
            { merge: true }
          );
        }

        onMessage(messaging, (payload) => {
          console.log("Notif masuk:", payload);

          if (payload?.notification) {
            new Notification(payload.notification.title, {
              body: payload.notification.body,
              icon: "/logo192.png",
            });
          }

          if ("setAppBadge" in navigator) {
            const count = Number(payload?.data?.unreadCount || 1);
            navigator.setAppBadge(count);
          }
        });
      } catch (err) {
        console.log("Error messaging:", err);
      }
    };

    setupMessaging();
  }, [isAdmin]);

  // ================= APP FEEL =================
  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = "#020617";
    document.documentElement.style.scrollBehavior = "smooth";
  }, []);

  // ================= RESET MESSAGE AUTO HIDE =================
  useEffect(() => {
    if (!resetInfo) return;
    const timer = setTimeout(() => setResetInfo(""), 3000);
    return () => clearTimeout(timer);
  }, [resetInfo]);

  // ================= REFERRAL ANTI HILANG =================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");

    if (ref) {
      localStorage.setItem("referral_code", ref);
      setRefCode(ref);
    } else {
      const saved = localStorage.getItem("referral_code");
      if (saved) setRefCode(saved);
    }
  }, []);

  // ================= HELPERS DB =================
  const addAdminNotif = async (title, message, extra = {}) => {
    await addDoc(collection(db, "admin_notifications"), {
      title,
      message,
      createdAt: nowTs(),
      read: false,
      ...extra,
    });
  };

  const markAdminNotifRead = async (id) => {
    try {
      await setDoc(
        doc(db, "admin_notifications", id),
        { read: true },
        { merge: true }
      );
    } catch (err) {
      console.log(err);
    }
  };

  const addKomisiRow = async (payload) => {
    await addDoc(collection(db, "komisi"), {
      ...payload,
      createdAt: nowTs(),
    });
  };

  const loadUserData = async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const data = { uid, ...snap.data() };
    setUserData(data);
    return data;
  };

  const checkIsAdmin = async (authUser, inputEmail) => {
    const snap = await getDocs(collection(db, "admin"));
    let matched = false;

    snap.forEach((d) => {
      const data = d.data() || {};
      const byUid = normalizeText(data.uid) === normalizeText(authUser.uid);
      const byEmail = normalizeText(data.email) === normalizeText(inputEmail);
      const byDocId = normalizeText(d.id) === normalizeText(authUser.uid);
      if (byUid || byEmail || byDocId) matched = true;
    });

    return matched;
  };

  const pushCustomerNotif = async (uid, oldList, title, message) => {
    await setDoc(
      doc(db, "users", uid),
      {
        notifCustomer: [...(oldList || []), makeNotif(title, message)],
      },
      { merge: true }
    );
  };

  const markAllCustomerNotifRead = async () => {
    try {
      if (!userData?.uid) return;

      const updated = (userData.notifCustomer || []).map((n) => ({
        ...n,
        read: true,
      }));

      await updateDoc(doc(db, "users", userData.uid), {
        notifCustomer: updated,
      });

      await setAppBadgeCount(0);
    } catch (err) {
      console.log(err);
    }
  };

  // ================= AUTO LOGIN / PERSISTENT LOGIN =================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (authUser) => {
      try {
        if (!authUser) {
          setIsAdmin(false);
          setUserData(null);
          setUsersAdmin([]);
          setAdminFeed([]);
          setKomisiRows([]);
          setPage("home");
          setAuthChecked(true);
          return;
        }

        const admin = await checkIsAdmin(authUser, authUser.email || "");

        if (admin) {
          setIsAdmin(true);
          setPage("admin");
          setAuthChecked(true);
          return;
        }

        setIsAdmin(false);
        const loaded = await loadUserData(authUser.uid);

        if (loaded) {
          setPage("dashboard");
        } else {
          await signOut(auth);
          setPage("home");
        }
      } catch (err) {
        console.log(err);
        setPage("home");
      } finally {
        setAuthChecked(true);
      }
    });

    return () => unsub();
  }, []);

  // ================= REALTIME CURRENT USER =================
  useEffect(() => {
    if (!auth.currentUser || isAdmin) return;

    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        setUserData({ uid: snap.id, ...snap.data() });
      }
    });

    return () => unsub();
  }, [isAdmin]);

  // ================= REALTIME ADMIN =================
  useEffect(() => {
    if (!isAdmin) return;

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsersAdmin(rows);
    });

    const unsubFeed = onSnapshot(
      collection(db, "admin_notifications"),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setAdminFeed(rows);
      }
    );

    const unsubKomisi = onSnapshot(collection(db, "komisi"), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setKomisiRows(rows);
    });

    return () => {
      unsubUsers();
      unsubFeed();
      unsubKomisi();
    };
  }, [isAdmin]);

  // ================= BADGE COUNTS =================
  useEffect(() => {
    const unread = (adminFeed || []).filter((n) => n.read !== true).length;
    setAdminUnreadCount(unread);
    if (isAdmin) setAppBadgeCount(unread);
  }, [adminFeed, isAdmin]);

  useEffect(() => {
    const unread = (userData?.notifCustomer || []).filter(
      (n) => n.read !== true
    ).length;
    setCustomerUnreadCount(unread);
    if (!isAdmin && userData) setAppBadgeCount(unread);
  }, [userData, isAdmin]);

  const processReferralReward = async ({
    buyerUser,
    paketTerbeli,
    sumber,
    countAsReferral,
  }) => {
    if (sumber !== "pendaftaran") return;
    if (!buyerUser?.referredBy) return;

    const q = query(
      collection(db, "users"),
      where("referralCode", "==", buyerUser.referredBy)
    );
    const snap = await getDocs(q);

    for (const d of snap.docs) {
      const refOwner = d.data() || {};
      const refOwnerUid = d.id;

      const komisiMasuk = getKomisiPaket(paketTerbeli);
      const komisiBaru = Number(refOwner.komisiSaldo || 0) + komisiMasuk;

      await setDoc(
        doc(db, "users", refOwnerUid),
        {
          komisiSaldo: komisiBaru,
        },
        { merge: true }
      );

      await pushCustomerNotif(
        refOwnerUid,
        refOwner.notifCustomer || [],
        "Komisi paket masuk",
        `${
          buyerUser.namaLengkap
        } membeli paket ${paketTerbeli}. Komisi ${formatRp(
          komisiMasuk
        )} masuk ke akun kamu.`
      );

      await addKomisiRow({
        refOwnerUid,
        nama: refOwner.namaLengkap || "-",
        email: refOwner.email || "-",
        bankNomorRekening: refOwner.bankNomorRekening || "-",
        dari: buyerUser.namaLengkap || "-",
        paketBeli: paketTerbeli,
        jumlah: komisiMasuk,
        sumber,
      });

      await addAdminNotif(
        "Komisi masuk",
        `${refOwner.namaLengkap} mendapat komisi ${formatRp(
          komisiMasuk
        )} dari ${buyerUser.namaLengkap} (${paketTerbeli}).`
      );

      if (countAsReferral) {
        const totalRekrutBaru = Number(refOwner.jumlahRekrut || 0) + 1;
        let bonusProgressBaru = Number(refOwner.bonusProgress || 0) + 1;
        let bonusQueueBaru = Number(refOwner.bonusQueue || 0);

        if (bonusProgressBaru >= 10) {
          bonusProgressBaru = 0;
          bonusQueueBaru += 1;

          await addAdminNotif(
            "Bonus referral siap dibayar",
            `${refOwner.namaLengkap} sudah mencapai 10 referral. Siap dibayar bonus Rp100.000.`
          );

          await pushCustomerNotif(
            refOwnerUid,
            refOwner.notifCustomer || [],
            "Bonus siap dibayar",
            "Referral kamu sudah genap 10 orang. Bonus Rp100.000 siap dibayar admin."
          );
        }

        await setDoc(
          doc(db, "users", refOwnerUid),
          {
            jumlahRekrut: totalRekrutBaru,
            bonusProgress: bonusProgressBaru,
            bonusQueue: bonusQueueBaru,
          },
          { merge: true }
        );
      }
    }
  };

  // ================= AUTH =================
  const register = async () => {
    try {
      if (
        !namaLengkap ||
        !paket ||
        !bankNomorRekening ||
        !noHp ||
        !email ||
        !password
      ) {
        alert("Semua data wajib diisi.");
        return;
      }

      setLoading(true);

      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const uid = result.user.uid;
      const code = "PRIS" + uid.slice(0, 6).toUpperCase();

      await setDoc(doc(db, "users", uid), {
        namaLengkap,
        paket,
        bankNomorRekening,
        noHp,
        email,
        referralCode: code,
        referredBy: refCode || "",
        jumlahRekrut: 0,

        status: "pending",
        registrationCreatedAt: nowTs(),

        sudahBayar: false,
        paymentRequestSent: false,
        paymentApprovedAt: null,

        referralAdded: false,

        upgradeRequested: false,
        upgradePackage: "",
        upgradeStatus: "",
        upgradeCreatedAt: null,
        upgradeApprovedAt: null,

        komisiSaldo: 0,
        bonusProgress: 0,
        bonusQueue: 0,
        bonusHistory: [],

        withdrawRequest: null,
        withdrawalHistory: [],
        totalWithdrawn: 0,

        approvedAt: null,

        notifCustomer: [],
      });

      await addAdminNotif(
        "User baru daftar",
        `${namaLengkap} mendaftar dengan paket ${paket}.`
      );

      await loadUserData(uid);
      setPage("dashboard");
      alert("Pendaftaran berhasil.");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      if (!email || !password) {
        alert("Email dan password wajib diisi.");
        return;
      }

      setLoading(true);

      await setPersistence(auth, browserLocalPersistence);

      const result = await signInWithEmailAndPassword(auth, email, password);
      const authUser = result.user;

      const admin = await checkIsAdmin(authUser, email);
      if (admin) {
        setIsAdmin(true);
        setPage("admin");
        return;
      }

      setIsAdmin(false);
      const loaded = await loadUserData(authUser.uid);

      if (!loaded) {
        alert("Data user tidak ditemukan.");
        await signOut(auth);
        setPage("home");
        return;
      }

      setPage("dashboard");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async () => {
    if (!email) {
      setResetInfo("❌ Masukkan email terlebih dahulu.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setResetInfo("✅ Reset password akan dikirim ke email kamu.");
    } catch (err) {
      setResetInfo("❌ Email tidak ditemukan atau terjadi kesalahan.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {}

    setPage("home");
    setLoading(false);
    setIsAdmin(false);
    setUserData(null);
    setUsersAdmin([]);
    setAdminFeed([]);
    setKomisiRows([]);
    setSearch("");
    setFilterPaket("all");
    setShowUpgradeOptions(false);
    setWithdrawAmount("");
    setShowHistory(false);
    setEmail("");
    setPassword("");
    setAdminUnreadCount(0);
    setCustomerUnreadCount(0);
    setAppBadgeCount(0);
  };

  // ================= CUSTOMER ACTIONS =================
  const handleSudahBayarDaftar = async () => {
    try {
      if (!userData?.uid) return;

      await setDoc(
        doc(db, "users", userData.uid),
        {
          sudahBayar: true,
          paymentRequestSent: true,
        },
        { merge: true }
      );

      await addAdminNotif(
        "Konfirmasi pembayaran masuk",
        `${userData.namaLengkap} sudah transfer paket ${userData.paket}.`
      );

      const waText = `Halo Admin Pristore

Saya sudah transfer 🙏

Nama: ${userData.namaLengkap}
Email: ${userData.email}
No HP: ${userData.noHp}
Paket: ${userData.paket}
Harga: ${getHargaPaketLabel(userData.paket)}
Referral: ${userData.referredBy || "-"}

Mohon di cek dan approve ya kak`;

      window.open(`${WA_ADMIN}?text=${encodeURIComponent(waText)}`, "_blank");
    } catch (err) {
      alert(err.message);
    }
  };

  const chooseUpgradePackage = async (selectedPackage) => {
    try {
      if (!userData?.uid) return;

      await setDoc(
        doc(db, "users", userData.uid),
        {
          upgradeRequested: true,
          upgradePackage: selectedPackage,
          upgradeStatus: "pending",
          upgradeCreatedAt: nowTs(),
          upgradeApprovedAt: null,
        },
        { merge: true }
      );

      await addAdminNotif(
        "Permintaan update paket",
        `${userData.namaLengkap} meminta update ke paket ${selectedPackage}.`
      );

      const harga = selectedPackage === "Premium" ? "Rp250.000" : "Rp500.000";

      const waText = `Halo Admin Pristore

Saya ingin upgrade paket ke ${selectedPackage}

📦 Paket: ${selectedPackage}
💰 Harga: ${harga}

🧾 Data saya:
Nama: ${userData.namaLengkap}
Email: ${userData.email}
No HP: ${userData.noHp}

Mohon diproses ya kak 🙏`;

      window.open(`${WA_ADMIN}?text=${encodeURIComponent(waText)}`, "_blank");

      setShowUpgradeOptions(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const submitWithdraw = async () => {
    try {
      if (!userData?.uid) return;

      const amount = Number(withdrawAmount || 0);
      const totalSaldo = Number(userData.komisiSaldo || 0);

      if (!amount || amount <= 0) {
        alert("Masukkan jumlah penarikan.");
        return;
      }

      if (amount > totalSaldo) {
        alert("Saldo komisi tidak cukup.");
        return;
      }

      if (userData.withdrawRequest?.status === "pending") {
        alert("Masih ada permintaan penarikan yang menunggu admin.");
        return;
      }

      await setDoc(
        doc(db, "users", userData.uid),
        {
          withdrawRequest: {
            id: `wd-${Date.now()}`,
            amount,
            status: "pending",
            requestedAt: nowTs(),
          },
        },
        { merge: true }
      );

      await addAdminNotif(
        "Permintaan penarikan",
        `${userData.namaLengkap} meminta penarikan ${formatRp(amount)}.`
      );

      setWithdrawAmount("");
      alert("Permintaan penarikan berhasil dikirim.");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= ADMIN ACTIONS =================
  const approveRegistration = async (u) => {
    try {
      const approvedTs = nowTs();

      await setDoc(
        doc(db, "users", u.id),
        {
          status: "approved",
          paymentApprovedAt: approvedTs,
          approvedAt: approvedTs,
        },
        { merge: true }
      );

      if (u.referredBy && !u.referralAdded) {
        await processReferralReward({
          buyerUser: { ...u, uid: u.id },
          paketTerbeli: u.paket,
          sumber: "pendaftaran",
          countAsReferral: true,
        });

        await setDoc(
          doc(db, "users", u.id),
          { referralAdded: true },
          { merge: true }
        );
      }

      await addAdminNotif(
        "Pendaftaran di-approve",
        `${u.namaLengkap} berhasil di-approve admin.`
      );

      alert("Pendaftaran berhasil dikonfirmasi admin.");
    } catch (err) {
      alert(err.message);
    }
  };

  const approveUpgrade = async (u) => {
    try {
      const paketBaru = u.upgradePackage;
      const approvedTs = nowTs();

      await setDoc(
        doc(db, "users", u.id),
        {
          paket: paketBaru,
          upgradeStatus: "approved",
          upgradeRequested: false,
          upgradeApprovedAt: approvedTs,
          approvedAt: approvedTs,
          upgradePackage: "",
        },
        { merge: true }
      );

      await addAdminNotif(
        "Update paket di-approve",
        `${u.namaLengkap} berhasil update ke paket ${paketBaru}.`
      );

      alert("Update paket berhasil dikonfirmasi admin.");
    } catch (err) {
      alert(err.message);
    }
  };

  const approveBonus = async (u) => {
    try {
      const queue = Number(u.bonusQueue || 0);
      if (queue <= 0) {
        alert("Tidak ada bonus yang siap dibayar.");
        return;
      }

      const currentHistory = u.bonusHistory || [];
      const currentNotif = u.notifCustomer || [];
      const approvedTs = nowTs();

      const historyItem = {
        id: `bonus-${Date.now()}`,
        amount: 100000,
        approvedAt: approvedTs,
        status: "paid",
      };

      await setDoc(
        doc(db, "users", u.id),
        {
          bonusQueue: queue - 1,
          bonusHistory: [...currentHistory, historyItem],
          approvedAt: approvedTs,
          notifCustomer: [
            ...currentNotif,
            makeNotif(
              "Bonus sudah dibayar",
              "Bonus referral Rp100.000 sudah dibayar admin."
            ),
          ],
        },
        { merge: true }
      );

      await addAdminNotif(
        "Bonus referral dibayar",
        `Bonus referral Rp100.000 untuk ${u.namaLengkap} sudah dibayar.`
      );

      alert("Bonus berhasil dibayar.");
    } catch (err) {
      alert(err.message);
    }
  };

  const approveWithdraw = async (u) => {
    try {
      const req = u.withdrawRequest;
      if (!req || req.status !== "pending") return;

      const amount = Number(req.amount || 0);
      const komisiSaldo = Number(u.komisiSaldo || 0);

      if (amount <= 0 || amount > komisiSaldo) {
        alert("Nominal penarikan tidak valid.");
        return;
      }

      const currentHistory = u.withdrawalHistory || [];
      const currentNotif = u.notifCustomer || [];
      const approvedTs = nowTs();

      const historyItem = {
        id: req.id,
        amount,
        requestedAt: req.requestedAt,
        approvedAt: approvedTs,
        status: "approved",
      };

      await setDoc(
        doc(db, "users", u.id),
        {
          komisiSaldo: Math.max(0, komisiSaldo - amount),
          totalWithdrawn: Number(u.totalWithdrawn || 0) + amount,
          withdrawalHistory: [...currentHistory, historyItem],
          withdrawRequest: null,
          approvedAt: approvedTs,
          notifCustomer: [
            ...currentNotif,
            makeNotif(
              "Penarikan di-approve",
              `Penarikan ${formatRp(amount)} sudah di-approve admin.`
            ),
          ],
        },
        { merge: true }
      );

      await addAdminNotif(
        "Penarikan di-approve",
        `${u.namaLengkap} berhasil ditarik ${formatRp(amount)}.`
      );

      alert("Penarikan berhasil di-approve.");
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteUser = async (id) => {
    try {
      const ok = window.confirm("Yakin mau hapus user ini?");
      if (!ok) return;
      await deleteDoc(doc(db, "users", id));
      alert("User berhasil dihapus.");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= ADMIN DATA =================
  const registrationRows = useMemo(() => {
    return usersAdmin
      .filter((u) => !u.upgradeRequested && u.status === "pending")
      .sort(
        (a, b) =>
          (b.registrationCreatedAt || 0) - (a.registrationCreatedAt || 0)
      );
  }, [usersAdmin]);

  const updateRows = useMemo(() => {
    return usersAdmin
      .filter((u) => u.upgradeRequested && u.upgradeStatus === "pending")
      .sort((a, b) => (b.upgradeCreatedAt || 0) - (a.upgradeCreatedAt || 0));
  }, [usersAdmin]);

  const withdrawRows = useMemo(() => {
    return usersAdmin
      .filter((u) => u.withdrawRequest?.status === "pending")
      .sort(
        (a, b) =>
          (b.withdrawRequest?.requestedAt || 0) -
          (a.withdrawRequest?.requestedAt || 0)
      );
  }, [usersAdmin]);

  const bonusRows = useMemo(() => {
    return usersAdmin
      .filter((u) => Number(u.bonusQueue || 0) > 0)
      .sort((a, b) => (b.jumlahRekrut || 0) - (a.jumlahRekrut || 0));
  }, [usersAdmin]);

  const filteredCustomers = useMemo(() => {
    return usersAdmin
      .filter((u) => {
        const keyword = search.toLowerCase().trim();
        const matchSearch =
          !keyword ||
          (u.namaLengkap || "").toLowerCase().includes(keyword) ||
          (u.email || "").toLowerCase().includes(keyword) ||
          (u.referralCode || "").toLowerCase().includes(keyword);

        const matchPaket = filterPaket === "all" || u.paket === filterPaket;
        return matchSearch && matchPaket;
      })
      .sort(
        (a, b) =>
          (b.registrationCreatedAt || 0) - (a.registrationCreatedAt || 0)
      );
  }, [usersAdmin, search, filterPaket]);

  const totalNotif =
    registrationRows.length +
    updateRows.length +
    withdrawRows.length +
    bonusRows.length;

  const totalKomisiTerbentuk = useMemo(() => {
    return komisiRows.reduce((sum, row) => sum + Number(row.jumlah || 0), 0);
  }, [komisiRows]);

  const totalKomisiUser = Number(userData?.komisiSaldo || 0);
  const totalBonusReady = Number(userData?.bonusQueue || 0) * 100000;

  const todayKey = toDateKey(nowTs());

  const ordersToday = useMemo(() => {
    return usersAdmin.filter(
      (u) => toDateKey(u.registrationCreatedAt) === todayKey
    );
  }, [usersAdmin, todayKey]);

  const ordersByDate = useMemo(() => {
    if (!selectedDate) return usersAdmin;
    return usersAdmin.filter(
      (u) => toDateKey(u.registrationCreatedAt) === selectedDate
    );
  }, [usersAdmin, selectedDate]);

  const approvedToday = useMemo(() => {
    return usersAdmin.filter((u) => toDateKey(u.approvedAt) === todayKey);
  }, [usersAdmin, todayKey]);

  const approvedBySelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return usersAdmin.filter((u) => toDateKey(u.approvedAt) === selectedDate);
  }, [usersAdmin, selectedDate]);

  const chartData = useMemo(() => {
    const grouped = {};
    usersAdmin.forEach((u) => {
      const key = toDateKey(u.registrationCreatedAt);
      if (!key) return;
      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.keys(grouped)
      .sort((a, b) => new Date(b) - new Date(a))
      .slice(0, 10)
      .reverse()
      .map((date) => ({
        date,
        total: grouped[date],
      }));
  }, [usersAdmin]);

  const notifDaftarUpgrade = useMemo(() => {
    return adminFeed.filter((n) => {
      const t = String(n.title || "").toLowerCase();
      return t.includes("daftar") || t.includes("upgrade");
    });
  }, [adminFeed]);

  const notifBayarBonus = useMemo(() => {
    return adminFeed.filter((n) => {
      const t = String(n.title || "").toLowerCase();
      return (
        t.includes("pembayaran") ||
        t.includes("bonus") ||
        t.includes("komisi") ||
        t.includes("penarikan")
      );
    });
  }, [adminFeed]);

  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#020617",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        Loading...
      </div>
    );
  }

  // ================= STYLES =================
  const container = {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#0f172a,#020617)",
    color: "white",
    padding: 16,
    boxSizing: "border-box",
  };

  const card = {
    background: "rgba(30,41,59,0.95)",
    padding: 20,
    borderRadius: 20,
    width: "100%",
    maxWidth: 420,
    margin: "0 auto",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
    boxSizing: "border-box",
  };

  const panel = {
    background: "#1e293b",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
    boxSizing: "border-box",
  };

  const sectionTitle = {
    margin: "0 0 14px 0",
    fontSize: 20,
    fontWeight: 700,
  };

  const input = {
    width: "100%",
    padding: 14,
    marginBottom: 12,
    borderRadius: 12,
    border: "1px solid #1e293b",
    background: "#020617",
    color: "white",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
  };

  const select = {
    ...input,
    cursor: "pointer",
  };

  const btn = {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg,#22c55e,#16a34a)",
    color: "white",
    fontWeight: "bold",
    fontSize: 15,
    marginTop: 10,
    minHeight: 48,
    boxSizing: "border-box",
    cursor: "pointer",
  };

  const btnOrange = { ...btn, background: "#ea580c" };
  const btnBlue = { ...btn, background: "#2563eb" };
  const btnDark = { ...btn, background: "#334155" };
  const btnGold = { ...btn, background: "#d97706" };
  const btnPink = { ...btn, background: "#db2777" };

  const appBox = {
    background: "#020617",
    borderRadius: 14,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.05)",
    lineHeight: 1.7,
  };

  const adminToggle = {
    background: "white",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
    cursor: "pointer",
    fontWeight: 700,
  };

  const statMini = {
    background: "#0f172a",
    color: "white",
    borderRadius: 14,
    padding: 14,
    boxSizing: "border-box",
  };

  // ================= HOME =================
  if (page === "home") {
    return (
      <div style={container}>
        <div style={card}>
          <h2 style={{ marginTop: 0, marginBottom: 8, textAlign: "center" }}>
            PRISTORE
          </h2>
          <p
            style={{
              marginTop: 0,
              marginBottom: 16,
              opacity: 0.85,
              fontSize: 14,
              textAlign: "center",
            }}
          >
            Login atau daftar untuk masuk ke dashboard.
          </p>

          <button
            style={btnOrange}
            onClick={() => window.open(SAMPLE_VIDEO_LINK, "_blank")}
          >
            🎥 Sample Video
          </button>

          <button style={btn} onClick={() => setPage("login")}>
            Login
          </button>

          <button style={btnDark} onClick={() => setPage("register")}>
            Daftar
          </button>
        </div>
      </div>
    );
  }

  // ================= LOGIN =================
  if (page === "login") {
    return (
      <div style={container}>
        <div style={card}>
          <button
            style={{ ...btnDark, width: 120, marginTop: 0, marginBottom: 16 }}
            onClick={() => setPage("home")}
          >
            ← Kembali
          </button>

          <button
            style={{ ...btnOrange, marginTop: 0, marginBottom: 16 }}
            onClick={() => window.open(SAMPLE_VIDEO_LINK, "_blank")}
          >
            🎥 Sample Video
          </button>

          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Login</h2>

          <input
            style={input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={btn} onClick={login} disabled={loading}>
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <p
            style={{
              marginTop: 16,
              color: "#60a5fa",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={forgotPassword}
          >
            🔑 Reset Password
          </p>

          {resetInfo && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                background: resetInfo.includes("❌") ? "#450a0a" : "#052e16",
                color: resetInfo.includes("❌") ? "#f87171" : "#4ade80",
                border: `1px solid ${
                  resetInfo.includes("❌") ? "#dc2626" : "#16a34a"
                }`,
              }}
            >
              {resetInfo}
            </div>
          )}

          <p style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
            Reset password akan dikirim ke email kamu
          </p>

          <p style={{ marginTop: 10, fontSize: 14 }}>
            Belum punya akun?{" "}
            <span
              style={{ color: "#22c55e", fontWeight: 700, cursor: "pointer" }}
              onClick={() => setPage("register")}
            >
              Daftar
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ================= REGISTER =================
  if (page === "register") {
    return (
      <div style={container}>
        <div style={card}>
          <button
            style={{ ...btnDark, width: 120, marginTop: 0, marginBottom: 16 }}
            onClick={() => setPage("home")}
          >
            ← Kembali
          </button>

          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Daftar</h2>

          <input
            style={input}
            placeholder="Nama Lengkap"
            value={namaLengkap}
            onChange={(e) => setNamaLengkap(e.target.value)}
          />

          <select
            style={select}
            value={paket}
            onChange={(e) => setPaket(e.target.value)}
          >
            <option value="Standar">Standar - Rp100.000</option>
            <option value="Premium">Premium - Rp250.000</option>
            <option value="Gold">Gold - Rp500.000</option>
          </select>

          <input
            style={input}
            placeholder="Bank/nomor rekening"
            value={bankNomorRekening}
            onChange={(e) => setBankNomorRekening(e.target.value)}
          />

          <input
            style={input}
            placeholder="No HP"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
          />

          <input
            style={input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            style={input}
            value={refCode}
            disabled
            placeholder="Kode Referral"
          />

          <button style={btn} onClick={register} disabled={loading}>
            {loading ? "Memproses..." : "Daftar"}
          </button>

          <p style={{ marginTop: 10, fontSize: 14 }}>
            Sudah punya akun?{" "}
            <span
              style={{ color: "#22c55e", fontWeight: 700, cursor: "pointer" }}
              onClick={() => setPage("login")}
            >
              Login
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ================= ADMIN =================
  if (page === "admin") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#f8fafc,#e2e8f0)",
          padding: 16,
          color: "#111827",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 18,
              marginBottom: 18,
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 24 }}>Admin Dashboard</h1>
              <p style={{ margin: "6px 0 0 0", color: "#475569" }}>
                Kelola pendaftaran, update paket, komisi, bonus, penarikan, dan
                semua user.
              </p>
            </div>

            <button
              onClick={handleLogout}
              style={{
                background: "#0f172a",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <StatCard title="🔔 Notifikasi" value={totalNotif} />
            <StatCard title="🔴 Belum Dibaca" value={adminUnreadCount} />
            <StatCard title="👥 Total User" value={usersAdmin.length} />
            <StatCard
              title="💰 Total Komisi"
              value={formatRp(totalKomisiTerbentuk)}
            />
            <StatCard title="📦 Order Hari Ini" value={ordersToday.length} />
            <StatCard
              title="✅ Approve Hari Ini"
              value={approvedToday.length}
            />
            <StatCard
              title="📅 Approve Tanggal Dipilih"
              value={approvedBySelectedDate.length}
            />
          </div>

          <SectionCard title="📊 Ringkasan Order">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div style={statMini}>
                <p style={{ margin: 0, opacity: 0.8 }}>Tanggal Filter</p>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #334155",
                    background: "#020617",
                    color: "white",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={statMini}>
                <p style={{ margin: 0, opacity: 0.8 }}>
                  Order pada tanggal ini
                </p>
                <h2 style={{ margin: "8px 0 0 0" }}>{ordersByDate.length}</h2>
              </div>

              <div style={statMini}>
                <p style={{ margin: 0, opacity: 0.8 }}>
                  Approve pada tanggal ini
                </p>
                <h2 style={{ margin: "8px 0 0 0" }}>
                  {approvedBySelectedDate.length}
                </h2>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <h3 style={{ marginTop: 0 }}>📈 Grafik Order</h3>
              {chartData.length === 0 ? (
                <p>Belum ada data order.</p>
              ) : (
                chartData.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ width: 90, fontSize: 12 }}>{d.date}</div>
                    <div
                      style={{
                        flex: 1,
                        background: "#e2e8f0",
                        borderRadius: 999,
                        overflow: "hidden",
                        height: 10,
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(8, d.total * 12)}px`,
                          height: 10,
                          background: "#22c55e",
                        }}
                      />
                    </div>
                    <div style={{ minWidth: 24, fontWeight: 700 }}>
                      {d.total}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <h3 style={{ marginTop: 0 }}>📋 Riwayat Order</h3>
              {ordersByDate.length === 0 ? (
                <p>Tidak ada order pada tanggal ini.</p>
              ) : (
                ordersByDate.map((u) => (
                  <DataCard key={u.id}>
                    <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                      {u.namaLengkap}
                    </p>
                    <p style={{ margin: "4px 0" }}>Email: {u.email}</p>
                    <p style={{ margin: "4px 0" }}>Paket: {u.paket}</p>
                    <p style={{ margin: "4px 0" }}>
                      Tanggal Order: {formatDateTime(u.registrationCreatedAt)}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      Tanggal Approve: {formatDateTime(u.approvedAt)}
                    </p>
                    <p style={{ margin: "4px 0" }}>Status: {u.status}</p>
                  </DataCard>
                ))
              )}
            </div>
          </SectionCard>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div
                style={adminToggle}
                onClick={() =>
                  setOpenSection(openSection === "notif" ? null : "notif")
                }
              >
                🔔 Notifikasi Admin
                {adminUnreadCount > 0 ? ` (${adminUnreadCount})` : ""}
              </div>

              {openSection === "notif" && (
                <SectionCard title="🔔 Notifikasi Admin">
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 16,
                    }}
                  >
                    <button
                      style={{
                        background:
                          openNotifGroup === "daftar" ? "#0f172a" : "#cbd5e1",
                        color:
                          openNotifGroup === "daftar" ? "white" : "#0f172a",
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={() => setOpenNotifGroup("daftar")}
                    >
                      📥 Pendaftaran & Upgrade
                    </button>

                    <button
                      style={{
                        background:
                          openNotifGroup === "bayar" ? "#0f172a" : "#cbd5e1",
                        color: openNotifGroup === "bayar" ? "white" : "#0f172a",
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={() => setOpenNotifGroup("bayar")}
                    >
                      💰 Pembayaran, Bonus & Penarikan
                    </button>
                  </div>

                  {openNotifGroup === "daftar" && (
                    <>
                      {notifDaftarUpgrade.length === 0 ? (
                        <p>Tidak ada notifikasi.</p>
                      ) : (
                        notifDaftarUpgrade.slice(0, 30).map((n) => (
                          <DataCard key={n.id}>
                            <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                              {n.title}
                            </p>
                            <p style={{ margin: "0 0 8px 0" }}>{n.message}</p>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                fontWeight: 700,
                                color: n.read ? "#64748b" : "#dc2626",
                              }}
                            >
                              {n.read ? "✓ Sudah dibaca" : "🔴 Belum dibaca"}
                            </p>
                            {!n.read && (
                              <button
                                style={{
                                  marginTop: 10,
                                  border: "none",
                                  borderRadius: 10,
                                  padding: "8px 12px",
                                  background: "#16a34a",
                                  color: "white",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                onClick={() => markAdminNotifRead(n.id)}
                              >
                                Tandai Dibaca
                              </button>
                            )}
                          </DataCard>
                        ))
                      )}
                    </>
                  )}

                  {openNotifGroup === "bayar" && (
                    <>
                      {notifBayarBonus.length === 0 ? (
                        <p>Tidak ada notifikasi.</p>
                      ) : (
                        notifBayarBonus.slice(0, 30).map((n) => (
                          <DataCard key={n.id}>
                            <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                              {n.title}
                            </p>
                            <p style={{ margin: "0 0 8px 0" }}>{n.message}</p>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                fontWeight: 700,
                                color: n.read ? "#64748b" : "#16a34a",
                              }}
                            >
                              {n.read ? "✓ Sudah dibaca" : "🟢 Belum dibaca"}
                            </p>
                            {!n.read && (
                              <button
                                style={{
                                  marginTop: 10,
                                  border: "none",
                                  borderRadius: 10,
                                  padding: "8px 12px",
                                  background: "#16a34a",
                                  color: "white",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                onClick={() => markAdminNotifRead(n.id)}
                              >
                                Tandai Dibaca
                              </button>
                            )}
                          </DataCard>
                        ))
                      )}
                    </>
                  )}
                </SectionCard>
              )}
            </div>

            <div>
              <div
                style={adminToggle}
                onClick={() =>
                  setOpenSection(openSection === "daftar" ? null : "daftar")
                }
              >
                📥 Pendaftaran Baru
              </div>

              {openSection === "daftar" && (
                <SectionCard title="📥 Pendaftaran Baru">
                  {registrationRows.length === 0 ? (
                    <p>Tidak ada pendaftaran baru.</p>
                  ) : (
                    registrationRows.map((u) => {
                      const siapApprove = u.sudahBayar && u.paymentRequestSent;
                      return (
                        <DataCard key={u.id}>
                          <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                            {u.namaLengkap}
                          </p>
                          <p style={{ margin: "4px 0" }}>{u.email}</p>
                          <p style={{ margin: "4px 0" }}>Paket: {u.paket}</p>
                          <p style={{ margin: "4px 0" }}>
                            Tanggal Order:{" "}
                            {formatDateTime(u.registrationCreatedAt)}
                          </p>

                          {siapApprove ? (
                            <ActionButton
                              color="#16a34a"
                              onClick={() => approveRegistration(u)}
                            >
                              Approve
                            </ActionButton>
                          ) : (
                            <ActionButton color="#cbd5e1" textColor="#475569">
                              Menunggu customer
                            </ActionButton>
                          )}
                        </DataCard>
                      );
                    })
                  )}
                </SectionCard>
              )}
            </div>

            <div>
              <div
                style={adminToggle}
                onClick={() =>
                  setOpenSection(openSection === "update" ? null : "update")
                }
              >
                🔄 Update Paket
              </div>

              {openSection === "update" && (
                <SectionCard title="🔄 Update Paket">
                  {updateRows.length === 0 ? (
                    <p>Tidak ada permintaan update paket.</p>
                  ) : (
                    updateRows.map((u) => (
                      <DataCard key={u.id}>
                        <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                          {u.namaLengkap}
                        </p>
                        <p style={{ margin: "4px 0" }}>{u.email}</p>
                        <p style={{ margin: "4px 0" }}>
                          Update ke: {u.upgradePackage}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Tanggal Request: {formatDateTime(u.upgradeCreatedAt)}
                        </p>
                        <ActionButton
                          color="#2563eb"
                          onClick={() => approveUpgrade(u)}
                        >
                          Approve Update
                        </ActionButton>
                      </DataCard>
                    ))
                  )}
                </SectionCard>
              )}
            </div>

            <div>
              <div
                style={adminToggle}
                onClick={() =>
                  setOpenSection(openSection === "komisi" ? null : "komisi")
                }
              >
                💰 Tabel Komisi
              </div>

              {openSection === "komisi" && (
                <SectionCard title="💰 Tabel Komisi">
                  {komisiRows.length === 0 ? (
                    <p>Belum ada komisi.</p>
                  ) : (
                    komisiRows.map((row) => (
                      <DataCard key={row.id}>
                        <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                          {row.nama}
                        </p>
                        <p style={{ margin: "4px 0" }}>Dari: {row.dari}</p>
                        <p style={{ margin: "4px 0" }}>
                          Paket: {row.paketBeli}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Rekening: {row.bankNomorRekening || "-"}
                        </p>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(
                              row.bankNomorRekening || ""
                            )
                          }
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            background: "#2563eb",
                            color: "white",
                            border: "none",
                            marginBottom: 8,
                            cursor: "pointer",
                          }}
                        >
                          Copy Rekening
                        </button>
                        <p style={{ margin: "4px 0" }}>Sumber: {row.sumber}</p>
                        <p style={{ margin: "4px 0" }}>
                          Komisi: {formatRp(row.jumlah)}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Tanggal: {formatDateTime(row.createdAt)}
                        </p>
                      </DataCard>
                    ))
                  )}
                </SectionCard>
              )}
            </div>

            <div>
              <div
                style={adminToggle}
                onClick={() =>
                  setOpenSection(openSection === "bonus" ? null : "bonus")
                }
              >
                👥 Bonus Referral
              </div>

              {openSection === "bonus" && (
                <SectionCard title="👥 Bonus Referral">
                  {bonusRows.length === 0 ? (
                    <p>Tidak ada bonus yang siap dibayar.</p>
                  ) : (
                    bonusRows.map((u) => (
                      <DataCard key={u.id}>
                        <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                          {u.namaLengkap}
                        </p>

                        <p style={{ margin: "4px 0" }}>Email: {u.email}</p>

                        <p style={{ margin: "4px 0" }}>
                          Rekening: {u.bankNomorRekening || "-"}
                        </p>

                        <p style={{ margin: "4px 0" }}>
                          Total Referral: {u.jumlahRekrut || 0}
                        </p>

                        <p style={{ margin: "4px 0" }}>
                          Bonus siap dibayar:{" "}
                          {formatRp((u.bonusQueue || 0) * 100000)}
                        </p>

                        <button
                          style={{
                            marginTop: 6,
                            marginRight: 8,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "none",
                            background: "#2563eb",
                            color: "white",
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            navigator.clipboard.writeText(
                              u.bankNomorRekening || "-"
                            )
                          }
                        >
                          Copy Rekening
                        </button>

                        <ActionButton
                          color="#d97706"
                          onClick={() => approveBonus(u)}
                        >
                          Approve Bonus 100k
                        </ActionButton>
                      </DataCard>
                    ))
                  )}
                </SectionCard>
              )}
            </div>

            <div>
              <div
                style={adminToggle}
                onClick={() =>
                  setOpenSection(openSection === "withdraw" ? null : "withdraw")
                }
              >
                💸 Penarikan
              </div>

              {openSection === "withdraw" && (
                <SectionCard title="💸 Penarikan">
                  {withdrawRows.length === 0 ? (
                    <p>Tidak ada penarikan pending.</p>
                  ) : (
                    withdrawRows.map((u) => (
                      <DataCard key={u.id}>
                        <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                          {u.namaLengkap}
                        </p>

                        <p style={{ margin: "4px 0" }}>Email: {u.email}</p>

                        <p style={{ margin: "4px 0" }}>
                          Rekening: {u.bankNomorRekening || "-"}
                        </p>

                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(
                              u.bankNomorRekening || ""
                            )
                          }
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            background: "#2563eb",
                            color: "white",
                            border: "none",
                            marginBottom: 8,
                            cursor: "pointer",
                          }}
                        >
                          Copy Rekening
                        </button>

                        <p style={{ margin: "4px 0" }}>
                          Jumlah: {formatRp(u.withdrawRequest?.amount || 0)}
                        </p>

                        <ActionButton
                          color="#16a34a"
                          onClick={() => approveWithdraw(u)}
                        >
                          Approve Penarikan
                        </ActionButton>
                      </DataCard>
                    ))
                  )}
                </SectionCard>
              )}
            </div>

            <div>
              <div
                style={adminToggle}
                onClick={() =>
                  setOpenSection(openSection === "user" ? null : "user")
                }
              >
                👤 Semua User
              </div>

              {openSection === "user" && (
                <SectionCard title="👤 Semua User">
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 16,
                    }}
                  >
                    <input
                      style={{
                        minWidth: 220,
                        flex: 1,
                        padding: 12,
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                      }}
                      placeholder="Cari nama / email / referral..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />

                    <select
                      style={{
                        minWidth: 180,
                        padding: 12,
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                      }}
                      value={filterPaket}
                      onChange={(e) => setFilterPaket(e.target.value)}
                    >
                      <option value="all">Semua Paket</option>
                      <option value="Standar">Standar</option>
                      <option value="Premium">Premium</option>
                      <option value="Gold">Gold</option>
                    </select>
                  </div>

                  {filteredCustomers.length === 0 ? (
                    <p>Belum ada data user.</p>
                  ) : (
                    filteredCustomers.map((u) => (
                      <DataCard key={u.id}>
                        <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                          {u.namaLengkap}
                        </p>
                        <p style={{ margin: "4px 0" }}>Email: {u.email}</p>
                        <p style={{ margin: "4px 0" }}>No HP: {u.noHp}</p>
                        <p style={{ margin: "4px 0" }}>
                          Bank/Rekening: {u.bankNomorRekening || "-"}
                        </p>
                        <p style={{ margin: "4px 0" }}>Paket: {u.paket}</p>
                        <p style={{ margin: "4px 0" }}>Status: {u.status}</p>
                        <p style={{ margin: "4px 0" }}>
                          Referral Code: {u.referralCode}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Referred By: {safe(u.referredBy)}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Jumlah Rekrut: {u.jumlahRekrut || 0}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Komisi Saldo: {formatRp(u.komisiSaldo || 0)}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Progress Bonus: {u.bonusProgress || 0}/10
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Bonus Queue: {u.bonusQueue || 0}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Tanggal Order:{" "}
                          {formatDateTime(u.registrationCreatedAt)}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Approved At: {formatDateTime(u.approvedAt)}
                        </p>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 10,
                          }}
                        >
                          <ActionButton
                            color="#2563eb"
                            onClick={() => copyText(u.email, "Email disalin")}
                          >
                            Copy Email
                          </ActionButton>
                          <ActionButton
                            color="#475569"
                            onClick={() =>
                              copyText(u.noHp || "", "No HP disalin")
                            }
                          >
                            Copy No HP
                          </ActionButton>
                          <ActionButton
                            color="#0f172a"
                            onClick={() =>
                              copyText(
                                u.bankNomorRekening || "",
                                "Rekening disalin"
                              )
                            }
                          >
                            Copy Rekening
                          </ActionButton>
                          <ActionButton
                            color="#dc2626"
                            onClick={() => deleteUser(u.id)}
                          >
                            Hapus
                          </ActionButton>
                        </div>
                      </DataCard>
                    ))
                  )}
                </SectionCard>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= CUSTOMER DASHBOARD =================
  if (page === "dashboard" && userData) {
    const userApproved = userData.status === "approved";
    const canShowBayarDaftar = !userApproved;
    const hasPendingUpgrade =
      userData.upgradeRequested && userData.upgradeStatus === "pending";

    const referralLink = `${WEBSITE_URL}/?ref=${userData.referralCode}`;

    return (
      <div style={{ ...container, paddingTop: 0 }}>
        <div style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: "#020617",
              padding: "12px 0",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>
              👋 {userData.namaLengkap}
            </h3>
          </div>

          <div
            style={{
              background: "linear-gradient(90deg,#22c55e,#16a34a)",
              padding: 16,
              borderRadius: 16,
              marginBottom: 14,
              color: "white",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>
              Total Saldo Komisi
            </p>
            <h2 style={{ margin: "4px 0 0 0" }}>{formatRp(totalKomisiUser)}</h2>
          </div>

          <div
            style={{
              ...panel,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Customer Dashboard</h2>
              <p style={{ margin: "6px 0 0 0", opacity: 0.8 }}>
                Kelola akun, pembayaran, referral, komisi, bonus, dan penarikan.
              </p>
            </div>

            <button
              style={{ ...btnDark, width: 140, marginTop: 0 }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>

          <div style={panel}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <h3 style={{ ...sectionTitle, margin: 0 }}>
                Notifikasi Customer
                {customerUnreadCount > 0 ? ` (${customerUnreadCount})` : ""}
              </h3>

              {(userData.notifCustomer || []).length > 0 && (
                <button
                  style={{
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={markAllCustomerNotifRead}
                >
                  Tandai Semua Dibaca
                </button>
              )}
            </div>

            <div style={appBox}>
              {!userData.notifCustomer ||
              userData.notifCustomer.length === 0 ? (
                <p style={{ margin: 0 }}>Belum ada notifikasi.</p>
              ) : (
                [...userData.notifCustomer]
                  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                  .slice(0, 10)
                  .map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid #1e293b",
                      }}
                    >
                      <p style={{ margin: "4px 0", fontWeight: 700 }}>
                        {n.read ? "✓ " : "🔴 "}
                        {n.title}
                      </p>
                      <p style={{ margin: "4px 0" }}>{n.message}</p>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div style={panel}>
            <h3 style={sectionTitle}>Profil Customer</h3>
            <div style={appBox}>
              <p style={{ margin: "6px 0" }}>
                <strong>Nama:</strong> {userData.namaLengkap}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Email:</strong> {userData.email}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>No HP:</strong> {userData.noHp}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Bank/nomor rekening:</strong>{" "}
                {userData.bankNomorRekening}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Paket:</strong> {userData.paket}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Status:</strong> {userData.status}
              </p>
            </div>
          </div>

          <div style={panel}>
            <h3 style={sectionTitle}>Referral Saya</h3>
            <div style={appBox}>
              <p style={{ margin: "6px 0" }}>
                <strong>Kode Referral:</strong> {userData.referralCode}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Total Referral:</strong> {userData.jumlahRekrut || 0}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Progress Bonus:</strong> {userData.bonusProgress || 0}
                /10
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Bonus Siap Dibayar:</strong> {formatRp(totalBonusReady)}
              </p>
              <p style={{ margin: "6px 0", wordBreak: "break-all" }}>
                <strong>Link Referral:</strong>
                <br />
                {referralLink}
              </p>

              <button
                style={btnBlue}
                onClick={() => copyText(referralLink, "Link referral disalin.")}
              >
                Copy Link
              </button>
            </div>
          </div>

          <div style={panel}>
            <h3 style={sectionTitle}>Keuangan</h3>
            <div style={appBox}>
              <p style={{ margin: "6px 0" }}>
                <strong>Komisi Paket (Bisa Ditarik):</strong>{" "}
                {formatRp(userData.komisiSaldo || 0)}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Bonus Referral:</strong> {formatRp(totalBonusReady)}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Total Sudah Ditarik:</strong>{" "}
                {formatRp(userData.totalWithdrawn || 0)}
              </p>
            </div>

            <input
              style={input}
              placeholder="Jumlah yang akan ditarik"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />

            <button style={btnGold} onClick={submitWithdraw}>
              Tarik Saldo
            </button>

            {userData.withdrawRequest?.status === "pending" && (
              <p style={{ marginTop: 12, color: "#facc15", fontWeight: 700 }}>
                Permintaan penarikan {formatRp(userData.withdrawRequest.amount)}{" "}
                sedang menunggu admin.
              </p>
            )}
          </div>

          <div style={panel}>
            <h3 style={sectionTitle}>Pembayaran Pendaftaran</h3>
            <div style={appBox}>
              <p style={{ margin: "0 0 8px 0", fontWeight: 700 }}>
                Metode Pembayaran
              </p>
              <p style={{ margin: "4px 0" }}>OVO 085889827352</p>
              <p style={{ margin: "4px 0" }}>SEABANK 901503319741</p>
              <p style={{ margin: "4px 0" }}>BANK JAGO 105830435142</p>
              <p style={{ margin: "4px 0" }}>NEOBANK 5859459237817910</p>
              <p style={{ margin: "4px 0" }}>A/n ( MAMDUHAM )</p>
              <hr style={{ borderColor: "#1e293b", margin: "12px 0" }} />
              <p style={{ margin: "6px 0" }}>
                <strong>Paket:</strong> {userData.paket}
              </p>
              <p style={{ margin: "6px 0" }}>
                <strong>Harga:</strong> {getHargaPaketLabel(userData.paket)}
              </p>

              <p
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "#ef4444",
                  fontWeight: "bold",
                }}
              >
                Jika sudah setuju dan melakukan pembayaran, uang tidak dapat
                dikembalikan.
              </p>

              {userApproved && (
                <p style={{ color: "#4ade80", fontWeight: 700 }}>
                  Pembayaran pendaftaran sudah dikonfirmasi admin.
                </p>
              )}

              {canShowBayarDaftar && (
                <button style={btnGold} onClick={handleSudahBayarDaftar}>
                  SUDAH TRANSFER KONFIRMASI DI SINI
                </button>
              )}

              {!userApproved && userData.paymentRequestSent && (
                <p style={{ marginTop: 12, color: "#facc15", fontWeight: 700 }}>
                  Menunggu konfirmasi admin.
                </p>
              )}
            </div>
          </div>

          <div style={panel}>
            <h3 style={sectionTitle}>Upgrade Paket</h3>

            {!userApproved ? (
              <div style={appBox}>
                <p style={{ margin: 0 }}>
                  Akun harus di approve dulu oleh admin.
                </p>
              </div>
            ) : (
              <div style={appBox}>
                {!hasPendingUpgrade ? (
                  <>
                    {!showUpgradeOptions ? (
                      <button
                        style={btnPink}
                        onClick={() => setShowUpgradeOptions(true)}
                      >
                        Update
                      </button>
                    ) : (
                      <>
                        <button
                          style={btnBlue}
                          onClick={() => chooseUpgradePackage("Premium")}
                        >
                          Paket Premium 250.000
                        </button>

                        <button
                          style={btnGold}
                          onClick={() => chooseUpgradePackage("Gold")}
                        >
                          Paket Gold 500.000
                        </button>

                        <button
                          style={btnDark}
                          onClick={() => setShowUpgradeOptions(false)}
                        >
                          Batal
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ margin: "6px 0" }}>
                      <strong>
                        Request upgrade kamu sedang diproses admin.
                      </strong>
                    </p>
                    <p style={{ margin: "6px 0" }}>
                      Paket dipilih: <strong>{userData.upgradePackage}</strong>
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={panel}>
            <h3 style={sectionTitle}>Riwayat</h3>

            <button
              style={btnDark}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Tutup Riwayat" : "Buka Riwayat"}
            </button>

            {showHistory && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...appBox, marginBottom: 12 }}>
                  <p style={{ margin: "0 0 8px 0", fontWeight: 700 }}>
                    Riwayat Penarikan
                  </p>

                  {!userData.withdrawalHistory ||
                  userData.withdrawalHistory.length === 0 ? (
                    <p style={{ margin: 0 }}>Belum ada riwayat penarikan.</p>
                  ) : (
                    [...userData.withdrawalHistory]
                      .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0))
                      .map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: "10px 0",
                            borderBottom: "1px solid #1e293b",
                          }}
                        >
                          <p style={{ margin: "4px 0" }}>
                            <strong>Jumlah:</strong> {formatRp(item.amount)}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            <strong>Status:</strong> {item.status}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            <strong>Tanggal:</strong>{" "}
                            {formatDateTime(item.approvedAt)}
                          </p>
                        </div>
                      ))
                  )}
                </div>

                <div style={appBox}>
                  <p style={{ margin: "0 0 8px 0", fontWeight: 700 }}>
                    History Bonus
                  </p>

                  {!userData.bonusHistory ||
                  userData.bonusHistory.length === 0 ? (
                    <p style={{ margin: 0 }}>Belum ada history bonus.</p>
                  ) : (
                    [...userData.bonusHistory]
                      .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0))
                      .map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: "10px 0",
                            borderBottom: "1px solid #1e293b",
                          }}
                        >
                          <p style={{ margin: "4px 0" }}>
                            <strong>Jumlah:</strong> {formatRp(item.amount)}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            <strong>Status:</strong> {item.status}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            <strong>Tanggal:</strong>{" "}
                            {formatDateTime(item.approvedAt)}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={panel}>
            <h3 style={sectionTitle}>Notifikasi Customer</h3>
            <div style={appBox}>
              {!userData.notifCustomer ||
              userData.notifCustomer.length === 0 ? (
                <p style={{ margin: 0 }}>Belum ada notifikasi.</p>
              ) : (
                [...userData.notifCustomer]
                  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                  .slice(0, 10)
                  .map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid #1e293b",
                      }}
                    >
                      <p style={{ margin: "4px 0", fontWeight: 700 }}>
                        {n.read ? "✓ " : "🔴 "}
                        {n.title}
                      </p>
                      <p style={{ margin: "4px 0" }}>{n.message}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        <a
          href={`${WA_ADMIN}?text=${encodeURIComponent(
            `Halo Admin Pristore 🙏

Saya ${userData.namaLengkap}

📧 Email: ${userData.email}
📦 Paket: ${userData.paket}
📊 Status: ${userData.status}

Mohon dibantu ya kak 🙏`
          )}`}
          target="_blank"
          rel="noreferrer"
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "#22c55e",
            color: "white",
            width: 56,
            height: 56,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
            fontSize: 22,
            zIndex: 999,
          }}
        >
          💬
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      Loading...
    </div>
  );
}

// ================= SMALL COMPONENTS =================
function StatCard({ title, value }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        padding: 16,
        boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{value}</p>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        padding: 16,
        marginBottom: 18,
        boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

function DataCard({ children }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function ActionButton({ children, onClick, color, textColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: color || "#475569",
        color: textColor || "white",
        border: "none",
        borderRadius: 10,
        padding: "10px 14px",
        fontWeight: 700,
        cursor: onClick ? "pointer" : "not-allowed",
      }}
    >
      {children}
    </button>
  );
}
