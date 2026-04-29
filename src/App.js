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
  const [showProfile, setShowProfile] = useState(false);
  const [resetInfo, setResetInfo] = useState("");

  // ================= ADMIN STATE =================
  const [usersAdmin, setUsersAdmin] = useState([]);
  const [adminFeed, setAdminFeed] = useState([]);
  const [selectedAdminNotifIds, setSelectedAdminNotifIds] = useState([]);
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
  // ===== NOTIF PRO =====
  const deleteAdminNotif = async (id) => {
    const ok = window.confirm("Yakin mau hapus?");
    if (!ok) return;
    await deleteDoc(doc(db, "admin_notifications", id));
  };

  const deleteAllAdminNotif = async () => {
    const ok = window.confirm("Hapus semua notif?");
    if (!ok) return;

    for (const n of adminFeed) {
      await deleteDoc(doc(db, "admin_notifications", n.id));
    }
  };

  const toggleSelectNotif = (id) => {
    setSelectedAdminNotifIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const deleteSelectedNotif = async () => {
    if (!selectedAdminNotifIds.length) {
      alert("Pilih notif dulu");
      return;
    }

    const ok = window.confirm("Hapus notif dipilih?");
    if (!ok) return;

    for (const id of selectedAdminNotifIds) {
      await deleteDoc(doc(db, "admin_notifications", id));
    }

    setSelectedAdminNotifIds([]);
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
    const lightInput = {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #cbd5e1",
      background: "white",
      color: "#0f172a",
      fontSize: 13,
      boxSizing: "border-box",
      outline: "none",
    };

    const ghostBtn = {
      background: "white",
      color: "#0f172a",
      border: "1px solid #cbd5e1",
      borderRadius: 10,
      padding: "8px 12px",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
    };

    const dangerGhostBtn = {
      ...ghostBtn,
      color: "#b91c1c",
      borderColor: "#fecaca",
      background: "#fef2f2",
    };

    const tabBtn = (active) => ({
      background: active ? "#0f172a" : "white",
      color: active ? "white" : "#0f172a",
      border: "1px solid",
      borderColor: active ? "#0f172a" : "#cbd5e1",
      borderRadius: 999,
      padding: "8px 14px",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
    });

    const dataHeader = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    };

    const dataName = {
      margin: 0,
      fontWeight: 700,
      fontSize: 14,
      color: "#0f172a",
    };

    const renderNotifCard = (n, accentColor) => (
      <DataCard key={n.id}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input
            type="checkbox"
            checked={selectedAdminNotifIds.includes(n.id)}
            onChange={() => toggleSelectNotif(n.id)}
            style={{ marginTop: 4 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={dataHeader}>
              <p style={dataName}>{n.title}</p>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: n.read ? "#e2e8f0" : "#fee2e2",
                  color: n.read ? "#475569" : accentColor,
                }}
              >
                {n.read ? "Sudah dibaca" : "Belum dibaca"}
              </span>
            </div>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: 13,
                color: "#475569",
              }}
            >
              {n.message}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!n.read && (
                <ActionButton
                  color="#16a34a"
                  onClick={() => markAdminNotifRead(n.id)}
                >
                  Tandai Dibaca
                </ActionButton>
              )}
              <ActionButton
                color="#dc2626"
                onClick={() => deleteAdminNotif(n.id)}
              >
                Hapus
              </ActionButton>
            </div>
          </div>
        </div>
      </DataCard>
    );

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f1f5f9",
          padding: 16,
          color: "#0f172a",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 18,
              marginBottom: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "linear-gradient(135deg,#0f172a,#334155)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                A
              </div>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Admin Dashboard
                </h1>
                <p
                  style={{
                    margin: "2px 0 0 0",
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  Kelola pendaftaran, paket, komisi, bonus, penarikan & user.
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                background: "white",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "9px 14px",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Keluar
            </button>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <StatCard title="Notifikasi" value={totalNotif} />
            <StatCard
              title="Belum Dibaca"
              value={adminUnreadCount}
              accent="#dc2626"
            />
            <StatCard title="Total User" value={usersAdmin.length} />
            <StatCard
              title="Total Komisi"
              value={formatRp(totalKomisiTerbentuk)}
              accent="#16a34a"
            />
            <StatCard title="Order Hari Ini" value={ordersToday.length} />
            <StatCard
              title="Approve Hari Ini"
              value={approvedToday.length}
              accent="#16a34a"
            />
            <StatCard
              title="Approve Tgl Dipilih"
              value={approvedBySelectedDate.length}
            />
          </div>

          {/* Ringkasan Order */}
          <SectionCard
            title="Ringkasan Order"
            right={
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ ...lightInput, width: "auto", padding: "8px 12px" }}
              />
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  Order Tanggal Ini
                </p>
                <p
                  style={{
                    margin: "6px 0 0 0",
                    fontSize: 22,
                    fontWeight: 800,
                  }}
                >
                  {ordersByDate.length}
                </p>
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  Approve Tanggal Ini
                </p>
                <p
                  style={{
                    margin: "6px 0 0 0",
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#16a34a",
                  }}
                >
                  {approvedBySelectedDate.length}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <h3
                style={{
                  margin: "0 0 10px 0",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                Grafik Order
              </h3>
              {chartData.length === 0 ? (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                  Belum ada data order.
                </p>
              ) : (
                chartData.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 90,
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      {d.date}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: "#e2e8f0",
                        borderRadius: 999,
                        overflow: "hidden",
                        height: 8,
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(8, d.total * 12)}px`,
                          height: 8,
                          background:
                            "linear-gradient(90deg,#22c55e,#16a34a)",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        minWidth: 24,
                        fontWeight: 700,
                        fontSize: 13,
                        textAlign: "right",
                      }}
                    >
                      {d.total}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 10px 0",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                Riwayat Order
              </h3>
              {ordersByDate.length === 0 ? (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                  Tidak ada order pada tanggal ini.
                </p>
              ) : (
                ordersByDate.map((u) => (
                  <DataCard key={u.id}>
                    <div style={dataHeader}>
                      <p style={dataName}>{u.namaLengkap}</p>
                      <StatusBadge status={u.status} />
                    </div>
                    <InfoRow label="Email" value={u.email} />
                    <InfoRow label="Paket" value={u.paket} />
                    <InfoRow
                      label="Tgl Order"
                      value={formatDateTime(u.registrationCreatedAt)}
                    />
                    <InfoRow
                      label="Tgl Approve"
                      value={formatDateTime(u.approvedAt)}
                    />
                  </DataCard>
                ))
              )}
            </div>
          </SectionCard>

          {/* Collapsible sections */}
          <div style={{ display: "grid", gap: 10 }}>
            {/* Notifikasi Admin */}
            <div>
              <AdminToggle
                label="Notifikasi Admin"
                badge={adminUnreadCount}
                isOpen={openSection === "notif"}
                onClick={() =>
                  setOpenSection(openSection === "notif" ? null : "notif")
                }
              />
              {openSection === "notif" && (
                <div style={{ marginTop: 10 }}>
                  <SectionCard title="Notifikasi Admin">
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 14,
                      }}
                    >
                      <button
                        style={ghostBtn}
                        onClick={() =>
                          setSelectedAdminNotifIds(
                            adminFeed.map((n) => n.id)
                          )
                        }
                      >
                        Pilih Semua
                      </button>
                      <button
                        style={dangerGhostBtn}
                        onClick={deleteSelectedNotif}
                      >
                        Hapus Dipilih
                      </button>
                      <button
                        style={dangerGhostBtn}
                        onClick={deleteAllAdminNotif}
                      >
                        Hapus Semua
                      </button>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 14,
                      }}
                    >
                      <button
                        style={tabBtn(openNotifGroup === "daftar")}
                        onClick={() => setOpenNotifGroup("daftar")}
                      >
                        Pendaftaran & Upgrade
                      </button>
                      <button
                        style={tabBtn(openNotifGroup === "bayar")}
                        onClick={() => setOpenNotifGroup("bayar")}
                      >
                        Pembayaran, Bonus & Penarikan
                      </button>
                    </div>

                    {openNotifGroup === "daftar" &&
                      (notifDaftarUpgrade.length === 0 ? (
                        <p
                          style={{
                            margin: 0,
                            color: "#94a3b8",
                            fontSize: 13,
                          }}
                        >
                          Tidak ada notifikasi.
                        </p>
                      ) : (
                        notifDaftarUpgrade
                          .slice(0, 30)
                          .map((n) => renderNotifCard(n, "#dc2626"))
                      ))}

                    {openNotifGroup === "bayar" &&
                      (notifBayarBonus.length === 0 ? (
                        <p
                          style={{
                            margin: 0,
                            color: "#94a3b8",
                            fontSize: 13,
                          }}
                        >
                          Tidak ada notifikasi.
                        </p>
                      ) : (
                        notifBayarBonus
                          .slice(0, 30)
                          .map((n) => renderNotifCard(n, "#16a34a"))
                      ))}
                  </SectionCard>
                </div>
              )}
            </div>

            {/* Pendaftaran Baru */}
            <div>
              <AdminToggle
                label="Pendaftaran Baru"
                badge={registrationRows.length}
                isOpen={openSection === "daftar"}
                onClick={() =>
                  setOpenSection(openSection === "daftar" ? null : "daftar")
                }
              />
              {openSection === "daftar" && (
                <div style={{ marginTop: 10 }}>
                  <SectionCard title="Pendaftaran Baru">
                    {registrationRows.length === 0 ? (
                      <p
                        style={{
                          margin: 0,
                          color: "#94a3b8",
                          fontSize: 13,
                        }}
                      >
                        Tidak ada pendaftaran baru.
                      </p>
                    ) : (
                      registrationRows.map((u) => {
                        const siapApprove =
                          u.sudahBayar && u.paymentRequestSent;
                        return (
                          <DataCard key={u.id}>
                            <div style={dataHeader}>
                              <p style={dataName}>{u.namaLengkap}</p>
                              <StatusBadge
                                status={siapApprove ? "pending" : "pending"}
                              />
                            </div>
                            <InfoRow label="Email" value={u.email} />
                            <InfoRow label="Paket" value={u.paket} />
                            <InfoRow
                              label="Tgl Order"
                              value={formatDateTime(u.registrationCreatedAt)}
                            />
                            <div style={{ marginTop: 10 }}>
                              {siapApprove ? (
                                <ActionButton
                                  color="#16a34a"
                                  onClick={() => approveRegistration(u)}
                                >
                                  Approve
                                </ActionButton>
                              ) : (
                                <ActionButton
                                  color="#e2e8f0"
                                  textColor="#475569"
                                >
                                  Menunggu customer
                                </ActionButton>
                              )}
                            </div>
                          </DataCard>
                        );
                      })
                    )}
                  </SectionCard>
                </div>
              )}
            </div>

            {/* Update Paket */}
            <div>
              <AdminToggle
                label="Update Paket"
                badge={updateRows.length}
                isOpen={openSection === "update"}
                onClick={() =>
                  setOpenSection(openSection === "update" ? null : "update")
                }
              />
              {openSection === "update" && (
                <div style={{ marginTop: 10 }}>
                  <SectionCard title="Update Paket">
                    {updateRows.length === 0 ? (
                      <p
                        style={{
                          margin: 0,
                          color: "#94a3b8",
                          fontSize: 13,
                        }}
                      >
                        Tidak ada permintaan update paket.
                      </p>
                    ) : (
                      updateRows.map((u) => (
                        <DataCard key={u.id}>
                          <div style={dataHeader}>
                            <p style={dataName}>{u.namaLengkap}</p>
                          </div>
                          <InfoRow label="Email" value={u.email} />
                          <InfoRow
                            label="Update ke"
                            value={u.upgradePackage}
                            accent="#2563eb"
                          />
                          <InfoRow
                            label="Tgl Request"
                            value={formatDateTime(u.upgradeCreatedAt)}
                          />
                          <div style={{ marginTop: 10 }}>
                            <ActionButton
                              color="#2563eb"
                              onClick={() => approveUpgrade(u)}
                            >
                              Approve Update
                            </ActionButton>
                          </div>
                        </DataCard>
                      ))
                    )}
                  </SectionCard>
                </div>
              )}
            </div>

            {/* Tabel Komisi */}
            <div>
              <AdminToggle
                label="Tabel Komisi"
                badge={komisiRows.length}
                isOpen={openSection === "komisi"}
                onClick={() =>
                  setOpenSection(openSection === "komisi" ? null : "komisi")
                }
              />
              {openSection === "komisi" && (
                <div style={{ marginTop: 10 }}>
                  <SectionCard title="Tabel Komisi">
                    {komisiRows.length === 0 ? (
                      <p
                        style={{
                          margin: 0,
                          color: "#94a3b8",
                          fontSize: 13,
                        }}
                      >
                        Belum ada komisi.
                      </p>
                    ) : (
                      komisiRows.map((row) => (
                        <DataCard key={row.id}>
                          <div style={dataHeader}>
                            <p style={dataName}>{row.nama}</p>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#16a34a",
                              }}
                            >
                              {formatRp(row.jumlah)}
                            </span>
                          </div>
                          <InfoRow label="Dari" value={row.dari} />
                          <InfoRow label="Paket" value={row.paketBeli} />
                          <InfoRow
                            label="Rekening"
                            value={row.bankNomorRekening || "-"}
                          />
                          <InfoRow label="Sumber" value={row.sumber} />
                          <InfoRow
                            label="Tanggal"
                            value={formatDateTime(row.createdAt)}
                          />
                          <div style={{ marginTop: 10 }}>
                            <ActionButton
                              color="#2563eb"
                              onClick={() =>
                                copyText(
                                  row.bankNomorRekening || "",
                                  "Rekening disalin"
                                )
                              }
                            >
                              Copy Rekening
                            </ActionButton>
                          </div>
                        </DataCard>
                      ))
                    )}
                  </SectionCard>
                </div>
              )}
            </div>

            {/* Bonus Referral */}
            <div>
              <AdminToggle
                label="Bonus Referral"
                badge={bonusRows.length}
                isOpen={openSection === "bonus"}
                onClick={() =>
                  setOpenSection(openSection === "bonus" ? null : "bonus")
                }
              />
              {openSection === "bonus" && (
                <div style={{ marginTop: 10 }}>
                  <SectionCard title="Bonus Referral">
                    {bonusRows.length === 0 ? (
                      <p
                        style={{
                          margin: 0,
                          color: "#94a3b8",
                          fontSize: 13,
                        }}
                      >
                        Tidak ada bonus yang siap dibayar.
                      </p>
                    ) : (
                      bonusRows.map((u) => (
                        <DataCard key={u.id}>
                          <div style={dataHeader}>
                            <p style={dataName}>{u.namaLengkap}</p>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#d97706",
                              }}
                            >
                              {formatRp((u.bonusQueue || 0) * 100000)}
                            </span>
                          </div>
                          <InfoRow label="Email" value={u.email} />
                          <InfoRow
                            label="Rekening"
                            value={u.bankNomorRekening || "-"}
                          />
                          <InfoRow
                            label="Total Referral"
                            value={`${u.jumlahRekrut || 0} orang`}
                          />
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
                              color="#d97706"
                              onClick={() => approveBonus(u)}
                            >
                              Approve Bonus 100k
                            </ActionButton>
                          </div>
                        </DataCard>
                      ))
                    )}
                  </SectionCard>
                </div>
              )}
            </div>

            {/* Penarikan */}
            <div>
              <AdminToggle
                label="Penarikan"
                badge={withdrawRows.length}
                isOpen={openSection === "withdraw"}
                onClick={() =>
                  setOpenSection(
                    openSection === "withdraw" ? null : "withdraw"
                  )
                }
              />
              {openSection === "withdraw" && (
                <div style={{ marginTop: 10 }}>
                  <SectionCard title="Penarikan">
                    {withdrawRows.length === 0 ? (
                      <p
                        style={{
                          margin: 0,
                          color: "#94a3b8",
                          fontSize: 13,
                        }}
                      >
                        Tidak ada penarikan pending.
                      </p>
                    ) : (
                      withdrawRows.map((u) => (
                        <DataCard key={u.id}>
                          <div style={dataHeader}>
                            <p style={dataName}>{u.namaLengkap}</p>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              {formatRp(u.withdrawRequest?.amount || 0)}
                            </span>
                          </div>
                          <InfoRow label="Email" value={u.email} />
                          <InfoRow
                            label="Rekening"
                            value={u.bankNomorRekening || "-"}
                          />
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
                              color="#16a34a"
                              onClick={() => approveWithdraw(u)}
                            >
                              Approve Penarikan
                            </ActionButton>
                          </div>
                        </DataCard>
                      ))
                    )}
                  </SectionCard>
                </div>
              )}
            </div>

            {/* Semua User */}
            <div>
              <AdminToggle
                label="Semua User"
                badge={usersAdmin.length}
                isOpen={openSection === "user"}
                onClick={() =>
                  setOpenSection(openSection === "user" ? null : "user")
                }
              />
              {openSection === "user" && (
                <div style={{ marginTop: 10 }}>
                  <SectionCard title="Semua User">
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 14,
                      }}
                    >
                      <input
                        style={{ ...lightInput, flex: 1, minWidth: 220 }}
                        placeholder="Cari nama / email / referral..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <select
                        style={{ ...lightInput, width: "auto", minWidth: 160 }}
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
                      <p
                        style={{
                          margin: 0,
                          color: "#94a3b8",
                          fontSize: 13,
                        }}
                      >
                        Belum ada data user.
                      </p>
                    ) : (
                      filteredCustomers.map((u) => (
                        <DataCard key={u.id}>
                          <div style={dataHeader}>
                            <p style={dataName}>{u.namaLengkap}</p>
                            <StatusBadge status={u.status} />
                          </div>
                          <InfoRow label="Email" value={u.email} />
                          <InfoRow label="No HP" value={u.noHp} />
                          <InfoRow
                            label="Bank/Rekening"
                            value={u.bankNomorRekening || "-"}
                          />
                          <InfoRow label="Paket" value={u.paket} />
                          <InfoRow
                            label="Referral Code"
                            value={u.referralCode}
                          />
                          <InfoRow
                            label="Referred By"
                            value={safe(u.referredBy)}
                          />
                          <InfoRow
                            label="Jumlah Rekrut"
                            value={u.jumlahRekrut || 0}
                          />
                          <InfoRow
                            label="Komisi Saldo"
                            value={formatRp(u.komisiSaldo || 0)}
                            accent="#16a34a"
                          />
                          <InfoRow
                            label="Progress Bonus"
                            value={`${u.bonusProgress || 0}/10`}
                          />
                          <InfoRow
                            label="Bonus Queue"
                            value={u.bonusQueue || 0}
                          />
                          <InfoRow
                            label="Tgl Order"
                            value={formatDateTime(u.registrationCreatedAt)}
                          />
                          <InfoRow
                            label="Approved At"
                            value={formatDateTime(u.approvedAt)}
                          />

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              marginTop: 12,
                              paddingTop: 12,
                              borderTop: "1px solid #e2e8f0",
                            }}
                          >
                            <ActionButton
                              color="#2563eb"
                              onClick={() =>
                                copyText(u.email, "Email disalin")
                              }
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
                </div>
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

    const statusMap = {
      approved: { bg: "rgba(34,197,94,0.15)", color: "#4ade80", label: "Aktif" },
      pending: { bg: "rgba(250,204,21,0.15)", color: "#facc15", label: "Menunggu" },
      rejected: { bg: "rgba(239,68,68,0.15)", color: "#f87171", label: "Ditolak" },
    };
    const sb =
      statusMap[userData.status] || {
        bg: "rgba(148,163,184,0.15)",
        color: "#cbd5e1",
        label: userData.status || "-",
      };

    const surface = {
      background: "#0f172a",
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      border: "1px solid rgba(148,163,184,0.08)",
      boxSizing: "border-box",
    };
    const subtle = {
      background: "rgba(2,6,23,0.6)",
      borderRadius: 12,
      padding: 12,
      border: "1px solid rgba(148,163,184,0.06)",
    };
    const sectionLabel = {
      margin: "0 0 12px 0",
      fontSize: 12,
      fontWeight: 700,
      color: "#94a3b8",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    };
    const labelText = { color: "#94a3b8", fontSize: 13 };
    const valueText = {
      color: "#e2e8f0",
      fontWeight: 600,
      textAlign: "right",
      wordBreak: "break-word",
      fontSize: 13,
    };
    const rowBase = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "10px 0",
      borderBottom: "1px solid rgba(148,163,184,0.08)",
    };
    const rowLast = { ...rowBase, borderBottom: "none" };
    const statTile = {
      background: "rgba(2,6,23,0.6)",
      borderRadius: 12,
      padding: 12,
      border: "1px solid rgba(148,163,184,0.06)",
    };
    const linkAction = {
      background: "transparent",
      border: "none",
      color: "#60a5fa",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      padding: 0,
    };
    const pendingBox = {
      marginTop: 12,
      padding: 10,
      background: "rgba(250,204,21,0.1)",
      border: "1px solid rgba(250,204,21,0.3)",
      borderRadius: 10,
      color: "#facc15",
      fontSize: 13,
      fontWeight: 600,
    };

    const progressPct = Math.min(
      100,
      Math.round(((userData.bonusProgress || 0) / 10) * 100)
    );

    const renderHistoryItem = (item, idx, arr) => (
      <div
        key={item.id}
        style={{
          padding: "10px 0",
          borderBottom:
            idx === arr.length - 1
              ? "none"
              : "1px solid rgba(148,163,184,0.08)",
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>{formatRp(item.amount)}</span>
          <span
            style={{
              color: item.status === "approved" ? "#4ade80" : "#facc15",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {item.status}
          </span>
        </div>
        <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: 12 }}>
          {formatDateTime(item.approvedAt)}
        </p>
      </div>
    );

    return (
      <div style={{ ...container, paddingTop: 0, paddingBottom: 100 }}>
        <div style={{ width: "100%", maxWidth: 480, margin: "0 auto" }}>
          {/* Top bar */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: "#020617",
              padding: "14px 0",
              marginBottom: 16,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#22c55e,#0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {(userData.namaLengkap || "U").trim().charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
                Selamat datang
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                >
                  {userData.namaLengkap}
                </p>
                <button
                  onClick={() => setShowProfile(true)}
                  style={{
                    background: "rgba(34,197,94,0.15)",
                    border: "1px solid rgba(34,197,94,0.4)",
                    color: "#4ade80",
                    padding: "3px 10px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  Profil
                </button>
              </div>
            </div>
            <span
              style={{
                background: sb.bg,
                color: sb.color,
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              {sb.label}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: "transparent",
                border: "1px solid rgba(148,163,184,0.2)",
                color: "#cbd5e1",
                padding: "8px 12px",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              Keluar
            </button>
          </div>

          {/* Balance hero */}
          <div
            style={{
              background: "linear-gradient(135deg,#16a34a,#0d9488)",
              padding: 18,
              borderRadius: 18,
              marginBottom: 14,
              color: "white",
              boxShadow: "0 10px 25px rgba(22,163,74,0.25)",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>
              Total Saldo Komisi
            </p>
            <h2
              style={{ margin: "6px 0 0 0", fontSize: 28, letterSpacing: -0.5 }}
            >
              {formatRp(totalKomisiUser)}
            </h2>
            <p style={{ margin: "10px 0 0 0", fontSize: 12, opacity: 0.85 }}>
              Paket: <strong>{userData.paket || "-"}</strong>
            </p>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div style={statTile}>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
                Komisi Bisa Ditarik
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 15, fontWeight: 700 }}>
                {formatRp(userData.komisiSaldo || 0)}
              </p>
            </div>
            <div style={statTile}>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
                Bonus Referral
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 15, fontWeight: 700 }}>
                {formatRp(totalBonusReady)}
              </p>
            </div>
            <div style={statTile}>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
                Sudah Ditarik
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 15, fontWeight: 700 }}>
                {formatRp(userData.totalWithdrawn || 0)}
              </p>
            </div>
            <div style={statTile}>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
                Total Referral
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 15, fontWeight: 700 }}>
                {userData.jumlahRekrut || 0} orang
              </p>
            </div>
          </div>

          {/* Notifikasi */}
          <div style={surface}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ ...sectionLabel, margin: 0 }}>
                Notifikasi
                {customerUnreadCount > 0 && (
                  <span
                    style={{
                      background: "#ef4444",
                      color: "white",
                      fontSize: 10,
                      padding: "2px 7px",
                      borderRadius: 999,
                      marginLeft: 8,
                      letterSpacing: 0,
                    }}
                  >
                    {customerUnreadCount}
                  </span>
                )}
              </h3>
              {(userData.notifCustomer || []).length > 0 && (
                <button onClick={markAllCustomerNotifRead} style={linkAction}>
                  Tandai semua
                </button>
              )}
            </div>
            <div style={subtle}>
              {!userData.notifCustomer ||
              userData.notifCustomer.length === 0 ? (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                  Belum ada notifikasi.
                </p>
              ) : (
                [...userData.notifCustomer]
                  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                  .slice(0, 5)
                  .map((n, idx, arr) => (
                    <div
                      key={n.id}
                      style={{
                        padding: "10px 0",
                        borderBottom:
                          idx === arr.length - 1
                            ? "none"
                            : "1px solid rgba(148,163,184,0.08)",
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: n.read ? "#475569" : "#ef4444",
                          marginTop: 6,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#e2e8f0",
                          }}
                        >
                          {n.title}
                        </p>
                        <p
                          style={{
                            margin: "4px 0 0 0",
                            fontSize: 12,
                            color: "#94a3b8",
                          }}
                        >
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Referral */}
          <div style={surface}>
            <h3 style={sectionLabel}>Referral</h3>
            <div style={subtle}>
              <div style={rowBase}>
                <span style={labelText}>Kode Referral</span>
                <span
                  style={{
                    ...valueText,
                    fontFamily: "monospace",
                    letterSpacing: 1,
                  }}
                >
                  {userData.referralCode}
                </span>
              </div>
              <div style={rowBase}>
                <span style={labelText}>Total Referral</span>
                <span style={valueText}>{userData.jumlahRekrut || 0} orang</span>
              </div>
              <div
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(148,163,184,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={labelText}>Progress Bonus</span>
                  <span style={{ ...valueText, fontSize: 12 }}>
                    {userData.bonusProgress || 0}/10
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "rgba(148,163,184,0.15)",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: "100%",
                      background: "linear-gradient(90deg,#22c55e,#0ea5e9)",
                    }}
                  />
                </div>
              </div>
              <div style={rowLast}>
                <span style={labelText}>Bonus Siap Dibayar</span>
                <span style={{ ...valueText, color: "#4ade80" }}>
                  {formatRp(totalBonusReady)}
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                background: "rgba(2,6,23,0.6)",
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.06)",
                wordBreak: "break-all",
                fontSize: 12,
                color: "#cbd5e1",
              }}
            >
              {referralLink}
            </div>
            <button
              style={{ ...btnBlue, marginTop: 10 }}
              onClick={() => copyText(referralLink, "Link referral disalin.")}
            >
              Copy Link Referral
            </button>
          </div>

          {/* Penarikan Saldo */}
          <div style={surface}>
            <h3 style={sectionLabel}>Penarikan Saldo</h3>
            <input
              style={input}
              placeholder="Jumlah yang akan ditarik"
              inputMode="numeric"
              value={
                withdrawAmount
                  ? Number(withdrawAmount).toLocaleString("id-ID")
                  : ""
              }
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setWithdrawAmount(digits);
              }}
            />
            <button style={btnGold} onClick={submitWithdraw}>
              Tarik Saldo
            </button>

            {userData.withdrawRequest?.status === "pending" && (
              <div style={pendingBox}>
                Penarikan {formatRp(userData.withdrawRequest.amount)} sedang
                menunggu konfirmasi admin.
              </div>
            )}
          </div>

          {/* Pembayaran Pendaftaran */}
          <div style={surface}>
            <h3 style={sectionLabel}>Pembayaran Pendaftaran</h3>

            {userApproved ? (
              <div
                style={{
                  padding: 12,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: 10,
                  color: "#4ade80",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Pembayaran pendaftaran sudah dikonfirmasi admin.
              </div>
            ) : (
              <>
                <div style={subtle}>
                  <p
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: 11,
                      color: "#94a3b8",
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Metode Pembayaran
                  </p>
                  <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    <p style={{ margin: 0 }}>
                      OVO <strong>085889827352</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      SEABANK <strong>901503319741</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      BANK JAGO <strong>105830435142</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      NEOBANK <strong>5859459237817910</strong>
                    </p>
                    <p style={{ margin: 0, color: "#94a3b8" }}>
                      a/n MAMDUHAM
                    </p>
                  </div>
                  <hr
                    style={{
                      borderColor: "rgba(148,163,184,0.1)",
                      margin: "12px 0",
                    }}
                  />
                  <div style={rowBase}>
                    <span style={labelText}>Paket</span>
                    <span style={valueText}>{userData.paket}</span>
                  </div>
                  <div style={rowLast}>
                    <span style={labelText}>Harga</span>
                    <span style={valueText}>
                      {getHargaPaketLabel(userData.paket)}
                    </span>
                  </div>
                </div>

                <p
                  style={{
                    margin: "12px 0 0 0",
                    fontSize: 11,
                    color: "#f87171",
                    fontWeight: 600,
                  }}
                >
                  * Pembayaran yang sudah dilakukan tidak dapat dikembalikan.
                </p>

                {canShowBayarDaftar && (
                  <button style={btnGold} onClick={handleSudahBayarDaftar}>
                    Sudah Transfer, Konfirmasi
                  </button>
                )}

                {!userApproved && userData.paymentRequestSent && (
                  <div style={pendingBox}>Menunggu konfirmasi admin.</div>
                )}
              </>
            )}
          </div>

          {/* Upgrade Paket */}
          <div style={surface}>
            <h3 style={sectionLabel}>Upgrade Paket</h3>

            {!userApproved ? (
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                Akun harus disetujui admin terlebih dahulu.
              </p>
            ) : !hasPendingUpgrade ? (
              !showUpgradeOptions ? (
                <button
                  style={btnPink}
                  onClick={() => setShowUpgradeOptions(true)}
                >
                  Update Paket
                </button>
              ) : (
                <>
                  <button
                    style={btnBlue}
                    onClick={() => chooseUpgradePackage("Premium")}
                  >
                    Paket Premium · Rp 250.000
                  </button>
                  <button
                    style={btnGold}
                    onClick={() => chooseUpgradePackage("Gold")}
                  >
                    Paket Gold · Rp 500.000
                  </button>
                  <button
                    style={btnDark}
                    onClick={() => setShowUpgradeOptions(false)}
                  >
                    Batal
                  </button>
                </>
              )
            ) : (
              <div
                style={{
                  padding: 12,
                  background: "rgba(250,204,21,0.1)",
                  border: "1px solid rgba(250,204,21,0.3)",
                  borderRadius: 10,
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, color: "#facc15" }}>
                  Request upgrade sedang diproses admin.
                </p>
                <p
                  style={{
                    margin: "6px 0 0 0",
                    fontSize: 13,
                    color: "#e2e8f0",
                  }}
                >
                  Paket dipilih: <strong>{userData.upgradePackage}</strong>
                </p>
              </div>
            )}
          </div>

          {/* Riwayat */}
          <div style={surface}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ ...sectionLabel, margin: 0 }}>Riwayat</h3>
              <button
                onClick={() => setShowHistory(!showHistory)}
                style={linkAction}
              >
                {showHistory ? "Tutup" : "Lihat"}
              </button>
            </div>

            {showHistory && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...subtle, marginBottom: 10 }}>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Riwayat Penarikan
                  </p>
                  {!userData.withdrawalHistory ||
                  userData.withdrawalHistory.length === 0 ? (
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                      Belum ada riwayat penarikan.
                    </p>
                  ) : (
                    [...userData.withdrawalHistory]
                      .sort(
                        (a, b) => (b.approvedAt || 0) - (a.approvedAt || 0)
                      )
                      .map(renderHistoryItem)
                  )}
                </div>

                <div style={subtle}>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    History Bonus
                  </p>
                  {!userData.bonusHistory ||
                  userData.bonusHistory.length === 0 ? (
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                      Belum ada history bonus.
                    </p>
                  ) : (
                    [...userData.bonusHistory]
                      .sort(
                        (a, b) => (b.approvedAt || 0) - (a.approvedAt || 0)
                      )
                      .map(renderHistoryItem)
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Profil Modal */}
        {showProfile && (
          <div
            onClick={() => setShowProfile(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(2,6,23,0.7)",
              backdropFilter: "blur(4px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 480,
                background: "#0f172a",
                border: "1px solid rgba(148,163,184,0.15)",
                borderRadius: 18,
                padding: 18,
                color: "white",
                boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
                maxHeight: "85vh",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Profil Saya
                </h3>
                <button
                  onClick={() => setShowProfile(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(148,163,184,0.2)",
                    color: "#cbd5e1",
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(148,163,184,0.1)",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg,#22c55e,#0ea5e9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {(userData.namaLengkap || "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {userData.namaLengkap}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0 0",
                      fontSize: 12,
                      color: "#94a3b8",
                    }}
                  >
                    {userData.email}
                  </p>
                </div>
                <span
                  style={{
                    background: sb.bg,
                    color: sb.color,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {sb.label}
                </span>
              </div>

              <div style={subtle}>
                <div style={rowBase}>
                  <span style={labelText}>Nama</span>
                  <span style={valueText}>{userData.namaLengkap}</span>
                </div>
                <div style={rowBase}>
                  <span style={labelText}>Email</span>
                  <span style={valueText}>{userData.email}</span>
                </div>
                <div style={rowBase}>
                  <span style={labelText}>No HP</span>
                  <span style={valueText}>{userData.noHp}</span>
                </div>
                <div style={rowBase}>
                  <span style={labelText}>Bank / Rekening</span>
                  <span style={valueText}>
                    {userData.bankNomorRekening}
                  </span>
                </div>
                <div style={rowBase}>
                  <span style={labelText}>Paket</span>
                  <span style={valueText}>{userData.paket}</span>
                </div>
                <div style={rowLast}>
                  <span style={labelText}>Status</span>
                  <span style={{ ...valueText, color: sb.color }}>
                    {sb.label}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowProfile(false)}
                style={{
                  marginTop: 14,
                  width: "100%",
                  background: "rgba(148,163,184,0.1)",
                  border: "1px solid rgba(148,163,184,0.2)",
                  color: "#e2e8f0",
                  padding: "12px 14px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        )}

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
function StatCard({ title, value, accent }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        padding: 16,
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "#64748b",
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {title}
      </p>
      <p
        style={{
          margin: "8px 0 0 0",
          fontSize: 22,
          fontWeight: 800,
          color: accent || "#0f172a",
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function SectionCard({ title, children, right }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function DataCard({ children }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
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
        padding: "9px 14px",
        fontWeight: 700,
        fontSize: 13,
        cursor: onClick ? "pointer" : "not-allowed",
      }}
    >
      {children}
    </button>
  );
}

function InfoRow({ label, value, accent }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <span
        style={{
          color: accent || "#0f172a",
          fontWeight: 600,
          textAlign: "right",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    approved: { bg: "#dcfce7", color: "#15803d", label: "Aktif" },
    pending: { bg: "#fef3c7", color: "#a16207", label: "Menunggu" },
    rejected: { bg: "#fee2e2", color: "#b91c1c", label: "Ditolak" },
  };
  const s = map[status] || {
    bg: "#e2e8f0",
    color: "#475569",
    label: status || "-",
  };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 999,
        textTransform: "capitalize",
      }}
    >
      {s.label}
    </span>
  );
}

function AdminToggle({ label, badge, isOpen, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        background: isOpen ? "#0f172a" : "white",
        color: isOpen ? "white" : "#0f172a",
        border: "1px solid",
        borderColor: isOpen ? "#0f172a" : "#e2e8f0",
        borderRadius: 12,
        padding: "14px 16px",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        transition: "background 0.15s ease",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {label}
        {badge > 0 && (
          <span
            style={{
              background: isOpen ? "#ef4444" : "#fee2e2",
              color: isOpen ? "white" : "#b91c1c",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {badge}
          </span>
        )}
      </span>
      <span
        style={{
          fontSize: 18,
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
          opacity: 0.7,
        }}
      >
        ⌄
      </span>
    </button>
  );
}
