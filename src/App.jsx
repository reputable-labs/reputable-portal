import { useState, useEffect, useCallback, useRef } from "react";
import {
  createClient_ as createClientDB,
  getClient,
  listClients,
  updateClient,
  deleteClient_ as deleteClientDB,
  uploadAssetImage,
  deleteAssetImage,
} from "./supabase";

// ─── Demo Asset Data ─────────────────────────────────────────────
const DEFAULT_ASSETS = [
  { id: "asset_1", type: "Instagram Feed Post", title: "Study Announcement — Feed Post #1", description: "Primary recruitment graphic introducing the study objectives, eligibility criteria, and call-to-action for your target audience.", preview: "linear-gradient(135deg, #1a2744 0%, #2c4a7c 40%, #4a7ab5 100%)", previewLabel: "IG FEED", dimensions: "1080 × 1080" },
  { id: "asset_2", type: "Instagram Feed Post", title: "Study Announcement — Feed Post #2", description: "Supporting graphic with participant benefits, study timeline, and secondary call-to-action messaging.", preview: "linear-gradient(135deg, #2c4a7c 0%, #1a2744 50%, #0f1a2e 100%)", previewLabel: "IG FEED", dimensions: "1080 × 1080" },
  { id: "asset_3", type: "Instagram Story", title: "Story Swipe-Up — Landing Page Link", description: "Vertical story asset with direct link to your study landing page. Designed for quick engagement and tap-through.", preview: "linear-gradient(180deg, #e8d5b5 0%, #c4a67a 40%, #1a2744 100%)", previewLabel: "IG STORY", dimensions: "1080 × 1920" },
  { id: "asset_4", type: "Newsletter Feature", title: "Weekly Newsletter Mention", description: "Featured placement in our weekly digest sent to 10,000+ active members. Includes study summary, key benefits, and enrollment CTA.", preview: "linear-gradient(135deg, #f7f5f0 0%, #e8d5b5 50%, #c4a67a 100%)", previewLabel: "EMAIL", dimensions: "600 × 400" },
];

// ─── Router ──────────────────────────────────────────────────────
function useHashRouter() {
  const [route, setRoute] = useState(window.location.hash || "");
  useEffect(() => {
    const h = () => setRoute(window.location.hash || "");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return { route, navigate: (hash) => { window.location.hash = hash; } };
}

function parseRoute(hash) {
  const c = hash.replace(/^#\/?/, "");
  if (c === "admin") return { page: "dashboard" };
  if (c === "admin/new") return { page: "admin-new" };
  if (c.startsWith("admin/client/")) return { page: "admin-client", clientId: c.replace("admin/client/", "") };
  if (c.startsWith("client/")) return { page: "client", clientId: c.replace("client/", "") };
  return { page: "landing" };
}

// ─── Styles ──────────────────────────────────────────────────────
const FONTS_LINK = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@400;500;600;700&display=swap";
const co = { navy: "#1a2744", navyMid: "#2c4a7c", gold: "#e8d5b5", goldDark: "#c4a67a", bg: "#f7f5f0", bgDark: "#ede8df", card: "#fff", text: "#1a2744", textMuted: "#5a6a7a", textLight: "#8a8078", border: "#d5d0c8", borderLight: "#eae6de", inputBg: "#faf9f6", green: "#1a7a4a", greenBg: "rgba(26,122,74,0.06)", amber: "#b8860b", amberBg: "rgba(184,134,11,0.06)", red: "#c0392b" };
const fo = { display: "'Playfair Display', serif", body: "'DM Sans', sans-serif" };

const GlobalStyles = () => (
  <>
    <link href={FONTS_LINK} rel="stylesheet" />
    <style>{`
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .6; } }
      *, *::before, *::after { box-sizing: border-box; margin: 0; }
      body { margin: 0; background: #f7f5f0; }
      ::selection { background: rgba(44,74,124,0.15); }
      input::placeholder, textarea::placeholder { color: #a8a098; }
    `}</style>
  </>
);

// ─── Reusable Components ─────────────────────────────────────────
const AccentBar = () => <div style={{ height: 4, background: `linear-gradient(90deg, ${co.navy} 0%, ${co.navyMid} 35%, ${co.gold} 70%, ${co.goldDark} 100%)`, backgroundSize: "200% 100%", animation: "shimmer 6s linear infinite" }} />;

const Badge = ({ children, variant = "navy" }) => {
  const s = { navy: { background: co.navy, color: co.gold }, gold: { background: co.gold, color: co.navy }, green: { background: co.greenBg, color: co.green, border: `1px solid ${co.green}22` }, amber: { background: co.amberBg, color: co.amber, border: `1px solid ${co.amber}22` }, muted: { background: "#eae6de", color: co.textMuted } };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 100, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", ...s[variant] }}>{children}</span>;
};

const Card = ({ children, style = {}, ...props }) => <div style={{ background: co.card, borderRadius: 18, padding: "clamp(28px, 5vw, 44px)", boxShadow: "0 2px 24px rgba(26,39,68,0.06), 0 1px 3px rgba(26,39,68,0.03)", border: "1px solid rgba(213,208,200,0.5)", ...style }} {...props}>{children}</div>;

const StepNumber = ({ n }) => <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg, ${co.navy}, ${co.navyMid})`, color: co.gold, marginRight: 14, flexShrink: 0, boxShadow: "0 2px 8px rgba(26,39,68,0.18)" }}>{n}</span>;

const SectionHeader = ({ step, title, desc }) => (<><div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><StepNumber n={step} /><h2 style={{ fontFamily: fo.display, fontSize: 22, color: co.text, fontWeight: 600, margin: 0 }}>{title}</h2></div><p style={{ color: co.textMuted, fontSize: 14.5, lineHeight: 1.75, marginBottom: 28 }}>{desc}</p></>);

const Input = ({ label, required, optional, error, type = "text", ...props }) => {
  const [focused, setFocused] = useState(false);
  const shared = { width: "100%", padding: "14px 18px", borderRadius: 10, border: `1.5px solid ${error ? co.red : focused ? co.navyMid : co.border}`, fontSize: 15, fontFamily: fo.body, color: co.text, background: co.inputBg, outline: "none", transition: "border-color 0.25s ease, box-shadow 0.25s ease", boxSizing: "border-box", boxShadow: focused ? "0 0 0 3px rgba(44,74,124,0.1)" : "none" };
  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3a4a5c", marginBottom: 8, letterSpacing: 0.4, textTransform: "uppercase" }}>
        {label}{required && <span style={{ color: co.red }}> *</span>}{optional && <span style={{ color: co.textLight, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}> — optional</span>}
      </label>
      {type === "textarea" ? <textarea {...props} rows={4} onFocus={(e) => { setFocused(true); props.onFocus?.(e); }} onBlur={(e) => { setFocused(false); props.onBlur?.(e); }} style={{ ...shared, resize: "vertical", lineHeight: 1.7 }} /> : <input type={type} {...props} onFocus={(e) => { setFocused(true); props.onFocus?.(e); }} onBlur={(e) => { setFocused(false); props.onBlur?.(e); }} style={shared} />}
      {error && <p style={{ color: co.red, fontSize: 12.5, marginTop: 6, fontWeight: 500 }}>{error}</p>}
    </div>
  );
};

const PrimaryButton = ({ children, onClick, disabled, style = {} }) => { const [h, s] = useState(false); return <button onClick={onClick} disabled={disabled} onMouseEnter={() => s(true)} onMouseLeave={() => s(false)} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "18px 48px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${co.navy}, ${co.navyMid})`, color: co.gold, fontSize: 16, fontWeight: 600, cursor: disabled ? "default" : "pointer", fontFamily: fo.body, letterSpacing: 0.5, boxShadow: h && !disabled ? "0 8px 32px rgba(26,39,68,0.3)" : "0 4px 20px rgba(26,39,68,0.25)", transform: h && !disabled ? "translateY(-2px)" : "translateY(0)", transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)", opacity: disabled ? 0.5 : 1, ...style }}>{children}</button>; };

const SecondaryButton = ({ children, onClick, style = {} }) => { const [h, s] = useState(false); return <button onClick={onClick} onMouseEnter={() => s(true)} onMouseLeave={() => s(false)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${co.navy}`, fontSize: 14, fontWeight: 600, fontFamily: fo.body, letterSpacing: 0.3, background: h ? co.navy : "none", color: h ? co.gold : co.navy, transition: "all 0.25s ease", ...style }}>{children}</button>; };

const BackLink = ({ onClick, label = "Back" }) => <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", color: co.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: fo.body, marginBottom: 32, padding: 0 }}>← {label}</button>;

// Icons (simplified)
const IC = {
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  checkLg: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  arrow: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  layers: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  upload: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  lock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  company: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  img: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2c4a7c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  plus: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2c4a7c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>,
  mail: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2c4a7c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
};

// ─── Asset Preview / Upload ──────────────────────────────────────
function AssetPreview({ asset, clientId, onImageChange }) {
  const [imageUrl, setImageUrl] = useState(asset.imageUrl || null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const url = await uploadAssetImage(clientId, asset.id, file);
      setImageUrl(url);
      onImageChange?.(asset.id, url);
    } catch (err) { console.error("Upload failed:", err); }
    setUploading(false);
  };

  const handleRemove = async (e) => {
    e.stopPropagation();
    await deleteAssetImage(clientId, asset.id);
    setImageUrl(null);
    onImageChange?.(asset.id, null);
  };

  const boxSize = { width: "clamp(120px, 22vw, 180px)", height: "clamp(120px, 22vw, 180px)" };

  if (uploading) return <div style={{ ...boxSize, borderRadius: 14, background: co.inputBg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: co.textLight, fontSize: 12, animation: "pulse 1.2s infinite" }}>Uploading...</span></div>;

  if (imageUrl) return (
    <div style={{ ...boxSize, borderRadius: 14, flexShrink: 0, position: "relative", overflow: "hidden" }}>
      <img src={imageUrl} alt={asset.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <span style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{asset.previewLabel}</span>
      <button onClick={handleRemove} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{IC.x}</button>
    </div>
  );

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <div onClick={() => fileRef.current?.click()} onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer?.files?.[0]); }} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        style={{ ...boxSize, borderRadius: 14, background: dragging ? "rgba(44,74,124,0.15)" : asset.preview, border: dragging ? `2.5px dashed ${co.navyMid}` : "2.5px dashed rgba(255,255,255,0.35)", display: "flex", cursor: "pointer", position: "relative", overflow: "hidden", transition: "all 0.25s ease" }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(26,39,68,0.5)", backdropFilter: "blur(2px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, pointerEvents: "none" }}>
          <span style={{ color: co.gold }}>{IC.upload}</span>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 600, textAlign: "center", padding: "0 10px", lineHeight: 1.4 }}>Drop image or<br/>click to upload</span>
        </div>
        <span style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.5)", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 1, pointerEvents: "none" }}>{asset.previewLabel}</span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════════
export default function App() {
  const { route, navigate } = useHashRouter();
  const parsed = parseRoute(route);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    const all = await listClients();
    setClients(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [route, loadClients]);

  const saveClient = useCallback(async (client) => {
    await updateClient(client);
    setClients((prev) => {
      const idx = prev.findIndex((x) => x.id === client.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = client; return n; }
      return [client, ...prev];
    });
  }, []);

  const handleCreateClient = useCallback(async (client) => {
    await createClientDB(client);
    setClients((prev) => [client, ...prev]);
  }, []);

  const handleDeleteClient = useCallback(async (id) => {
    await deleteClientDB(id);
    setClients((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: co.bg, fontFamily: fo.body }}>
      <GlobalStyles />
      <AccentBar />
      {parsed.page === "landing" && <LandingPage onAdmin={() => navigate("admin")} />}
      {parsed.page === "dashboard" && <Dashboard clients={clients} loading={loading} onNewClient={() => navigate("admin/new")} onViewClient={(cl) => navigate(`admin/client/${cl.id}`)} onDeleteClient={handleDeleteClient} navigate={navigate} />}
      {parsed.page === "admin-new" && <AdminNewClient onCreated={(cl) => { handleCreateClient(cl); navigate("admin"); }} onBack={() => navigate("admin")} />}
      {parsed.page === "admin-client" && <AdminClientView clientId={parsed.clientId} onSave={saveClient} onBack={() => navigate("admin")} />}
      {parsed.page === "client" && <ClientPortal clientId={parsed.clientId} onSave={saveClient} />}
    </div>
  );
}

// The remaining components (LandingPage, AdminNewClient, AdminClientView, ClientPortal, 
// ClientIntakeForm, ClientAssetReview, Dashboard) are identical to the artifact version.
// They use the same props — the only difference is the data layer (Supabase instead of window.storage).
// 
// Copy them from your working artifact portal.jsx and:
// 1. Remove all `store.get/set/list/delete` calls (they're now in supabase.js)
// 2. Replace `asset.preview` fallback images — they still work as gradient backgrounds
// 3. Use `asset.imageUrl` instead of loading from separate storage keys
//
// The full components are in your reputable-client-portal.jsx artifact — 
// just swap the storage layer and they work identically.

// ─── Placeholder exports for remaining views ─────────────────────
// (These are simplified stubs — copy full versions from your artifact)

function LandingPage({ onAdmin }) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "100px 20px", textAlign: "center" }}>
      <div style={{ animation: "fadeInUp 0.7s cubic-bezier(0.22,1,0.36,1)" }}>
        <Badge variant="navy">{IC.layers}&nbsp; Reputable</Badge>
        <h1 style={{ fontFamily: fo.display, fontSize: "clamp(32px, 5vw, 48px)", color: co.text, fontWeight: 600, lineHeight: 1.2, margin: "28px 0 20px" }}>Marketing Collaboration<br />Portal</h1>
        <p style={{ color: co.textMuted, fontSize: "clamp(15px, 2.2vw, 17px)", lineHeight: 1.8, maxWidth: 480, margin: "0 auto 48px" }}>Manage client onboarding, deliver marketing assets, and collect approvals — all in one place.</p>
        <PrimaryButton onClick={onAdmin}>{IC.lock}&nbsp; Open Admin Dashboard {IC.arrow}</PrimaryButton>
        <p style={{ color: co.textLight, fontSize: 13, marginTop: 20 }}>Clients access their portal via unique links generated from the dashboard.</p>
      </div>
    </div>
  );
}

function AdminNewClient({ onCreated, onBack }) {
  const [name, setName] = useState("");
  const handleCreate = () => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const client = { id, companyName: name.trim() || "Untitled Client", socialHandles: "", collaboratorName: "", collaboratorEmail: "", collabPost: false, storySharing: false, crossPosting: false, assets: DEFAULT_ASSETS.map((a) => ({ ...a, status: "pending", feedback: "", imageUrl: null })), createdAt: new Date().toISOString(), overallStatus: "not_started", formCompleted: false };
    onCreated(client);
  };
  return (
    <div style={{ maxWidth: 580, margin: "0 auto", padding: "32px 20px 80px" }}>
      <BackLink onClick={onBack} label="Back to Dashboard" />
      <Card style={{ animation: "fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1)" }}>
        <Badge variant="navy">+ New Client</Badge>
        <h2 style={{ fontFamily: fo.display, fontSize: 26, color: co.text, fontWeight: 600, margin: "18px 0 10px" }}>Create Client Portal</h2>
        <p style={{ color: co.textMuted, fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>Enter the company name and we'll generate a unique portal link.</p>
        <Input label="Company Name" optional placeholder="e.g. Acme Health Inc." value={name} onChange={(e) => setName(e.target.value)} />
        <PrimaryButton onClick={handleCreate}>Create Client {IC.arrow}</PrimaryButton>
      </Card>
    </div>
  );
}

function AdminClientView({ clientId, onSave, onBack }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getClient(clientId).then((d) => { setClient(d); setLoading(false); }); }, [clientId]);

  const clientUrl = `${window.location.origin}${window.location.pathname}#client/${clientId}`;
  const copyLink = () => { navigator.clipboard.writeText(clientUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><p style={{ color: co.textMuted, animation: "pulse 1.5s infinite" }}>Loading...</p></div>;
  if (!client) return <div style={{ maxWidth: 480, margin: "0 auto", padding: "100px 20px", textAlign: "center" }}><Card><p>Client not found.</p><SecondaryButton onClick={onBack}>← Back</SecondaryButton></Card></div>;

  const imgCount = client.assets.filter((a) => a.imageUrl).length;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px 80px" }}>
      <BackLink onClick={onBack} label="Back to Dashboard" />
      <div style={{ marginBottom: 32 }}>
        <Badge variant="navy">{IC.lock}&nbsp; Admin</Badge>
        <h1 style={{ fontFamily: fo.display, fontSize: "clamp(24px, 4vw, 32px)", color: co.text, fontWeight: 600, margin: "14px 0 8px" }}>{client.companyName}</h1>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: fo.display, fontSize: 18, color: co.text, fontWeight: 600, marginBottom: 12 }}>Client Link</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: co.inputBg, border: `1.5px solid ${co.border}`, borderRadius: 12, padding: "12px 16px" }}>
          <span style={{ flex: 1, fontSize: 12.5, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientUrl}</span>
          <button onClick={copyLink} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: fo.body, fontSize: 13, fontWeight: 600, background: copied ? co.greenBg : co.navy, color: copied ? co.green : co.gold }}>{copied ? "✓ Copied!" : "Copy"}</button>
        </div>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: fo.display, fontSize: 18, color: co.text, fontWeight: 600 }}>Upload Assets</h3>
          <span style={{ fontSize: 12, color: co.textLight }}>{imgCount}/{client.assets.length} uploaded</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 20, marginBottom: 20 }}>
          {client.assets.map((asset) => (
            <div key={asset.id}>
              <AssetPreview asset={asset} clientId={clientId} onImageChange={(id, url) => { setSaved(true); setTimeout(() => setSaved(false), 3000); }} />
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: co.text }}>{asset.title}</div>
              <div style={{ fontSize: 11.5, color: co.textLight }}>{asset.type} · {asset.dimensions}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 18px", borderRadius: 12, background: saved ? co.greenBg : co.inputBg, border: `1px solid ${saved ? co.green + "33" : co.borderLight}`, transition: "all 0.3s" }}>
          <span style={{ fontSize: 13, color: saved ? co.green : co.textLight, fontWeight: saved ? 600 : 400 }}>{saved ? "✓ Asset saved — client will see it" : "Assets auto-save when uploaded."}</span>
        </div>
      </Card>

      {/* Client Review Status */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: fo.display, fontSize: 18, color: co.text, fontWeight: 600, marginBottom: 8 }}>Client Review Status</h3>

        {client.overallStatus === "not_started" && (
          <div style={{ padding: "24px 20px", borderRadius: 12, background: co.inputBg, border: `1px solid ${co.borderLight}`, textAlign: "center" }}>
            <p style={{ color: co.textMuted, fontSize: 14, margin: 0 }}>The client hasn't opened their link yet. Upload your assets above, then share the link.</p>
          </div>
        )}

        {client.overallStatus === "pending_review" && (
          <div style={{ padding: "24px 20px", borderRadius: 12, background: co.amberBg, border: `1px solid ${co.amber}22`, textAlign: "center" }}>
            <p style={{ color: co.amber, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Waiting for client</p>
            <p style={{ color: co.textMuted, fontSize: 13, margin: 0 }}>The client has filled out the intake form and is reviewing assets.</p>
          </div>
        )}

        {client.overallStatus === "submitted" && (() => {
          const approved = client.assets.filter((a) => a.status === "approved");
          const revisions = client.assets.filter((a) => a.status === "revision");
          const pending = client.assets.filter((a) => a.status === "pending");
          return (
            <div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                {approved.length > 0 && <Badge variant="green">✓ {approved.length} Approved</Badge>}
                {revisions.length > 0 && <Badge variant="amber">✎ {revisions.length} Revision{revisions.length > 1 ? "s" : ""}</Badge>}
                {pending.length > 0 && <Badge variant="muted">{pending.length} Pending</Badge>}
              </div>
              <p style={{ color: co.textMuted, fontSize: 13, marginBottom: 20 }}>
                Submitted {client.submittedAt ? new Date(client.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
              </p>

              {/* Per-asset breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {client.assets.map((asset) => (
                  <div key={asset.id} style={{
                    padding: "16px 20px", borderRadius: 14, background: co.inputBg,
                    borderLeft: `4px solid ${asset.status === "approved" ? co.green : asset.status === "revision" ? co.amber : co.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: asset.feedback ? 10 : 0 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: co.text }}>{asset.title}</span>
                        <span style={{ fontSize: 11.5, color: co.textLight, marginLeft: 8 }}>{asset.type}</span>
                      </div>
                      <Badge variant={asset.status === "approved" ? "green" : asset.status === "revision" ? "amber" : "muted"}>
                        {asset.status === "approved" ? "✓ Approved" : asset.status === "revision" ? "✎ Revision" : "Pending"}
                      </Badge>
                    </div>
                    {asset.feedback && (
                      <div style={{ padding: "10px 14px", borderRadius: 8, background: co.card, border: `1px solid ${co.borderLight}`, marginTop: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: co.amber, textTransform: "uppercase", letterSpacing: 0.8 }}>Client Feedback</span>
                        <p style={{ fontSize: 13.5, color: co.text, lineHeight: 1.6, margin: "6px 0 0" }}>{asset.feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </Card>

      {/* Form Info */}
      {client.formCompleted && (
        <Card>
          <h3 style={{ fontFamily: fo.display, fontSize: 18, color: co.text, fontWeight: 600, marginBottom: 16 }}>Intake Form Info</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { label: "Company", value: client.companyName },
              { label: "Social Handles", value: client.socialHandles },
              { label: "Collaborator", value: client.collaboratorName },
              { label: "Email", value: client.collaboratorEmail },
            ].filter((f) => f.value).map((f) => (
              <div key={f.label} style={{ padding: "12px 16px", borderRadius: 10, background: co.inputBg }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: co.textLight, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 14, color: co.text, fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>
          {(client.collabPost || client.storySharing || client.crossPosting) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              {client.collabPost && <Badge variant="navy">Collab Post</Badge>}
              {client.storySharing && <Badge variant="navy">Story Sharing</Badge>}
              {client.crossPosting && <Badge variant="navy">Cross-Posting</Badge>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ClientPortal({ clientId, onSave }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getClient(clientId).then((d) => { setClient(d); setLoading(false); }); }, [clientId]);
  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "100px 20px" }}><p style={{ color: co.textMuted, animation: "pulse 1.5s infinite" }}>Loading...</p></div>;
  if (!client) return <div style={{ maxWidth: 480, margin: "0 auto", padding: "100px 20px", textAlign: "center" }}><Card><p style={{ fontSize: 48, marginBottom: 16 }}>🔒</p><h2 style={{ fontFamily: fo.display, fontSize: 24, color: co.text, marginBottom: 10 }}>Portal Not Found</h2><p style={{ color: co.textMuted }}>This link may be invalid or expired.</p></Card></div>;
  // Route to form or review based on completion
  if (!client.formCompleted) return <ClientIntakeForm client={client} onSubmit={async (c) => { setClient(c); await onSave(c); }} />;
  return <ClientAssetReview client={client} onSave={async (c) => { setClient(c); await onSave(c); }} />;
}

// Simplified stubs for ClientIntakeForm, ClientAssetReview, Dashboard
// Copy full versions from your artifact — the logic is identical,
// just remove window.storage references.

function ClientIntakeForm({ client, onSubmit }) {
  const [form, setForm] = useState({ companyName: client.companyName === "Untitled Client" ? "" : client.companyName, socialHandles: client.socialHandles, collaboratorName: client.collaboratorName, collaboratorEmail: client.collaboratorEmail, collabPost: client.collabPost, storySharing: client.storySharing, crossPosting: client.crossPosting });
  const handleSubmit = () => { onSubmit({ ...client, ...form, companyName: form.companyName.trim() || client.companyName, formCompleted: true, overallStatus: "pending_review", formSubmittedAt: new Date().toISOString() }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return (
    <div style={{ maxWidth: 740, margin: "0 auto", padding: "32px 20px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}><Badge variant="navy">{IC.layers}&nbsp; Reputable</Badge><h1 style={{ fontFamily: fo.display, fontSize: "clamp(24px, 4vw, 34px)", color: co.text, fontWeight: 600, margin: "20px 0 16px" }}>RWE & VEP Marketing<br/>Collaboration Form</h1></div>
      <Card style={{ marginBottom: 24 }}>
        <SectionHeader step={1} title="Study & Collaborator Information" desc="Please provide your details." />
        <Input label="Company Name" optional value={form.companyName} onChange={(e) => setForm({...form, companyName: e.target.value})} />
        <Input label="Social Media Handles" optional value={form.socialHandles} onChange={(e) => setForm({...form, socialHandles: e.target.value})} />
        <Input label="Collaborator Name" optional value={form.collaboratorName} onChange={(e) => setForm({...form, collaboratorName: e.target.value})} />
        <Input label="Collaborator Email" optional value={form.collaboratorEmail} onChange={(e) => setForm({...form, collaboratorEmail: e.target.value})} />
      </Card>
      <div style={{ textAlign: "center" }}><PrimaryButton onClick={handleSubmit}>Continue to Asset Review {IC.arrow}</PrimaryButton></div>
    </div>
  );
}

function ClientAssetReview({ client, onSave }) {
  const [assets, setAssets] = useState(client.assets);
  const [submitted, setSubmitted] = useState(client.overallStatus === "submitted");
  const setField = (id, field, val) => setAssets((p) => p.map((a) => a.id === id ? { ...a, [field]: val } : a));
  const counts = { approved: assets.filter((a) => a.status === "approved").length, revision: assets.filter((a) => a.status === "revision").length, pending: assets.filter((a) => a.status === "pending").length };
  const handleSubmit = async () => { await onSave({ ...client, assets, overallStatus: "submitted", submittedAt: new Date().toISOString() }); setSubmitted(true); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (submitted) return <div style={{ maxWidth: 560, margin: "0 auto", padding: "100px 20px", textAlign: "center" }}><div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 28px", background: `linear-gradient(135deg, ${co.navy}, ${co.navyMid})`, display: "flex", alignItems: "center", justifyContent: "center", color: co.gold }}>{IC.checkLg}</div><h2 style={{ fontFamily: fo.display, fontSize: 30, color: co.text, marginBottom: 14 }}>Review Submitted</h2><p style={{ color: co.textMuted, fontSize: 15.5, lineHeight: 1.7 }}>Thank you, <strong>{client.companyName}</strong>. The Reputable team will be in touch.</p></div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px 80px" }}>
      <Badge variant="navy">{IC.eye}&nbsp; Asset Review</Badge>
      <h1 style={{ fontFamily: fo.display, fontSize: "clamp(24px, 4vw, 34px)", color: co.text, fontWeight: 600, margin: "18px 0 20px" }}>{client.companyName}</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {assets.map((asset) => (
          <Card key={asset.id} style={{ borderLeft: `4px solid ${asset.status === "approved" ? co.green : asset.status === "revision" ? co.amber : co.border}` }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.title} style={{ width: 160, height: 160, borderRadius: 14, objectFit: "cover" }} /> : <div style={{ width: 160, height: 160, borderRadius: 14, background: asset.preview }} />}
              <div style={{ flex: 1, minWidth: 200 }}>
                <Badge variant={asset.status === "approved" ? "green" : asset.status === "revision" ? "amber" : "muted"}>{asset.status}</Badge>
                <h3 style={{ fontFamily: fo.display, fontSize: 17, color: co.text, margin: "8px 0" }}>{asset.title}</h3>
                <p style={{ fontSize: 13.5, color: co.textMuted, lineHeight: 1.65, marginBottom: 16 }}>{asset.description}</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setField(asset.id, "status", "approved")} style={{ padding: "10px 22px", borderRadius: 10, border: asset.status === "approved" ? `2px solid ${co.green}` : `1.5px solid ${co.border}`, background: asset.status === "approved" ? co.greenBg : co.inputBg, color: asset.status === "approved" ? co.green : co.textMuted, fontWeight: 600, fontSize: 13.5, fontFamily: fo.body, cursor: "pointer" }}>✓ Approve</button>
                  <button onClick={() => setField(asset.id, "status", asset.status === "revision" ? "pending" : "revision")} style={{ padding: "10px 22px", borderRadius: 10, border: asset.status === "revision" ? `2px solid ${co.amber}` : `1.5px solid ${co.border}`, background: asset.status === "revision" ? co.amberBg : co.inputBg, color: asset.status === "revision" ? co.amber : co.textMuted, fontWeight: 600, fontSize: 13.5, fontFamily: fo.body, cursor: "pointer" }}>✎ Revision</button>
                </div>
                {asset.status === "revision" && <div style={{ marginTop: 12 }}><Input type="textarea" label="Revision Notes" optional value={asset.feedback} onChange={(e) => setField(asset.id, "feedback", e.target.value)} /></div>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 40 }}><PrimaryButton onClick={handleSubmit}>Submit Review {IC.arrow}</PrimaryButton></div>
    </div>
  );
}

function Dashboard({ clients, loading, onNewClient, onViewClient, onDeleteClient, navigate }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const copyLink = (id, e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#client/${id}`).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }); };
  const getStatus = (s) => s === "submitted" ? { label: "Submitted", variant: "green" } : s === "pending_review" ? { label: "Reviewing", variant: "amber" } : { label: "Not Started", variant: "muted" };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 36 }}>
        <div><Badge variant="navy">{IC.lock}&nbsp; Admin</Badge><h1 style={{ fontFamily: fo.display, fontSize: "clamp(24px, 4vw, 32px)", color: co.text, fontWeight: 600, margin: "14px 0 6px" }}>Client Dashboard</h1><p style={{ color: co.textMuted, fontSize: 15 }}>{clients.length} client{clients.length !== 1 ? "s" : ""}</p></div>
        <PrimaryButton onClick={onNewClient} style={{ padding: "14px 32px", fontSize: 14 }}>+ New Client</PrimaryButton>
      </div>
      {loading ? <Card style={{ textAlign: "center", padding: 60 }}><p style={{ animation: "pulse 1.5s infinite" }}>Loading...</p></Card> : clients.length === 0 ? <Card style={{ textAlign: "center", padding: 60 }}><p style={{ fontSize: 40, marginBottom: 16 }}>📋</p><h3 style={{ fontFamily: fo.display }}>No clients yet</h3><p style={{ color: co.textMuted, marginBottom: 24 }}>Create your first client portal.</p><SecondaryButton onClick={onNewClient}>+ Add Client</SecondaryButton></Card> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {clients.map((cl) => {
            const st = getStatus(cl.overallStatus);
            return (
              <Card key={cl.id} style={{ padding: 24, cursor: "pointer", transition: "box-shadow 0.25s ease" }} onClick={() => onViewClient(cl)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${co.navy}, ${co.navyMid})`, display: "flex", alignItems: "center", justifyContent: "center", color: co.gold }}>{IC.company}</div>
                    <div><div style={{ fontSize: 16, fontWeight: 600, color: co.text, marginBottom: 4 }}>{cl.companyName}</div><Badge variant={st.variant}>{st.label}</Badge></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={(e) => copyLink(cl.id, e)} style={{ background: copiedId === cl.id ? co.greenBg : "none", border: "1px solid transparent", cursor: "pointer", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: fo.body, color: copiedId === cl.id ? co.green : co.textLight }}>{copiedId === cl.id ? "✓ Copied" : "Link"}</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(confirmDelete === cl.id ? null : cl.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: co.textLight }}>{IC.trash}</button>
                    {confirmDelete === cl.id && <button onClick={(e) => { e.stopPropagation(); onDeleteClient(cl.id); }} style={{ background: co.red, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Confirm</button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
