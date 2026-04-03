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
const WEBSITE_URL = "https://pristore.com";
const LANDING_URL = "https://pristorevideocuan.durable.site";
const WA_LINK = "https://tinyurl.com/mamduhjon";
const PAYMENT_IMAGE = "https://i.ibb.co/fVs4623q/image.jpg";

// ================= HELPERS =================
const getPackagePrice = (pkg) => {
  if (pkg === "Premium") return "Rp250.000";
  if (pkg === "Gold") return "Rp500.000";
  return "Rp100.000";
};

const safeValue = (v) => (v === undefined || v === null || v === "" ? "-" : v);

const buildWaUrl = (message) =>
  `${WA_LINK}?text=${encodeURIComponent(message)}`;

const copyText = async (text, successMessage = "Berhasil disalin.") => {
  try {
    await navigator.clipboard.writeText(text || "");
    alert(successMessage);
  } catch (err) {
    alert("Gagal menyalin.");
  }
};

const normalizeText = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

export default function App() {
  // ================= CORE STATE =================
  const [page, setPage] = useState("home");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState(null);

  // ================= FORM STATE =================
  const [namaLengkap, setNamaLengkap] = useState("");
  const [paket, setPaket] = useState("Standar");
  const [noRekening, setNoRekening] = useState("");
  const [noHp, setNoHp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");

  // ================= ADMIN STATE =================
  const [usersAdmin, setUsersAdmin] = useState([]);
  const [search, setSearch] = useState("");
  const [filterPaket, setFilterPaket] = useState("all");

  // ================= UI STATE =================
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [landingTimedOut, setLandingTimedOut] = useState(false);
  const [landingLoaded, setLandingLoaded] = useState(false);

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

  // realtime admin data
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
      (err) => {
        console.log(err);
      }
    );

    return () => unsub();
  }, [isAdmin]);

  // ================= LOAD USER =================
  const loadUserData = async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;

    const data = snap.data();
    const full = { uid, ...data };
    setUserData(full);
    return full;
  };

  // ================= CEK ADMIN =================
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

  // ================= REGISTER =================
  const register = async () => {
    try {
      if (
        !namaLengkap ||
        !paket ||
        !noRekening ||
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
        noRekening,
        noHp,
        email,
        referralCode: code,
        referredBy: refCode || "",
        jumlahRekrut: 0,

        // status pendaftaran
        status: "pending",
        registrationCreatedAt: Date.now(),

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
      });

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

  // ================= LUPA PASSWORD VIA ADMIN =================
  const forgotPassword = () => {
    const text = [
      "Halo Admin Pristore, saya lupa password.",
      `Email akun saya: ${safeValue(email)}`,
      "Mohon bantu reset / kirim ulang password saya.",
    ].join("\n");

    window.location.href = buildWaUrl(text);
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
    setSearch("");
    setFilterPaket("all");
    setShowUpgradeOptions(false);
    setEmail("");
    setPassword("");
  };

  // ================= CUSTOMER - BAYAR PENDAFTARAN =================
  const handleSudahBayarDaftar = async () => {
    try {
      if (!userData?.uid) return;

      await setDoc(
        doc(db, "users", userData.uid),
        { sudahBayar: true },
        { merge: true }
      );

      await loadUserData(userData.uid);
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= CUSTOMER - KONFIRMASI PENDAFTARAN =================
  const handleKonfirmasiDaftar = async () => {
    try {
      if (!userData?.uid) return;

      await setDoc(
        doc(db, "users", userData.uid),
        { paymentRequestSent: true },
        { merge: true }
      );

      const text = [
        "Halo Admin Pristore, saya ingin konfirmasi pembayaran pendaftaran.",
        `Nama: ${safeValue(userData.namaLengkap)}`,
        `Email: ${safeValue(userData.email)}`,
        `No HP: ${safeValue(userData.noHp)}`,
        `Paket: ${safeValue(userData.paket)}`,
        `Harga: ${getPackagePrice(userData.paket)}`,
        `Kode Referral Saya: ${safeValue(userData.referralCode)}`,
        `Direkomendasikan Oleh: ${safeValue(userData.referredBy)}`,
      ].join("\n");

      await loadUserData(userData.uid);
      window.location.href = buildWaUrl(text);
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
          upgradeCreatedAt: Date.now(),
          upgradeApprovedAt: null,
        },
        { merge: true }
      );

      setShowUpgradeOptions(false);
      await loadUserData(userData.uid);
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

      await loadUserData(userData.uid);
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

      const text = [
        "Halo Admin Pristore, saya ingin konfirmasi pembayaran update paket.",
        `Nama: ${safeValue(userData.namaLengkap)}`,
        `Email: ${safeValue(userData.email)}`,
        `No HP: ${safeValue(userData.noHp)}`,
        `Paket Saat Ini: ${safeValue(userData.paket)}`,
        `Paket Update: ${safeValue(userData.upgradePackage)}`,
        `Harga Update: ${getPackagePrice(userData.upgradePackage)}`,
      ].join("\n");

      await loadUserData(userData.uid);
      window.location.href = buildWaUrl(text);
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
          paymentApprovedAt: Date.now(),
        },
        { merge: true }
      );

      // referral masuk setelah approve
      if (u.referredBy && !u.referralAdded) {
        const refQuery = query(
          collection(db, "users"),
          where("referralCode", "==", u.referredBy)
        );
        const refSnap = await getDocs(refQuery);

        for (const d of refSnap.docs) {
          await setDoc(
            doc(db, "users", d.id),
            {
              jumlahRekrut: (d.data().jumlahRekrut || 0) + 1,
            },
            { merge: true }
          );
        }

        await setDoc(
          doc(db, "users", u.id),
          { referralAdded: true },
          { merge: true }
        );
      }

      alert("Pendaftaran berhasil dikonfirmasi admin.");
    } catch (err) {
      alert(err.message);
    }
  };

  // ================= ADMIN - APPROVE UPDATE =================
  const approveUpgrade = async (u) => {
    try {
      await setDoc(
        doc(db, "users", u.id),
        {
          paket: u.upgradePackage,
          upgradeStatus: "approved",
          upgradeRequested: false,
          upgradePaid: false,
          upgradeRequestSent: false,
          upgradeApprovedAt: Date.now(),
          upgradePackage: "",
        },
        { merge: true }
      );

      alert("Update paket berhasil dikonfirmasi admin.");
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

  // ================= STYLES =================
  const container = {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#0f172a,#1e293b)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
    padding: 20,
    boxSizing: "border-box",
  };

  const card = {
    background: "rgba(30,41,59,0.96)",
    padding: 24,
    borderRadius: 20,
    width: 340,
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  };

  const panel = {
    background: "rgba(30,41,59,0.96)",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
  };

  const sectionTitle = {
    margin: "0 0 14px 0",
    fontSize: 18,
    fontWeight: 700,
  };

  const input = {
    width: "100%",
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "white",
    outline: "none",
    boxSizing: "border-box",
  };

  const select = {
    ...input,
    cursor: "pointer",
  };

  const btn = {
    width: "100%",
    padding: 12,
    marginTop: 10,
    borderRadius: 10,
    border: "none",
    background: "#22c55e",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
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
            padding: 20,
          }}
        >
          <div style={{ ...card, textAlign: "center" }}>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>PRISTORE</h2>
            <p style={{ marginTop: 0, opacity: 0.82, fontSize: 14 }}>
              Login atau daftar untuk masuk ke dashboard.
            </p>

            <button style={btn} onClick={() => setPage("login")}>
              Login
            </button>

            <button style={btnSecondary} onClick={() => setPage("register")}>
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

          <button style={btn} onClick={login} disabled={loading}>
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
            placeholder="No Rekening"
            value={noRekening}
            onChange={(e) => setNoRekening(e.target.value)}
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

          <button style={btn} onClick={register} disabled={loading}>
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

  // ================= ADMIN DASHBOARD SIMPLE =================
  if (page === "admin") {
    const totalNotif =
      registrationNotifications.length + updateNotifications.length;

    return (
      <div
        style={{
          padding: 20,
          background: "#fff",
          minHeight: "100vh",
          color: "#111",
        }}
      >
        <h1 style={{ marginBottom: 20 }}>🔥 ADMIN DASHBOARD</h1>

        <h2>🔔 Notifikasi ({totalNotif})</h2>

        {registrationNotifications.length > 0 && (
          <>
            <h3>📥 Pendaftaran Baru</h3>
            {registrationNotifications.map((u) => {
              const siapApprove = u.sudahBayar && u.paymentRequestSent;

              return (
                <div key={u.id} style={{ marginBottom: 18 }}>
                  <p>{safeValue(u.email)}</p>
                  {siapApprove ? (
                    <button onClick={() => approveRegistration(u)}>
                      Approve
                    </button>
                  ) : (
                    <button disabled>Menunggu customer</button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {updateNotifications.length > 0 && (
          <>
            <h3>🔄 Update Paket</h3>
            {updateNotifications.map((u) => {
              const siapApprove = u.upgradePaid && u.upgradeRequestSent;

              return (
                <div key={u.id} style={{ marginBottom: 18 }}>
                  <p>
                    {safeValue(u.email)} - update ke{" "}
                    {safeValue(u.upgradePackage)}
                  </p>
                  {siapApprove ? (
                    <button onClick={() => approveUpgrade(u)}>
                      Approve Update
                    </button>
                  ) : (
                    <button disabled>Menunggu customer</button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {totalNotif === 0 && <p>Tidak ada notif</p>}

        <hr style={{ margin: "24px 0" }} />

        <h2>👥 Semua User</h2>

        <div style={{ marginBottom: 16 }}>
          <input
            style={{
              width: 260,
              padding: 10,
              marginRight: 10,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
            placeholder="Cari nama / email / referral..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 6,
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
          <p>Belum ada data user</p>
        ) : (
          filteredCustomers.map((u) => (
            <div key={u.id} style={{ marginBottom: 20 }}>
              <p>
                <strong>{safeValue(u.namaLengkap)}</strong>
              </p>
              <p>Email: {safeValue(u.email)}</p>
              <p>No HP: {safeValue(u.noHp)}</p>
              <p>Paket: {safeValue(u.paket)}</p>
              <p>Status: {safeValue(u.status)}</p>
              <p>Referral Code: {safeValue(u.referralCode)}</p>
              <p>Referred By: {safeValue(u.referredBy)}</p>
              <p>Jumlah Rekrut: {u.jumlahRekrut || 0}</p>

              <button onClick={() => copyText(u.email, "Email disalin")}>
                Copy Email
              </button>

              <button
                onClick={() => copyText(u.noHp || "", "No HP disalin")}
                style={{ marginLeft: 8 }}
              >
                Copy No HP
              </button>

              <button
                onClick={() => deleteUser(u.id)}
                style={{ marginLeft: 8 }}
              >
                Hapus
              </button>
            </div>
          ))
        )}

        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  // ================= CUSTOMER DASHBOARD FULL =================
  if (page === "dashboard" && userData) {
    const userApproved = userData.status === "approved";

    const canShowBayarDaftar = !userApproved && !userData.sudahBayar;
    const canShowKonfirmasiDaftar =
      !userApproved && userData.sudahBayar && !userData.paymentRequestSent;

    const hasPendingUpgrade =
      userData.upgradeRequested && userData.upgradeStatus === "pending";

    const canShowBayarUpdate = hasPendingUpgrade && !userData.upgradePaid;
    const canShowKonfirmasiUpdate =
      hasPendingUpgrade && userData.upgradePaid && !userData.upgradeRequestSent;

    const referralLink = `${WEBSITE_URL}/?ref=${userData.referralCode}`;

    return (
      <div style={{ ...container, alignItems: "flex-start" }}>
        <div style={{ width: "100%", maxWidth: 1150 }}>
          <div
            style={{
              ...panel,
              marginBottom: 18,
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
                Kelola akun, pembayaran, referral, dan update paket.
              </p>
            </div>

            <button
              style={{ ...btnSecondary, width: 160, marginTop: 0 }}
              onClick={handleLogout}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 18,
            }}
          >
            <div style={panel}>
              <h3 style={sectionTitle}>Profil Customer</h3>

              <div
                style={{
                  background: "#0f172a",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
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
                  <strong>No Rekening:</strong> {userData.noRekening}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>Paket:</strong> {userData.paket}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>Status:</strong> {userData.status}
                </p>
              </div>

              <div
                style={{
                  background: "#0f172a",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p style={{ margin: "6px 0" }}>
                  <strong>Kode Referral:</strong> {userData.referralCode}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>Rekrut Masuk:</strong> {userData.jumlahRekrut || 0}
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
                >
                  Copy Link
                </button>
              </div>
            </div>

            <div style={panel}>
              <h3 style={sectionTitle}>Pembayaran Pendaftaran</h3>

              <div
                style={{
                  background: "#0f172a",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <img
                  src={PAYMENT_IMAGE}
                  alt="payment"
                  style={{ width: "100%", borderRadius: 12, marginBottom: 12 }}
                />

                <p style={{ margin: "6px 0" }}>
                  Paket: <strong>{userData.paket}</strong>
                </p>
                <p style={{ margin: "6px 0" }}>
                  Harga: <strong>{getPackagePrice(userData.paket)}</strong>
                </p>

                {userApproved && (
                  <p style={{ color: "#4ade80", fontWeight: 700 }}>
                    Pembayaran pendaftaran sudah dikonfirmasi admin.
                  </p>
                )}

                {canShowBayarDaftar && (
                  <button style={btnGold} onClick={handleSudahBayarDaftar}>
                    Saya sudah membayar
                  </button>
                )}

                {canShowKonfirmasiDaftar && (
                  <button style={btn} onClick={handleKonfirmasiDaftar}>
                    Konfirmasi Pembayaran
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
                <div
                  style={{
                    background: "#0f172a",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <p style={{ opacity: 0.9 }}>
                    Tombol update paket muncul setelah akun kamu dikonfirmasi
                    admin.
                  </p>
                </div>
              ) : (
                <>
                  {!hasPendingUpgrade && (
                    <div
                      style={{
                        background: "#0f172a",
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 12,
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <p style={{ marginTop: 0 }}>
                        Pilih update paket yang kamu inginkan.
                      </p>

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
                            Paket Premium 250k
                          </button>

                          <button
                            style={btnGold}
                            onClick={() => chooseUpgradePackage("Gold")}
                          >
                            Paket Gold 500k
                          </button>

                          <button
                            style={btnSecondary}
                            onClick={() => setShowUpgradeOptions(false)}
                          >
                            Batal
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {hasPendingUpgrade && (
                    <div
                      style={{
                        background: "#0f172a",
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 12,
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <img
                        src={PAYMENT_IMAGE}
                        alt="payment-upgrade"
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          marginBottom: 12,
                        }}
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
                          {getPackagePrice(userData.upgradePackage)}
                        </strong>
                      </p>

                      {canShowBayarUpdate && (
                        <button
                          style={btnGold}
                          onClick={handleSudahBayarUpdate}
                        >
                          Saya sudah membayar
                        </button>
                      )}

                      {canShowKonfirmasiUpdate && (
                        <button style={btn} onClick={handleKonfirmasiUpdate}>
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
          </div>
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
