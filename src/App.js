import { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  deleteDoc,
  arrayUnion,
} from "firebase/firestore";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyDef4V0YWxFLVNKjY8qWXPld6iLR9jWpcE",
  authDomain: "pristore-3cd7d.firebaseapp.com",
  projectId: "pristore-3cd7d",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= GLOBAL CONFIG =================
const WEBSITE_URL = "https://pristore.vercel.app";
const LANDING_URL = "https://pristorevideocuan.durable.site";
const WA_LINK = "https://wa.me/message/J6LLQ7VUUGXZN1";
const SAMPLE_VIDEO_LINK =
  "https://drive.google.com/drive/folders/1PKn9VQJp2_sK7C5H9GIVdZ9wmk9dD4XJ";

// ================= HELPERS =================
const getPackagePrice = (pkg) => {
  if (pkg === "Premium") return 250000;
  if (pkg === "Gold") return 500000;
  return 100000;
};

const getPackagePriceLabel = (pkg) => {
  if (pkg === "Premium") return "Rp250.000";
  if (pkg === "Gold") return "Rp500.000";
  return "Rp100.000";
};

const getKomisiPaket = (pkg) => {
  if (pkg === "Premium") return 70000;
  if (pkg === "Gold") return 200000;
  return 40000;
};

const formatRupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

const safeValue = (v) => (v === undefined || v === null || v === "" ? "-" : v);

const nowTs = () => Date.now();

const normalizeText = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const copyText = async (text, successMessage = "Berhasil disalin.") => {
  try {
    await navigator.clipboard.writeText(text || "");
    alert(successMessage);
  } catch (err) {
    alert("Gagal menyalin.");
  }
};

const makeNotif = (type, title, message, extra = {}) => ({
  id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  title,
  message,
  createdAt: Date.now(),
  ...extra,
});

export default function App() {
  // ================= CORE STATE =================
  const [page, setPage] = useState("home");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState(null);

  // ================= FORM STATE =================
  const [namaLengkap, setNamaLengkap] = useState("");
  const [paket, setPaket] = useState("Standar");
  const [bankNomorRekening, setBankNomorRekening] = useState("");
  const [noHp, setNoHp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");

  // ================= ADMIN STATE =================
  const [usersAdmin, setUsersAdmin] = useState([]);
  const [adminFeed, setAdminFeed] = useState([]);
  const [komisiRecords, setKomisiRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [filterPaket, setFilterPaket] = useState("all");

  // ================= UI STATE =================
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [landingTimedOut, setLandingTimedOut] = useState(false);
  const [landingLoaded, setLandingLoaded] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdrawHistory, setShowWithdrawHistory] = useState(false);
  const [showBonusHistory, setShowBonusHistory] = useState(false);

  // ================= GLOBAL EFFECT =================
  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = "#0f172a";
    document.documentElement.style.scrollBehavior = "smooth";
  }, []);

  // ambil referral dari url
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setRefCode(ref);
  }, []);

  // fallback iframe landing
  useEffect(() => {
    if (page !== "home") return;
    const t = setTimeout(() => {
      if (!landingLoaded) setLandingTimedOut(true);
    }, 3500);
    return () => clearTimeout(t);
  }, [page, landingLoaded]);

  // realtime admin data - users
  useEffect(() => {
    if (!isAdmin) return;

    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const all = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setUsersAdmin(all);
      },
      (err) => console.log(err)
    );

    return () => unsub();
  }, [isAdmin]);

  // realtime admin feed
  useEffect(() => {
    if (!isAdmin) return;

    const unsub = onSnapshot(
      collection(db, "admin_notifications"),
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setAdminFeed(rows);
      },
      (err) => console.log(err)
    );

    return () => unsub();
  }, [isAdmin]);

  // realtime komisi table
  useEffect(() => {
    if (!isAdmin) return;

    const unsub = onSnapshot(
      collection(db, "komisi"),
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setKomisiRecords(rows);
      },
      (err) => console.log(err)
    );

    return () => unsub();
  }, [isAdmin]);

  // realtime current user
  useEffect(() => {
    if (!auth.currentUser || isAdmin) return;

    const unsub = onSnapshot(
      doc(db, "users", auth.currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserData({ uid: snap.id, ...snap.data() });
        }
      },
      (err) => console.log(err)
    );

    return () => unsub();
  }, [isAdmin]);

  // ================= HELPERS DB =================
  const addAdminNotif = async (type, title, message, extra = {}) => {
    try {
      const notifRef = doc(collection(db, "admin_notifications"));
      await setDoc(notifRef, {
        type,
        title,
        message,
        createdAt: nowTs(),
        ...extra,
      });
    } catch (err) {
      console.log(err);
    }
  };

  const addKomisiRecord = async ({
    userId,
    nama,
    dari,
    paketBeli,
    jumlah,
    sumber,
  }) => {
    try {
      const recRef = doc(collection(db, "komisi"));
      await setDoc(recRef, {
        userId,
        nama,
        dari,
        paketBeli,
        jumlah,
        sumber,
        createdAt: nowTs(),
      });
    } catch (err) {
      console.log(err);
    }
  };

  const loadUserData = async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const full = { uid, ...snap.data() };
    setUserData(full);
    return full;
  };

  const checkIsAdmin = async (authUser, emailInput) => {
    try {
      const emailNorm = normalizeText(emailInput);
      const adminSnap = await getDocs(collection(db, "admin"));

      let matched = false;

      adminSnap.forEach((d) => {
        const data = d.data() || {};

        const byUidDoc = normalizeText(d.id) === normalizeText(authUser.uid);
        const byUidField =
          normalizeText(data.uid) === normalizeText(authUser.uid);
        const byEmail = normalizeText(data.email) === emailNorm;
        const byEmailDash = normalizeText(data["e-mail"]) === emailNorm;

        const roleVal = normalizeText(data.role || data.peran || "admin");
        const roleOk =
          roleVal === "" || roleVal === "admin" || roleVal === "superadmin";

        if ((byUidDoc || byUidField || byEmail || byEmailDash) && roleOk) {
          matched = true;
        }
      });

      return matched;
    } catch (err) {
      console.log(err);
      return false;
    }
  };

  const processReferralReward = async ({
    buyerUser,
    paketTerbeli,
    sumber,
    countAsReferral,
  }) => {
    try {
      if (!buyerUser?.referredBy) return;

      const refQuery = query(
        collection(db, "users"),
        where("referralCode", "==", buyerUser.referredBy)
      );
      const refSnap = await getDocs(refQuery);

      for (const d of refSnap.docs) {
        const refData = d.data() || {};
        const komisiMasuk = getKomisiPaket(paketTerbeli);

        const updates = {
          komisiSaldo: Number(refData.komisiSaldo || 0) + komisiMasuk,
          notifCustomer: arrayUnion(
            makeNotif(
              "komisi",
              "Komisi paket masuk",
              `${
                buyerUser.namaLengkap
              } membeli paket ${paketTerbeli}. Komisi ${formatRupiah(
                komisiMasuk
              )} masuk ke akun kamu.`
            )
          ),
        };

        await setDoc(doc(db, "users", d.id), updates, { merge: true });

        await addKomisiRecord({
          userId: d.id,
          nama: refData.namaLengkap || "-",
          dari: buyerUser.namaLengkap || "-",
          paketBeli: paketTerbeli,
          jumlah: komisiMasuk,
          sumber,
        });

        await addAdminNotif(
          "komisi",
          "Komisi masuk",
          `${safeValue(refData.namaLengkap)} mendapat komisi ${formatRupiah(
            komisiMasuk
          )} dari pembelian paket ${paketTerbeli}.`,
          { refOwnerUid: d.id, sourceUid: buyerUser.uid || buyerUser.id }
        );

        if (countAsReferral) {
          const progressBaru = Number(refData.bonusProgress || 0) + 1;
          const jumlahRekrutBaru = Number(refData.jumlahRekrut || 0) + 1;

          if (progressBaru >= 10) {
            await setDoc(
              doc(db, "users", d.id),
              {
                jumlahRekrut: jumlahRekrutBaru,
                bonusProgress: 0,
                bonusQueue: Number(refData.bonusQueue || 0) + 1,
                notifCustomer: arrayUnion(
                  makeNotif(
                    "bonus_ready",
                    "Bonus siap dibayar",
                    "Referral kamu sudah genap 10 orang. Bonus Rp100.000 siap dibayar admin."
                  )
                ),
              },
              { merge: true }
            );

            await addAdminNotif(
              "bonus_ready",
              "Bonus referral siap dibayar",
              `${safeValue(
                refData.namaLengkap
              )} sudah mencapai 10 referral. Siap dibayar bonus Rp100.000.`,
              { refOwnerUid: d.id }
            );
          } else {
            await setDoc(
              doc(db, "users", d.id),
              {
                jumlahRekrut: jumlahRekrutBaru,
                bonusProgress: progressBaru,
              },
              { merge: true }
            );
          }
        }
      }
    } catch (err) {
      console.log(err);
    }
  };

  // ================= REGISTER =================
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

        // status pendaftaran
        status: "pending",
        registrationCreatedAt: nowTs(),

        // pembayaran pendaftaran
        sudahBayar: false,
        paymentRequestSent: false,
        paymentApprovedAt: null,

        // proteksi referral
        referralAdded: false,

        // update paket
        upgradeRequested: false,
        upgradePackage: "",
        upgradeStatus: "",
        upgradePaid: false,
        upgradeRequestSent: false,
        upgradeCreatedAt: null,
        upgradeApprovedAt: null,

        // komisi & bonus
        komisiSaldo: 0,
        bonusProgress: 0,
        bonusQueue: 0,
        bonusHistory: [],

        // penarikan
        withdrawRequest: null,
        withdrawalHistory: [],
        totalWithdrawn: 0,

        // notif customer
        notifCustomer: [],
      });

      await addAdminNotif(
        "register",
        "User baru daftar",
        `${namaLengkap} mendaftar dengan paket ${paket}.`,
        { uid, email }
      );

      await loadUserData(uid);
      setPage("dashboard");
      alert("Pendaftaran berhasil. Silakan lanjutkan dari dashboard.");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ================= LOGIN =================
  const login = async () => {
    try {
      if (!email || !password) {
        alert("Email dan password wajib diisi.");
        return;
      }

      setLoading(true);

      const result = await signInWithEmailAndPassword(auth, email, password);
      const authUser = result.user;

      const adminMatched = await checkIsAdmin(authUser, email);

      if (adminMatched) {
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

  // ================= LUPA PASSWORD =================
  const forgotPassword = () => {
    window.open(WA_LINK, "_blank");
  };

  // ================= LOGOUT =================
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.log(err);
    }

    setPage("home");
    setLoading(false);
    setIsAdmin(false);
    setUserData(null);
    setUsersAdmin([]);
    setAdminFeed([]);
    setKomisiRecords([]);
    setSearch("");
    setFilterPaket("all");
    setShowUpgradeOptions(false);
    setWithdrawAmount("");
    setShowWithdrawHistory(false);
    setShowBonusHistory(false);
    setEmail("");
    setPassword("");
  };

  // ================= CUSTOMER - KONFIRMASI BAYAR PENDAFTARAN (WA + SISTEM) =================
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
        "payment_confirm",
        "Konfirmasi pembayaran masuk",
        `${userData.namaLengkap} sudah transfer paket ${userData.paket}.`,
        { uid: userData.uid, email: userData.email }
      );

      const text = `Halo Admin Pristore

Saya sudah transfer 🙏

Nama: ${userData.namaLengkap}
Email: ${userData.email}
No HP: ${userData.noHp}
Paket: ${userData.paket}
Harga: ${getPackagePriceLabel(userData.paket)}
Referral: ${userData.referredBy || "-"}

Mohon di cek dan approve ya kak`;

      window.open(`${WA_LINK}?text=${encodeURIComponent(text)}`, "_blank");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= CUSTOMER - PILIH UPGRADE =================
  const chooseUpgradePackage = async (selectedPackage) => {
    try {
      if (!userData?.uid) return;

      await setDoc(
        doc(db, "users", userData.uid),
        {
          upgradeRequested: true,
          upgradePackage: selectedPackage,
          upgradeStatus: "pending",
          upgradePaid: false,
          upgradeRequestSent: false,
          upgradeCreatedAt: nowTs(),
          upgradeApprovedAt: null,
        },
        { merge: true }
      );

      await addAdminNotif(
        "upgrade_request",
        "Permintaan update paket",
        `${userData.namaLengkap} meminta update ke paket ${selectedPackage}.`,
        { uid: userData.uid, email: userData.email }
      );

      setShowUpgradeOptions(false);
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= CUSTOMER - BAYAR UPDATE =================
  const handleSudahBayarUpdate = async () => {
    try {
      if (!userData?.uid) return;

      await setDoc(
        doc(db, "users", userData.uid),
        { upgradePaid: true },
        { merge: true }
      );

      await addAdminNotif(
        "upgrade_paid",
        "Customer sudah bayar update paket",
        `${userData.namaLengkap} menandai sudah membayar update paket.`,
        { uid: userData.uid, email: userData.email }
      );
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= CUSTOMER - KONFIRMASI UPDATE =================
  const handleKonfirmasiUpdate = async () => {
    try {
      if (!userData?.uid) return;

      await setDoc(
        doc(db, "users", userData.uid),
        { upgradeRequestSent: true },
        { merge: true }
      );

      await addAdminNotif(
        "upgrade_confirm",
        "Konfirmasi pembayaran update paket",
        `${userData.namaLengkap} mengirim konfirmasi pembayaran update paket ${userData.upgradePackage}.`,
        { uid: userData.uid, email: userData.email }
      );

      alert("Konfirmasi update paket dikirim ke dashboard admin.");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= CUSTOMER - TARIK SALDO =================
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

      const payload = {
        id: `wd-${Date.now()}`,
        amount,
        status: "pending",
        requestedAt: nowTs(),
      };

      await setDoc(
        doc(db, "users", userData.uid),
        {
          withdrawRequest: payload,
        },
        { merge: true }
      );

      await addAdminNotif(
        "withdraw_request",
        "Permintaan penarikan",
        `${userData.namaLengkap} meminta penarikan ${formatRupiah(amount)}.`,
        { uid: userData.uid, email: userData.email, amount }
      );

      setWithdrawAmount("");
      alert("Permintaan penarikan berhasil dikirim.");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= ADMIN - APPROVE PENDAFTARAN =================
  const approveRegistration = async (u) => {
    try {
      await setDoc(
        doc(db, "users", u.id),
        {
          status: "approved",
          paymentApprovedAt: nowTs(),
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
        "registration_approved",
        "Pendaftaran di-approve",
        `${u.namaLengkap} berhasil di-approve admin.`,
        { uid: u.id, email: u.email }
      );

      alert("Pendaftaran berhasil dikonfirmasi admin.");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= ADMIN - APPROVE UPDATE =================
  const approveUpgrade = async (u) => {
    try {
      const paketBaru = u.upgradePackage;

      await setDoc(
        doc(db, "users", u.id),
        {
          paket: paketBaru,
          upgradeStatus: "approved",
          upgradeRequested: false,
          upgradePaid: false,
          upgradeRequestSent: false,
          upgradeApprovedAt: nowTs(),
          upgradePackage: "",
        },
        { merge: true }
      );

      if (u.referredBy) {
        await processReferralReward({
          buyerUser: { ...u, uid: u.id },
          paketTerbeli: paketBaru,
          sumber: "update paket",
          countAsReferral: false,
        });
      }

      await addAdminNotif(
        "upgrade_approved",
        "Update paket di-approve",
        `${u.namaLengkap} berhasil update ke paket ${paketBaru}.`,
        { uid: u.id, email: u.email }
      );

      alert("Update paket berhasil dikonfirmasi admin.");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= ADMIN - APPROVE BONUS =================
  const approveBonus = async (u) => {
    try {
      const queue = Number(u.bonusQueue || 0);
      if (queue <= 0) {
        alert("Tidak ada bonus yang siap dibayar.");
        return;
      }

      const historyItem = {
        id: `bonus-${Date.now()}`,
        amount: 100000,
        approvedAt: nowTs(),
        status: "paid",
      };

      await setDoc(
        doc(db, "users", u.id),
        {
          bonusQueue: queue - 1,
          bonusHistory: arrayUnion(historyItem),
          notifCustomer: arrayUnion(
            makeNotif(
              "bonus_paid",
              "Bonus sudah dibayar",
              "Bonus referral Rp100.000 sudah dibayar admin."
            )
          ),
        },
        { merge: true }
      );

      await addAdminNotif(
        "bonus_paid",
        "Bonus referral dibayar",
        `Bonus referral Rp100.000 untuk ${u.namaLengkap} sudah dibayar.`,
        { uid: u.id, email: u.email }
      );

      alert("Bonus berhasil dibayar.");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= ADMIN - APPROVE PENARIKAN =================
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

      const historyItem = {
        id: req.id,
        amount,
        requestedAt: req.requestedAt,
        approvedAt: nowTs(),
        status: "approved",
      };

      await setDoc(
        doc(db, "users", u.id),
        {
          komisiSaldo: Math.max(0, komisiSaldo - amount),
          totalWithdrawn: Number(u.totalWithdrawn || 0) + amount,
          withdrawalHistory: arrayUnion(historyItem),
          withdrawRequest: null,
          notifCustomer: arrayUnion(
            makeNotif(
              "withdraw_approved",
              "Penarikan di-approve",
              `Penarikan ${formatRupiah(amount)} sudah di-approve admin.`,
              { amount }
            )
          ),
        },
        { merge: true }
      );

      await addAdminNotif(
        "withdraw_approved_admin",
        "Penarikan di-approve",
        `${u.namaLengkap} berhasil ditarik ${formatRupiah(amount)}.`,
        { uid: u.id, amount }
      );

      alert("Penarikan berhasil di-approve.");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= ADMIN - HAPUS USER =================
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
  const registrationNotifications = useMemo(() => {
    return usersAdmin
      .filter((u) => !u.upgradeRequested && u.status === "pending")
      .sort(
        (a, b) =>
          (b.registrationCreatedAt || 0) - (a.registrationCreatedAt || 0)
      );
  }, [usersAdmin]);

  const updateNotifications = useMemo(() => {
    return usersAdmin
      .filter(
        (u) => u.upgradeRequested === true && u.upgradeStatus === "pending"
      )
      .sort((a, b) => (b.upgradeCreatedAt || 0) - (a.upgradeCreatedAt || 0));
  }, [usersAdmin]);

  const withdrawNotifications = useMemo(() => {
    return usersAdmin
      .filter((u) => u.withdrawRequest?.status === "pending")
      .sort(
        (a, b) =>
          (b.withdrawRequest?.requestedAt || 0) -
          (a.withdrawRequest?.requestedAt || 0)
      );
  }, [usersAdmin]);

  const bonusReadyRows = useMemo(() => {
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
          u.namaLengkap?.toLowerCase().includes(keyword) ||
          u.email?.toLowerCase().includes(keyword) ||
          u.referralCode?.toLowerCase().includes(keyword);

        const matchPackage = filterPaket === "all" || u.paket === filterPaket;

        return matchSearch && matchPackage;
      })
      .sort(
        (a, b) =>
          (b.registrationCreatedAt || 0) - (a.registrationCreatedAt || 0)
      );
  }, [usersAdmin, search, filterPaket]);

  const totalNotif =
    registrationNotifications.length +
    updateNotifications.length +
    withdrawNotifications.length +
    bonusReadyRows.length;

  const totalKomisiTerbentuk = useMemo(() => {
    return komisiRecords.reduce((sum, k) => sum + Number(k.jumlah || 0), 0);
  }, [komisiRecords]);

  const totalSaldoUser = Number(userData?.komisiSaldo || 0);
  const totalBonusReady = Number(userData?.bonusQueue || 0) * 100000;

  // ================= STYLES =================
  const container = {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#0f172a,#1e293b)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    color: "white",
    padding: 16,
    boxSizing: "border-box",
  };

  const card = {
    background: "rgba(30,41,59,0.96)",
    padding: 20,
    borderRadius: 18,
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
    boxSizing: "border-box",
  };

  const panel = {
    background: "#1e293b",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
    transition: "0.2s",
    boxSizing: "border-box",
  };

  const sectionTitle = {
    margin: "0 0 14px 0",
    fontSize: 18,
    fontWeight: 700,
  };

  const input = {
    width: "100%",
    padding: 14,
    marginBottom: 12,
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "white",
    outline: "none",
    boxSizing: "border-box",
    fontSize: 14,
  };

  const select = {
    ...input,
    cursor: "pointer",
  };

  const btn = {
    width: "100%",
    minHeight: 48,
    padding: 14,
    marginTop: 10,
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    transition: "0.15s",
    boxSizing: "border-box",
  };

  const btnSecondary = {
    ...btn,
    background: "#334155",
  };

  const btnBlue = {
    ...btn,
    background: "#2563eb",
  };

  const btnGold = {
    ...btn,
    background: "#d97706",
  };

  const btnPink = {
    ...btn,
    background: "#db2777",
  };

  const btnDanger = {
    ...btn,
    background: "#dc2626",
  };

  const backBtn = {
    marginBottom: 12,
    background: "#334155",
    color: "white",
    padding: 10,
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
  };

  const paymentBox = {
    background: "#0f172a",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    border: "1px solid rgba(255,255,255,0.05)",
    lineHeight: 1.7,
  };

  const pressProps = {
    onTouchStart: (e) => {
      e.currentTarget.style.opacity = "0.7";
    },
    onTouchEnd: (e) => {
      e.currentTarget.style.opacity = "1";
    },
    onMouseDown: (e) => {
      e.currentTarget.style.transform = "scale(0.98)";
    },
    onMouseUp: (e) => {
      e.currentTarget.style.transform = "scale(1)";
    },
  };

  // ================= HOME =================
  if (page === "home") {
    return (
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          background: "#0f172a",
        }}
      >
        {!landingTimedOut && (
          <iframe
            src={LANDING_URL}
            title="Landing Page Pristore"
            style={{
              width: "100%",
              height: "100vh",
              border: "none",
              display: "block",
            }}
            onLoad={() => setLandingLoaded(true)}
          />
        )}

        {landingTimedOut && (
          <div
            style={{
              minHeight: "100vh",
              background: "linear-gradient(135deg,#0f172a,#1e293b)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              textAlign: "center",
              padding: 20,
            }}
          >
            <div>
              <h2 style={{ marginBottom: 10 }}>PRISTORE</h2>
              <p style={{ opacity: 0.85 }}>
                Landing page tidak bisa ditampilkan langsung. Gunakan tombol di
                bawah.
              </p>
              <a
                href={LANDING_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  padding: "12px 18px",
                  borderRadius: 10,
                  background: "#22c55e",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Buka Landing Page
              </a>
            </div>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.42)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
        >
          <div style={{ ...card, textAlign: "center" }}>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>PRISTORE</h2>
            <p style={{ marginTop: 0, opacity: 0.82, fontSize: 14 }}>
              Login atau daftar untuk masuk ke dashboard.
            </p>

            <button
              style={btn}
              onClick={() => setPage("login")}
              {...pressProps}
            >
              Login
            </button>

            <button
              style={btnSecondary}
              onClick={() => setPage("register")}
              {...pressProps}
            >
              Daftar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= LOGIN =================
  if (page === "login") {
    return (
      <div style={container}>
        <div style={card}>
          <button style={backBtn} onClick={() => setPage("home")}>
            ← Kembali
          </button>

          <button
            style={{ ...btnGold, marginTop: 0, marginBottom: 10 }}
            onClick={() => window.open(SAMPLE_VIDEO_LINK, "_blank")}
            {...pressProps}
          >
            🎥 Sample Video
          </button>

          <h3 style={{ marginTop: 0 }}>Login</h3>

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

          <button
            style={btn}
            onClick={login}
            disabled={loading}
            {...pressProps}
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "#60a5fa",
              cursor: "pointer",
              fontWeight: 700,
            }}
            onClick={forgotPassword}
          >
            Lupa password?
          </p>

          <p style={{ marginTop: 14, fontSize: 12 }}>
            Belum punya akun?{" "}
            <span
              style={{ color: "#22c55e", cursor: "pointer", fontWeight: 700 }}
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
          <button style={backBtn} onClick={() => setPage("home")}>
            ← Kembali
          </button>

          <h3 style={{ marginTop: 0 }}>Daftar</h3>

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
            placeholder="Kode Referral"
            value={refCode}
            onChange={(e) => setRefCode(e.target.value)}
          />

          <button
            style={btn}
            onClick={register}
            disabled={loading}
            {...pressProps}
          >
            {loading ? "Memproses..." : "Daftar"}
          </button>

          <p style={{ marginTop: 14, fontSize: 12 }}>
            Sudah punya akun?{" "}
            <span
              style={{ color: "#22c55e", cursor: "pointer", fontWeight: 700 }}
              onClick={() => setPage("login")}
            >
              Login
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ================= ADMIN DASHBOARD =================
  if (page === "admin") {
    return (
      <div
        style={{
          padding: 16,
          background: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
          minHeight: "100vh",
          color: "#111827",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              background: "white",
              padding: 18,
              borderRadius: 18,
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
                Kelola pendaftaran, komisi, bonus, penarikan, dan semua user.
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
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 18,
                padding: 16,
                boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>🔔 Notifikasi</h3>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
                {totalNotif}
              </p>
            </div>

            <div
              style={{
                background: "white",
                borderRadius: 18,
                padding: 16,
                boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>👥 Total User</h3>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
                {usersAdmin.length}
              </p>
            </div>

            <div
              style={{
                background: "white",
                borderRadius: 18,
                padding: 16,
                boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>💰 Total Komisi</h3>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
                {formatRupiah(totalKomisiTerbentuk)}
              </p>
            </div>
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>🔔 Feed Notifikasi Admin</h2>

            {adminFeed.length === 0 ? (
              <p>Tidak ada notifikasi.</p>
            ) : (
              adminFeed.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                    {safeValue(n.title)}
                  </p>
                  <p style={{ margin: "0 0 6px 0" }}>{safeValue(n.message)}</p>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>📥 Pendaftaran Baru</h2>

            {registrationNotifications.length === 0 ? (
              <p>Tidak ada pendaftaran baru.</p>
            ) : (
              registrationNotifications.map((u) => {
                const siapApprove = u.sudahBayar && u.paymentRequestSent;

                return (
                  <div
                    key={u.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 12,
                    }}
                  >
                    <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                      {safeValue(u.namaLengkap)}
                    </p>
                    <p style={{ margin: "0 0 6px 0" }}>{safeValue(u.email)}</p>
                    <p style={{ margin: "0 0 10px 0" }}>
                      Paket: {safeValue(u.paket)}
                    </p>

                    {siapApprove ? (
                      <button
                        onClick={() => approveRegistration(u)}
                        style={{
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Approve
                      </button>
                    ) : (
                      <button
                        disabled
                        style={{
                          background: "#cbd5e1",
                          color: "#475569",
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontWeight: 700,
                        }}
                      >
                        Menunggu customer
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>🔄 Update Paket</h2>

            {updateNotifications.length === 0 ? (
              <p>Tidak ada permintaan update paket.</p>
            ) : (
              updateNotifications.map((u) => {
                const siapApprove = u.upgradePaid && u.upgradeRequestSent;

                return (
                  <div
                    key={u.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 12,
                    }}
                  >
                    <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                      {safeValue(u.namaLengkap)}
                    </p>
                    <p style={{ margin: "0 0 6px 0" }}>{safeValue(u.email)}</p>
                    <p style={{ margin: "0 0 10px 0" }}>
                      Update ke: {safeValue(u.upgradePackage)}
                    </p>

                    {siapApprove ? (
                      <button
                        onClick={() => approveUpgrade(u)}
                        style={{
                          background: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Approve Update
                      </button>
                    ) : (
                      <button
                        disabled
                        style={{
                          background: "#cbd5e1",
                          color: "#475569",
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontWeight: 700,
                        }}
                      >
                        Menunggu customer
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>💰 Tabel Komisi</h2>

            {komisiRecords.length === 0 ? (
              <p>Belum ada komisi.</p>
            ) : (
              komisiRecords.map((k) => (
                <div
                  key={k.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                    {safeValue(k.nama)}
                  </p>
                  <p style={{ margin: "4px 0" }}>Dari: {safeValue(k.dari)}</p>
                  <p style={{ margin: "4px 0" }}>
                    Paket: {safeValue(k.paketBeli)}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Sumber: {safeValue(k.sumber)}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Komisi: {formatRupiah(k.jumlah)}
                  </p>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>👥 Bonus Referral</h2>

            {bonusReadyRows.length === 0 ? (
              <p>Tidak ada bonus yang siap dibayar.</p>
            ) : (
              bonusReadyRows.map((u) => (
                <div
                  key={u.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                    {safeValue(u.namaLengkap)}
                  </p>
                  <p style={{ margin: "4px 0" }}>Email: {safeValue(u.email)}</p>
                  <p style={{ margin: "4px 0" }}>
                    Total Referral: {u.jumlahRekrut || 0}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Bonus Siap Dibayar:{" "}
                    {formatRupiah((u.bonusQueue || 0) * 100000)}
                  </p>

                  <button
                    onClick={() => approveBonus(u)}
                    style={{
                      background: "#d97706",
                      color: "white",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Approve Bonus 100k
                  </button>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>💸 Penarikan</h2>

            {withdrawNotifications.length === 0 ? (
              <p>Tidak ada penarikan pending.</p>
            ) : (
              withdrawNotifications.map((u) => (
                <div
                  key={u.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                    {safeValue(u.namaLengkap)}
                  </p>
                  <p style={{ margin: "4px 0" }}>Email: {safeValue(u.email)}</p>
                  <p style={{ margin: "4px 0" }}>
                    Jumlah: {formatRupiah(u.withdrawRequest?.amount || 0)}
                  </p>

                  <button
                    onClick={() => approveWithdraw(u)}
                    style={{
                      background: "#16a34a",
                      color: "white",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Approve Penarikan
                  </button>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>👤 Semua User</h2>

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
                <div
                  key={u.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                    {safeValue(u.namaLengkap)}
                  </p>
                  <p style={{ margin: "4px 0" }}>Email: {safeValue(u.email)}</p>
                  <p style={{ margin: "4px 0" }}>No HP: {safeValue(u.noHp)}</p>
                  <p style={{ margin: "4px 0" }}>Paket: {safeValue(u.paket)}</p>
                  <p style={{ margin: "4px 0" }}>
                    Status: {safeValue(u.status)}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Referral Code: {safeValue(u.referralCode)}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Referred By: {safeValue(u.referredBy)}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Jumlah Rekrut: {u.jumlahRekrut || 0}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Komisi Saldo: {formatRupiah(u.komisiSaldo || 0)}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Bonus Progress: {u.bonusProgress || 0}/10
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Bonus Queue: {u.bonusQueue || 0}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 10,
                    }}
                  >
                    <button
                      onClick={() => copyText(u.email, "Email disalin")}
                      style={{
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Copy Email
                    </button>

                    <button
                      onClick={() => copyText(u.noHp || "", "No HP disalin")}
                      style={{
                        background: "#475569",
                        color: "white",
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Copy No HP
                    </button>

                    <button
                      onClick={() => deleteUser(u.id)}
                      style={{
                        background: "#dc2626",
                        color: "white",
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ================= CUSTOMER DASHBOARD =================
  if (page === "dashboard" && userData) {
    const userApproved = userData.status === "approved";
    const canShowBayarDaftar = !userApproved && !userData.sudahBayar;

    const hasPendingUpgrade =
      userData.upgradeRequested && userData.upgradeStatus === "pending";

    const canShowBayarUpdate = hasPendingUpgrade && !userData.upgradePaid;
    const canShowKonfirmasiUpdate =
      hasPendingUpgrade && userData.upgradePaid && !userData.upgradeRequestSent;

    const referralLink = `${WEBSITE_URL}/?ref=${userData.referralCode}`;

    return (
      <div style={{ ...container, paddingTop: 0 }}>
        <div style={{ width: "100%", maxWidth: 1150 }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: "#0f172a",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>
              👋 {safeValue(userData.namaLengkap)}
            </h3>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg,#22c55e,#16a34a)",
              padding: 16,
              borderRadius: 16,
              marginBottom: 14,
              color: "white",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>
              Total Saldo Komisi
            </p>
            <h2 style={{ margin: "4px 0 0 0" }}>
              {formatRupiah(totalSaldoUser)}
            </h2>
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
              style={{ ...btnSecondary, width: 160, marginTop: 0 }}
              onClick={handleLogout}
              {...pressProps}
            >
              Logout
            </button>
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: 1150,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 14,
            }}
          >
            <div style={panel}>
              <h3 style={sectionTitle}>Profil Customer</h3>

              <div style={paymentBox}>
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

              <div style={paymentBox}>
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
                  <strong>Bonus Siap Dibayar:</strong>{" "}
                  {formatRupiah(totalBonusReady)}
                </p>
                <p style={{ margin: "6px 0", wordBreak: "break-all" }}>
                  <strong>Link Referral:</strong>
                  <br />
                  {referralLink}
                </p>

                <button
                  style={btnBlue}
                  onClick={() =>
                    copyText(referralLink, "Link referral disalin.")
                  }
                  {...pressProps}
                >
                  Copy Link
                </button>

                <button
                  style={btnSecondary}
                  onClick={() => window.open(WA_LINK, "_blank")}
                  {...pressProps}
                >
                  Hubungi Admin
                </button>
              </div>
            </div>

            <div style={panel}>
              <h3 style={sectionTitle}>Keuangan</h3>

              <div style={paymentBox}>
                <p style={{ margin: "6px 0" }}>
                  <strong>Komisi Paket (Bisa Ditarik):</strong>{" "}
                  {formatRupiah(userData.komisiSaldo || 0)}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>Bonus Referral:</strong>{" "}
                  {formatRupiah((userData.bonusQueue || 0) * 100000)}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>Total Sudah Ditarik:</strong>{" "}
                  {formatRupiah(userData.totalWithdrawn || 0)}
                </p>
              </div>

              <input
                style={input}
                placeholder="Jumlah yang akan ditarik"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />

              <button style={btnGold} onClick={submitWithdraw} {...pressProps}>
                Tarik Saldo
              </button>

              {userData.withdrawRequest?.status === "pending" && (
                <p style={{ marginTop: 12, color: "#facc15", fontWeight: 700 }}>
                  Permintaan penarikan{" "}
                  {formatRupiah(userData.withdrawRequest.amount)} sedang
                  menunggu admin.
                </p>
              )}
            </div>

            <div style={panel}>
              <h3 style={sectionTitle}>Pembayaran Pendaftaran</h3>

              <div style={paymentBox}>
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
                  Paket: <strong>{userData.paket}</strong>
                </p>
                <p style={{ margin: "6px 0" }}>
                  Harga: <strong>{getPackagePriceLabel(userData.paket)}</strong>
                </p>

                {userApproved && (
                  <p style={{ color: "#4ade80", fontWeight: 700 }}>
                    Pembayaran pendaftaran sudah dikonfirmasi admin.
                  </p>
                )}

                {canShowBayarDaftar && (
                  <button
                    style={btnGold}
                    onClick={handleSudahBayarDaftar}
                    {...pressProps}
                  >
                    SUDAH TRANSFER KONFIRMASI DI SINI
                  </button>
                )}

                {!userApproved && userData.paymentRequestSent && (
                  <p
                    style={{ marginTop: 12, color: "#facc15", fontWeight: 700 }}
                  >
                    Menunggu konfirmasi admin.
                  </p>
                )}
              </div>
            </div>

            <div style={panel}>
              <h3 style={sectionTitle}>Update Paket</h3>

              {!userApproved ? (
                <div style={paymentBox}>
                  <p style={{ opacity: 0.9 }}>
                    Tombol update paket muncul setelah akun kamu dikonfirmasi
                    admin.
                  </p>
                </div>
              ) : (
                <>
                  {!hasPendingUpgrade && (
                    <div style={paymentBox}>
                      <p style={{ marginTop: 0 }}>
                        Pilih update paket yang kamu inginkan.
                      </p>

                      {!showUpgradeOptions ? (
                        <button
                          style={btnPink}
                          onClick={() => setShowUpgradeOptions(true)}
                          {...pressProps}
                        >
                          Update
                        </button>
                      ) : (
                        <>
                          <button
                            style={btnBlue}
                            onClick={() => chooseUpgradePackage("Premium")}
                            {...pressProps}
                          >
                            Paket Premium 250k
                          </button>

                          <button
                            style={btnGold}
                            onClick={() => chooseUpgradePackage("Gold")}
                            {...pressProps}
                          >
                            Paket Gold 500k
                          </button>

                          <button
                            style={btnSecondary}
                            onClick={() => setShowUpgradeOptions(false)}
                            {...pressProps}
                          >
                            Batal
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {hasPendingUpgrade && (
                    <div style={paymentBox}>
                      <p style={{ margin: "0 0 8px 0", fontWeight: 700 }}>
                        Metode Pembayaran
                      </p>
                      <p style={{ margin: "4px 0" }}>OVO 085889827352</p>
                      <p style={{ margin: "4px 0" }}>SEABANK 901503319741</p>
                      <p style={{ margin: "4px 0" }}>BANK JAGO 105830435142</p>
                      <p style={{ margin: "4px 0" }}>
                        NEOBANK 5859459237817910
                      </p>
                      <p style={{ margin: "4px 0" }}>A/n ( MAMDUHAM )</p>
                      <hr
                        style={{ borderColor: "#1e293b", margin: "12px 0" }}
                      />
                      <p style={{ margin: "6px 0" }}>
                        Paket Saat Ini: <strong>{userData.paket}</strong>
                      </p>
                      <p style={{ margin: "6px 0" }}>
                        Paket Update: <strong>{userData.upgradePackage}</strong>
                      </p>
                      <p style={{ margin: "6px 0" }}>
                        Harga Update:{" "}
                        <strong>
                          {getPackagePriceLabel(userData.upgradePackage)}
                        </strong>
                      </p>

                      {canShowBayarUpdate && (
                        <button
                          style={btnGold}
                          onClick={handleSudahBayarUpdate}
                          {...pressProps}
                        >
                          Saya sudah membayar
                        </button>
                      )}

                      {canShowKonfirmasiUpdate && (
                        <button
                          style={btn}
                          onClick={handleKonfirmasiUpdate}
                          {...pressProps}
                        >
                          Konfirmasi Pembayaran
                        </button>
                      )}

                      {userData.upgradeRequestSent && (
                        <p
                          style={{
                            marginTop: 12,
                            color: "#facc15",
                            fontWeight: 700,
                          }}
                        >
                          Update paket sedang menunggu konfirmasi admin.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={panel}>
              <h3 style={sectionTitle}>Riwayat</h3>

              <button
                style={btnSecondary}
                onClick={() => setShowWithdrawHistory(!showWithdrawHistory)}
                {...pressProps}
              >
                {showWithdrawHistory
                  ? "Tutup Riwayat Penarikan"
                  : "Riwayat Penarikan"}
              </button>

              {showWithdrawHistory && (
                <div style={{ ...paymentBox, marginTop: 10 }}>
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
                            <strong>Jumlah:</strong> {formatRupiah(item.amount)}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            <strong>Status:</strong> {item.status}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              )}

              <button
                style={btnSecondary}
                onClick={() => setShowBonusHistory(!showBonusHistory)}
                {...pressProps}
              >
                {showBonusHistory ? "Tutup History Bonus" : "History Bonus"}
              </button>

              {showBonusHistory && (
                <div style={{ ...paymentBox, marginTop: 10 }}>
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
                            <strong>Jumlah:</strong> {formatRupiah(item.amount)}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            <strong>Status:</strong> {item.status}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>

            <div style={panel}>
              <h3 style={sectionTitle}>Notifikasi Customer</h3>

              {!userData.notifCustomer ||
              userData.notifCustomer.length === 0 ? (
                <div style={paymentBox}>
                  <p style={{ margin: 0 }}>Belum ada notifikasi.</p>
                </div>
              ) : (
                <div style={paymentBox}>
                  {[...userData.notifCustomer]
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
                          {n.title}
                        </p>
                        <p style={{ margin: "4px 0", opacity: 0.9 }}>
                          {n.message}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <a
            href={WA_LINK}
            target="_blank"
            rel="noreferrer"
            style={{
              position: "fixed",
              bottom: 20,
              right: 20,
              background: "#22c55e",
              color: "white",
              padding: 14,
              borderRadius: "50%",
              fontSize: 18,
              textDecoration: "none",
              boxShadow: "0 5px 20px rgba(0,0,0,0.4)",
            }}
          >
            💬
          </a>
        </div>
      </div>
    );
  }

  // ================= FALLBACK =================
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
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
