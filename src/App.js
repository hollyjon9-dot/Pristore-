import { useState, useEffect } from "react";
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
  getDocs,
  collection,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "ISI_API_KEY_KAMU",
  authDomain: "ISI_AUTH_DOMAIN",
  projectId: "ISI_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [paket, setPaket] = useState("100k");
  const [ref, setRef] = useState("");
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [myData, setMyData] = useState(null);

  const isAdmin = user?.email === "emailkamu@gmail.com";

  const getKomisi = (paket) => {
    if (paket === "100k") return 40000;
    if (paket === "250k") return 70000;
    if (paket === "500k") return 200000;
    return 0;
  };

  const register = async () => {
    const res = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", res.user.uid), {
      name,
      email,
      paket,
      ref,
      status: "pending",
      komisi: 0,
      totalRef: 0,
    });

    alert("Daftar berhasil, tunggu admin approve");
  };

  const login = async () => {
    const res = await signInWithEmailAndPassword(auth, email, password);
    setUser(res.user);
    loadMyData(res.user.uid);
  };

  const loadMyData = async (uid) => {
    const snapshot = await getDocs(collection(db, "users"));
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    const me = data.find((u) => u.id === uid);
    const myRefs = data.filter((u) => u.ref === me?.name);

    let totalKomisi = 0;
    myRefs.forEach((r) => {
      totalKomisi += getKomisi(r.paket);
    });

    // bonus 10 orang
    if (myRefs.length >= 10) totalKomisi += 100000;

    setMyData({
      ...me,
      totalRef: myRefs.length,
      komisi: totalKomisi,
    });
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const loadUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setUsers(data);
  };

  const approveUser = async (id) => {
    await updateDoc(doc(db, "users", id), {
      status: "approved",
    });
    loadUsers();
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [user]);

  return (
    <div style={{
      background: "#0f172a",
      color: "white",
      minHeight: "100vh",
      padding: 20,
      fontFamily: "Arial"
    }}>
      {!user ? (
        <div style={{ maxWidth: 300, margin: "auto" }}>
          <h2>PRISTORE</h2>

          {mode === "login" ? (
            <>
              <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
              <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
              <button onClick={login}>Login</button>
              <p onClick={() => setMode("register")}>Daftar</p>
            </>
          ) : (
            <>
              <input placeholder="Nama" onChange={(e) => setName(e.target.value)} />
              <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
              <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />

              <select onChange={(e) => setPaket(e.target.value)}>
                <option>100k</option>
                <option>250k</option>
                <option>500k</option>
              </select>

              <input placeholder="Referral" onChange={(e) => setRef(e.target.value)} />

              <button onClick={register}>Daftar</button>
              <p onClick={() => setMode("login")}>Login</p>
            </>
          )}
        </div>
      ) : (
        <>
          {!isAdmin ? (
            <div style={{ maxWidth: 400, margin: "auto" }}>
              <h2>Dashboard</h2>

              {myData && (
                <div style={{ background: "#1e293b", padding: 20, borderRadius: 10 }}>
                  <p>Email: {myData.email}</p>
                  <p>Paket: {myData.paket}</p>
                  <p>Total Referral: {myData.totalRef}</p>
                  <p>Komisi: Rp {myData.komisi}</p>
                </div>
              )}

              <button onClick={() => alert("Konfirmasi pembayaran dikirim")}>
                Saya sudah bayar
              </button>

              <button onClick={logout}>Logout</button>
            </div>
          ) : (
            <>
              <h2>ADMIN PANEL</h2>

              {users.map((u) => (
                <div key={u.id} style={{ background: "#1e293b", margin: 10, padding: 10 }}>
                  <p>{u.name}</p>
                  <p>{u.email}</p>
                  <p>Paket: {u.paket}</p>
                  <p>Status: {u.status}</p>

                  {u.status === "pending" && (
                    <button onClick={() => approveUser(u.id)}>Approve</button>
                  )}
                </div>
              ))}

              <button onClick={logout}>Logout</button>
            </>
          )}
        </>
      )}
    </div>
  );
}
