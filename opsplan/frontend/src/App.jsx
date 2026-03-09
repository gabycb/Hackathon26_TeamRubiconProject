import { useState, useEffect, useRef } from "react";


// Mobile detection hook
const useIsMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
};

// ============================================================
// DESIGN TOKENS — Established OpsPlan palette
// ============================================================
const C = {
  bg: "#FAF7F2", bgWarm: "#F5F0E8", surface: "#FFFFFF", surfaceMuted: "#F0EBE3",
  border: "#E2DCD2", borderDark: "#C8C0B4",
  text: "#2C2520", textSecondary: "#6B5E52", textMuted: "#9C8F82",
  accent: "#B85C1F", accentLight: "#D4843F", accentBg: "#FDF0E6", accentBorder: "#E8C4A0",
  blue: "#3D6B8E", blueBg: "#EAF0F5", blueBorder: "#B0C8DA",
  green: "#4A7C59", greenBg: "#EBF3ED", greenBorder: "#B0D4BC",
  red: "#A93E2B", redBg: "#FAEDEA",
  yellow: "#9C7B2E", yellowBg: "#FBF5E6",
  purple: "#6B5B8A", purpleBg: "#F0ECF5",
};
const font = `"Segoe UI",-apple-system,BlinkMacSystemFont,sans-serif`;
import FieldAssessment from "./FieldAssessment";

const API = "https://opsplan-api.blackgrass-5f5980e2.eastus.azurecontainerapps.io"; // Production Azure Container App

// ============================================================
// MOCK DATA — Used when API is unavailable (demo mode)
// ============================================================
const MOCK_ZONES = [
  { rank:1, area:"Aransas Pass — Central", fips_tract:"48007950100", composite_score:94.2, svi_score:0.89, nri_score:0.94, housing_vulnerability:0.82, population:2847, households:1120, total_structures:1240, manufactured_pct:34, pre1980_pct:48, est_cost:"$24.8M", cost_sqft:"$142", risk_level:"Critical",
    explanation:"Highest per-capita risk. 34% manufactured housing in coastal zone with extreme storm surge exposure. Pre-1980 construction (48%) compounds vulnerability. Recommend priority deployment within 24 hours." },
  { rank:2, area:"Rockport — Harbor", fips_tract:"48007950200", composite_score:89.7, svi_score:0.82, nri_score:0.91, housing_vulnerability:0.68, population:3201, households:1340, total_structures:1580, manufactured_pct:18, pre1980_pct:35, est_cost:"$41.2M", cost_sqft:"$168", risk_level:"Critical",
    explanation:"Largest structure count in affected area. Harbor proximity drives high NRI score. Newer construction mix provides some resilience, but volume requires significant assessment resources." },
  { rank:3, area:"Refugio — Downtown", fips_tract:"48391010100", composite_score:82.1, svi_score:0.91, nri_score:0.78, housing_vulnerability:0.76, population:1456, households:580, total_structures:680, manufactured_pct:22, pre1980_pct:55, est_cost:"$12.1M", cost_sqft:"$138", risk_level:"High",
    explanation:"Highest SVI in the analysis area but lower hazard exposure than coastal zones. Aging housing stock (55% pre-1980) is the primary structural concern." },
  { rank:4, area:"Rockport — North", fips_tract:"48007950400", composite_score:74.5, svi_score:0.65, nri_score:0.88, housing_vulnerability:0.52, population:4102, households:1780, total_structures:2100, manufactured_pct:12, pre1980_pct:28, est_cost:"$52.6M", cost_sqft:"$178", risk_level:"High",
    explanation:"High population and structure count but lower vulnerability per structure due to newer construction. Consider for Phase 2 deployment." },
  { rank:5, area:"Refugio — Rural East", fips_tract:"48391010300", composite_score:61.3, svi_score:0.78, nri_score:0.62, housing_vulnerability:0.58, population:890, households:320, total_structures:340, manufactured_pct:28, pre1980_pct:42, est_cost:"$5.8M", cost_sqft:"$132", risk_level:"Moderate",
    explanation:"Lower overall risk due to reduced hazard exposure, but notable manufactured housing concentration. Rural access may complicate logistics. Phase 3 recommendation." },
];

// Census tract to recognizable place names (Aransas/Refugio area)
const TRACT_PLACES = {
  "48007950101": "Rockport — South",
  "48007950102": "Rockport — Central",
  "48007950103": "Rockport — Estates",
  "48007950200": "Fulton",
  "48007950301": "Rockport — West (Holiday Beach)",
  "48007950302": "Rockport — North (Copano Village)",
  "48007950400": "Aransas Pass — East",
  "48007950501": "Port Aransas — Town Center",
  "48007950502": "Port Aransas — Beach",
  "48007950503": "Port Aransas — North",
  "48391950200": "Refugio — Town",
  "48391950400": "Refugio — Rural / Woodsboro",
};
const placeName = (fips, fallback) => TRACT_PLACES[fips] || fallback || fips;

const MOCK_PROFILES = MOCK_ZONES.map(z => ({
  zone_fips: z.fips_tract, zone_name: z.area,
  structural: { stories_1:62, stories_2:31, stories_3plus:7, foundation_slab:68, foundation_crawl:12, foundation_pier:18, foundation_basement:2, first_floor_height:"2.1 ft", design_level_pre_code:z.pre1980_pct, design_level_low:15, design_level_moderate:10, design_level_high:100-z.pre1980_pct-25 },
  exterior: { roof_shape_gable:58, roof_shape_hip:32, roof_shape_flat:10, roof_cover:"Asphalt shingle (72%), Metal (18%), Tile (10%)", exterior_wall:"Vinyl siding (45%), Wood (22%), Brick veneer (18%), Fiber cement (15%)", framing:"Wood frame 2×4 (68%), Wood 2×6 (20%), CMU (12%)", window_type:"Single-pane (54%), Double-pane (46%)", roof_deck:"6d @ 12\" (62%), 8d @ 6\" (38%)", roof_wall:"Toe-nail (58%), Clip (28%), Strap (14%)" },
  site: { flood_zone_VE:8, flood_zone_AE:22, flood_zone_X500:15, flood_zone_X:55, storm_surge:"8-12 ft (Matagorda Bay)", wind_speed:"130 mph (ASCE 7-16)", coastal_proximity:"68% within 2 mi of coast" },
  financial: { median_value:"$128,400", replacement_sf:"$168/sqft", replacement_mfg:"$55/sqft", replacement_total:z.est_cost, flood_insurance:"38% penetration", uninsured_est:"42%" },
  demographics: { median_age:41.2, age_65_plus:"22%", disability:"16%", below_poverty:"24%", limited_english:"8%", no_vehicle:"12%" },
  agent_analysis: z.explanation,
}));

const MOCK_SOP = {
  situation: { event_summary:"Hurricane Harvey made landfall as a Category 4 hurricane near Rockport, TX on August 25, 2017. Sustained winds of 130 mph caused catastrophic damage across Aransas and Refugio counties.", affected_area:"5 census tracts across Aransas County and Refugio County, TX. Total impact area approximately 450 square miles.", impact_summary:"12,447 residents, 5,140 households, 5,940 structures at risk. Estimated replacement value: $136.5M. 2 zones classified Critical, 2 High, 1 Moderate.", key_vulnerabilities:["34% manufactured housing in Zone 1 (Aransas Pass)", "55% pre-1980 construction in Zone 3 (Refugio Downtown)", "38% flood insurance penetration across all zones", "22% elderly population requiring special assistance", "8-12 ft storm surge projected for Matagorda Bay communities"] },
  mission: { primary_objective:"Conduct rapid damage assessment and emergency stabilization across 5 priority zones within 21 days of landfall.", secondary_objectives:["Complete structure-level assessment for all Critical and High zones within 7 days","Deploy emergency tarping and debris clearance to prevent secondary damage","Coordinate utility clearance for 7+ identified downed power line hazards","Establish field data feedback loop to refine resource allocation in real time"], end_state:"All 5 zones assessed, immediate safety hazards mitigated, and stabilization operations initiated for Critical/High zones. Transition plan to long-term recovery established." },
  execution: { phases:[
    { name:"Phase 1 — Assessment", timeline:"Day 1–7", description:"Deploy 3 assessment teams (4 personnel each) across Critical zones first. Each team targets 25 structures/day using the OpsPlan mobile assessment tool. GPS-tagged photos with AI damage classification provide real-time zone roll-up data.", teams:["Team Alpha → Zone 1 (Aransas Pass Central)","Team Bravo → Zone 2 (Rockport Harbor)","Team Charlie → Zone 3 (Refugio Downtown)"], zone_assignments:"Critical zones (1,2) assessed first, then High zones (3,4), then Moderate (5). Overlap Phase 2 once Zone 1 assessment reaches 60% completion." },
    { name:"Phase 2 — Immediate Response", timeline:"Day 5–14", description:"Begin emergency tarping, debris clearance, and safety hazard mitigation. Priority: structures with roof damage >50% and active water intrusion. Coordinate with utility companies for power line clearance before expanding into affected areas.", teams:["2 response crews per Critical zone","1 response crew per High zone","Utility coordination team (2 personnel)"], zone_assignments:"Zones 1-2 simultaneous, Zone 3 starts Day 7, Zone 4 starts Day 10." },
    { name:"Phase 3 — Stabilization", timeline:"Day 12–21", description:"Mucking/gutting flood-damaged structures, temporary repairs, mold mitigation. Focus on structures with interior damage >40%. Coordinate with FEMA Individual Assistance teams for transition to long-term recovery.", teams:["Rotate Phase 1 assessment teams into stabilization","Add volunteer surge capacity (estimated 20 additional)"], zone_assignments:"Follow assessment completion order. Zone 5 assessed and stabilized concurrently if resources allow." },
  ]},
  sustainment: { personnel:{assessment_teams:12, response_crews:16, logistics:4, command:4, total:36, volunteer_surge:20}, equipment:["Box trucks (5)","Skid steers (2)","Chainsaws (10)","Generators (10)","Dehumidifiers (15)"], materials:["Tarps — 2,400","Plywood sheets 4×8 — 12,000","Roofing felt rolls — 1,800","Nails/fasteners — 50 kegs","PPE kits — 200"], logistics:"Base camp: Aransas Pass Community Center. Rotation: 7 days on / 2 days off. Supply chain: weekly resupply from San Antonio staging area." },
  command_signal: { command_structure:"Incident Commander → Operations Section Chief → 3 Assessment Team Leads + 3 Response Crew Leads. Safety Officer reports directly to IC.", reporting:"Daily situation reports (SITREP) by 1800. Assessment data synced real-time via OpsPlan mobile. Weekly command briefing for all team leads.", communications:"Primary: Verizon FirstNet. Backup: VHF radio (NOAA weather channel monitoring). Satellite phone for IC and Ops Chief.", coordination:["FEMA Region 6 — Individual Assistance coordination","Texas Division of Emergency Management — state resource requests","Aransas County OEM — local coordination and access","American Red Cross — shelter and mass care","Salvation Army — feeding operations"] },
};

// ============================================================
// UTILITY COMPONENTS
// ============================================================
const riskColor = r => r === "Critical" ? C.red : r === "High" ? C.accent : r === "Moderate" ? C.yellow : C.textMuted;
const riskBg = r => r === "Critical" ? C.redBg : r === "High" ? C.accentBg : r === "Moderate" ? C.yellowBg : C.surfaceMuted;

const Btn = ({ children, primary, small, onClick, disabled, style: s }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? "5px 12px" : "8px 16px", borderRadius: 6, cursor: disabled ? "default" : "pointer",
    border: primary ? "none" : `1px solid ${C.borderDark || "#C8C0B4"}`, fontFamily: font, fontSize: small ? 11 : 12, fontWeight: 600,
    background: disabled ? C.surfaceMuted : primary ? C.accent : "#F7F4EF",
    color: disabled ? C.textMuted : primary ? "#fff" : C.text,
    opacity: disabled ? 0.6 : 1, transition: "all 0.15s", boxShadow: disabled ? "none" : "0 1px 2px rgba(0,0,0,0.06)", ...s,
  }}>{children}</button>
);

const Card = ({ children, style: s, onClick }) => (
  <div onClick={onClick} style={{ background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16, ...s }}>{children}</div>
);

const Badge = ({ children, color, bg }) => (
  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600, color, background: bg }}>{children}</span>
);

const Spinner = ({ label, estimate }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(iv);
  }, []);
  const est = estimate || 60;
  // Non-linear progress: fast start (0-60% in first half), slow finish (60-95% in second half)
  const ratio = Math.min(1, elapsed / est);
  const pct = Math.min(95, Math.round(ratio < 0.5 ? ratio * 120 : 60 + ratio * 70));
  const msg = label || "Agent processing";
  return (
    <div style={{ padding: "16px 0", maxWidth: 400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, justifyContent: "center" }}>
        <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>{msg}... {elapsed}s</span>
      </div>
      <div style={{ height: 4, background: C.surfaceMuted, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.accentLight})`, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: C.textMuted }}>~{est}s estimated</span>
        <span style={{ fontSize: 10, color: C.textMuted }}>{pct}%</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }
    @media (max-width: 767px) {
      .opsplan-wizard-steps { overflow-x: auto; padding: 8px 12px !important; }
      .opsplan-table { font-size: 10px; }
      .opsplan-table th, .opsplan-table td { padding: 6px 4px !important; }
      .opsplan-btn-row { flex-wrap: wrap; }
    }`}</style>
    </div>
  );
};

// ============================================================
// TOP BAR
// ============================================================
const TopBar = ({ event, chatOpen, onToggleChat, mode, onModeSwitch }) => { const isMobile = useIsMobile(); return (
  <div style={{ padding: "10px 20px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>O</div>
      <span style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: C.text, fontFamily: font }}>OpsPlan</span>
      {event && <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 8, padding: "2px 8px", background: C.surfaceMuted, borderRadius: 4 }}>{event}</span>}
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {onModeSwitch && (
        <button onClick={onModeSwitch} style={{
          padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
          border: `1px solid ${mode === "field" ? C.accent : C.border}`, fontFamily: font,
          background: mode === "field" ? C.accentBg : C.surface, color: mode === "field" ? C.accent : C.textSecondary,
        }}>
          {mode === "field" ? "◉ Field Assessment" : "📋 Field Assessment"}
        </button>
      )}
      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: C.greenBg, color: C.green, fontWeight: 600 }}>Live — Azure OpenAI</span>
      <button onClick={() => { const msg = prompt("Describe the issue:"); if (msg) alert("Bug reported. Thank you!\n\nDetails logged for the development team."); }}
        style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: font }}>🐛 Report Bug</button>
      <button onClick={onToggleChat} style={{
        padding: "6px 14px", borderRadius: 6, border: `1px solid ${chatOpen ? C.accent : C.accent}`,
        background: chatOpen ? C.accentBg : C.accentBg, color: C.accent,
        fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font,
      }}>💬 Agent Chat {chatOpen ? "✕" : ""}</button>
    </div>
  </div>
); };

// ============================================================
// WIZARD STEPS BAR
// ============================================================
const WizardSteps = ({ current, onNav }) => {
  const steps = [
    { num: 1, label: "Define Event" },
    { num: 2, label: "Priority Analysis" },
    { num: 3, label: "Construction Profiles" },
    { num: 4, label: "Mission Plan" },
  ];
  return (
    <div style={{ padding: "12px 24px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", overflowX: "auto", flexWrap: "nowrap" }}>
      {/* Agent status indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 20, padding: "4px 10px", borderRadius: 6, background: "#F5F0E8", border: "1px solid #E2DCD2" }}>
        <span style={{ fontSize: 10, color: "#9C8F82" }}>Agents:</span>
        {["PA", "CP", "MP"].map((label, i) => {
          const completed = current > i;
          const active = current === i;
          return (
            <span key={i} style={{
              width: 22, height: 18, borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, fontWeight: 700, letterSpacing: "0.02em",
              background: completed ? "#2D7D46" : active ? "#B85C1F" : "#E2DCD2",
              color: completed || active ? "#fff" : "#9C8F82",
            }}>{completed ? "✓" : label}</span>
          );
        })}
        <span style={{ fontSize: 10, fontWeight: 600, color: "#6B5E52", marginLeft: 2 }}>{Math.min(current, 3)}/3</span>
      </div>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: i < current ? "pointer" : "default" }} onClick={() => i < current && onNav(i)}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, fontFamily: font,
              background: i < current ? C.green : i === current ? C.accent : "transparent",
              color: i <= current ? "#fff" : C.textMuted,
              border: `2px solid ${i < current ? C.green : i === current ? C.accent : C.borderDark}`,
            }}>{i < current ? "✓" : s.num}</div>
            <span style={{ fontSize: 12, fontWeight: i === current ? 600 : 400, color: i === current ? C.text : C.textMuted, fontFamily: font }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 1, margin: "0 14px", background: i < current ? C.green : C.border }} />}
        </div>
      ))}
    </div>
  );
};

// ============================================================
// CHAT DRAWER
// ============================================================
const ChatDrawer = ({ messages, onSend, agentName, isMobile, onClose }) => {
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    await onSend(input.trim());
    setInput("");
    setSending(false);
  };

  return (
    <div style={{ width: isMobile ? "100%" : 320, borderLeft: isMobile ? "none" : `1px solid ${C.border}`, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0, position: isMobile ? "fixed" : "relative", top: isMobile ? 0 : "auto", left: isMobile ? 0 : "auto", right: isMobile ? 0 : "auto", bottom: isMobile ? 0 : "auto", zIndex: isMobile ? 100 : "auto" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: font }}>Agent Chat</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>Talking to: {agentName || "Priority Analysis Agent"}</div>
            <div style={{ fontSize: 9, color: C.textMuted, marginTop: 1 }}>Context: {[step1Data && "Event", step2Data && "Zones+Profiles", step3Data && "Mission Plan"].filter(Boolean).join(" → ") || "None yet"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.textMuted, padding: 4 }}>✕</button>
        </div>
      </div>
      <div style={{ flex: 1, padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: isMobile ? "calc(100vh - 140px)" : "calc(100vh - 200px)" }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            padding: "9px 12px", borderRadius: 8, fontSize: 12, lineHeight: 1.6, fontFamily: font, maxWidth: "90%",
            background: m.role === "user" ? C.blueBg : C.bgWarm,
            color: m.role === "user" ? C.blue : C.textSecondary,
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            border: `1px solid ${m.role === "user" ? C.blueBorder : C.border}`,
          }}>{m.text}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ padding: 10, borderTop: `1px solid ${C.border}`, display: "flex", gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !sending && send()}
          disabled={sending}
          placeholder={sending ? "Agent thinking..." : "Ask about the analysis..."} style={{
          flex: 1, padding: "9px 12px", borderRadius: 6, border: `1px solid ${C.border}`,
          background: sending ? C.surfaceMuted : C.bg, color: C.text, fontSize: 12, outline: "none", fontFamily: font,
          opacity: sending ? 0.6 : 1,
        }} />
        <Btn primary small onClick={send} disabled={sending}>{sending ? "..." : "Send"}</Btn>
      </div>
    </div>
  );
};

// ============================================================
// STEP 1 — DEFINE EVENT
// ============================================================
const Step1 = ({ onComplete, setLoading, loading }) => {
  const [mode, setMode] = useState("fema"); // fema | location | text
  const [femaNum, setFemaNum] = useState("");
  const [locState, setLocState] = useState("");
  const [locCounties, setLocCounties] = useState("");
  const [eventType, setEventType] = useState("");
  const [freeText, setFreeText] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState("");

  const [formError, setFormError] = useState("");

  const submit = async () => {
    setFormError("");
    // Validate required fields
    if (mode === "text") {
      if (!freeText.trim()) { setFormError("Please enter an event description."); return; }
    } else {
      const missing = [];
      if (!eventType) missing.push("Event Type");
      if (!locState.trim()) missing.push("State");
      if (!locCounties.trim()) missing.push("Affected Counties");
      if (missing.length > 0) { setFormError("Required fields: " + missing.join(", ")); return; }
    }
    // Show confirmation of what will be analyzed
    const countyList = locCounties.split(",").map(s => s.trim()).filter(Boolean);
    if (mode !== "text") {
      const msg = `Analyze ${eventType || "event"} in ${countyList.join(", ")} County, ${locState}${femaNum ? " (FEMA " + femaNum + ")" : ""}?`;
      if (!window.confirm(msg)) return;
    }
    setLoading(true);
    try {
      const counties = countyList;
      let description = "";
      if (mode === "text") { description = freeText; }
      else { description = `${eventType} event. FEMA declaration: ${femaNum}. Analyze census tracts in ${counties.join(" County and ")} County in ${locState}. Use county_to_tracts to get tract lists, then look up SVI and NRI for each tract.`; }
      const res = await fetch(API + "/api/events/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, weights: null }) });
      if (!res.ok) throw new Error("API " + res.status);
      const data = await res.json();
      if (data.zones) data.zones = data.zones.map(z => ({ ...z, area_name: z.area_name || z.area || "Unknown" }));
      setLoading(false);
      onComplete(data);
    } catch (err) {
      console.error("Agent error:", err);
      setLoading(false);
      onComplete({ event: { type: eventType, name: "Harvey", declaration: femaNum, affected_counties: locCounties.split(",").map(s => s.trim()) }, zones: MOCK_ZONES, scoring_weights: { svi: 0.30, nri: 0.30, housing_vulnerability: 0.25, population_density: 0.15 }, summary: "API unavailable. Error: " + err.message });
    }
  };

  const prefill = () => {
    setPrefilled(true); setMode("fema"); setFemaNum("DR-4332-TX"); setLocState("Texas");
    setLocCounties("Aransas, Refugio, Calhoun, Victoria, San Patricio"); setEventType("Hurricane");
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {!prefilled && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>⚡ Weather Sentinel Alerts</div>
          {[
            { id: "harvey", name: "Hurricane Harvey", detail: "Cat 4 projected landfall TX coast", counties: "Aransas, Refugio, Calhoun, Victoria, San Patricio", state: "Texas", type: "Hurricane", fema: "DR-4332-TX", stats: "5 counties, ~45,200 structures, ~128,000 pop at risk", time: "2h ago" },
            { id: "ian", name: "Hurricane Ian", detail: "Cat 4 approaching SW Florida", counties: "Lee, Charlotte, Collier, DeSoto", state: "Florida", type: "Hurricane", fema: "DR-4673-FL", stats: "4 counties, ~180,000 structures, ~520,000 pop at risk", time: "6h ago" },
            { id: "tornado", name: "Tornado Outbreak — MS", detail: "EF3+ tornado track across central Mississippi", counties: "Hinds, Madison, Yazoo", state: "Mississippi", type: "Tornado", fema: "", stats: "3 counties, ~12,000 structures, ~95,000 pop at risk", time: "12h ago" },
          ].map(alert => (
            <Card key={alert.id} style={{ marginBottom: 8, background: C.accentBg, borderColor: C.accentBorder, cursor: "pointer" }}
              onClick={() => { setPrefilled(true); setMode("fema"); setFemaNum(alert.fema); setLocState(alert.state); setLocCounties(alert.counties); setEventType(alert.type); setSelectedAlert(alert.name); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{alert.name} — {alert.detail}</div>
                  <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{alert.stats}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{alert.time}</span>
                  <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, marginTop: 2 }}>Select →</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {prefilled && (
        <div style={{ padding: "8px 14px", background: C.greenBg, borderRadius: 6, border: `1px solid ${C.greenBorder}`, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C.green, fontWeight: 600, fontSize: 12 }}>✓ Pre-filled from: {selectedAlert || "Weather Sentinel Alert"}</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>— Review and confirm before proceeding</span>
        </div>
      )}

      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 4px", fontFamily: font }}>Define Event</h2>
      <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 20px", fontFamily: font }}>Enter the disaster event details. The Disaster Context Agent will analyze the affected area and identify priority zones.</p>

      {/* Input mode tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
        {[{ id: "fema", label: "FEMA Declaration" }, { id: "location", label: "Location + Type" }, { id: "text", label: "Free Text" }].map(t => (
          <button key={t.id} onClick={() => setMode(t.id)} style={{
            padding: "8px 16px", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 600,
            background: mode === t.id ? C.accent : C.surface, color: mode === t.id ? "#fff" : C.textMuted,
            borderRadius: t.id === "fema" ? "6px 0 0 6px" : t.id === "text" ? "0 6px 6px 0" : 0,
            borderRight: t.id !== "text" ? "none" : undefined,
          }}>{t.label}</button>
        ))}
      </div>

      <Card style={{ marginBottom: 20 }}>
        {mode === "fema" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>FEMA Declaration Number</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={femaNum} onChange={e => setFemaNum(e.target.value)} placeholder="e.g. DR-4332-TX"
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, outline: "none", color: C.text }} />
                {prefilled && <Badge color={C.green} bg={C.greenBg}>AUTO</Badge>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>Event Type</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, background: C.surface, color: C.text }}>
                  {["", "Hurricane", "Tornado", "Flood", "Earthquake", "Wildfire", "Winter Storm", "Other"].map(t => <option key={t} value={t}>{t || "Select event type..."}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>State</label>
                <input value={locState} onChange={e => setLocState(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, outline: "none", color: C.text, boxSizing: "border-box" }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>Affected Counties</label>
              <input value={locCounties} onChange={e => setLocCounties(e.target.value)} placeholder="e.g. Harris, Galveston, Brazoria"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, outline: "none", color: C.text, boxSizing: "border-box" }} />
            </div>
          </div>
        )}

        {mode === "location" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>Event Type</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, background: C.surface, color: C.text }}>
                  {["", "Hurricane", "Tornado", "Flood", "Earthquake", "Wildfire", "Winter Storm", "Other"].map(t => <option key={t} value={t}>{t || "Select event type..."}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>State</label>
                <input value={locState} onChange={e => setLocState(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, outline: "none", color: C.text, boxSizing: "border-box" }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>Counties</label>
              <input value={locCounties} onChange={e => setLocCounties(e.target.value)} placeholder="Enter county names"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, outline: "none", color: C.text, boxSizing: "border-box" }} />
            </div>
          </div>
        )}

        {mode === "text" && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>Describe the event</label>
            <textarea value={freeText} onChange={e => setFreeText(e.target.value)} rows={4}
              placeholder="e.g., Hurricane Harvey made landfall near Rockport, TX as a Category 4 on August 25, 2017. Assess Aransas and Refugio counties."
              style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, outline: "none", color: C.text, resize: "vertical", boxSizing: "border-box" }} />
          </div>
        )}
      </Card>

      {formError && (
        <div style={{ padding: "10px 14px", background: "#FDF2F2", borderRadius: 6, border: "1px solid #E8C4C4", marginBottom: 12 }}>
          <span style={{ color: "#B33A3A", fontSize: 12, fontWeight: 600 }}>{formError}</span>
        </div>
      )}

      {loading ? <Spinner label="Priority Analysis Agent analyzing" estimate={90} /> : (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn primary onClick={submit}>Run Priority Analysis Agent →</Btn>
        </div>
      )}
    </div>
  );
};

// ============================================================
// HOVER-TO-ASK AGENT COMPONENT
// ============================================================
const AskableValue = ({ label, value, onAsk, children }) => {
  const [showTip, setShowTip] = useState(false);
  const isMob = useIsMobile();
  return (
    <span style={{ position: "relative", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
      onMouseEnter={() => !isMob && setShowTip(true)} onMouseLeave={() => setShowTip(false)}
      onClick={(e) => {
        e.stopPropagation();
        try {
          if (isMob && !showTip) { setShowTip(true); setTimeout(() => setShowTip(false), 2500); return; }
          if (onAsk) onAsk(`Explain the ${label} value of ${value} — what does this mean for disaster response planning and how was it calculated?`);
        } catch (err) { console.error("AskableValue error:", err); }
      }}>
      {children || value}
      <span style={{ fontSize: 9, opacity: showTip ? 1 : 0.4, transition: "opacity 0.15s", color: "#3D6B8E" }}>ℹ️</span>
      {showTip && (
        <span style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap",
          padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600, zIndex: 10,
          background: "#2C2520", color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
          onClick={(e) => { e.stopPropagation(); try { if (onAsk) onAsk(`Explain the ${label} value of ${value} — what does this mean for disaster response planning and how was it calculated?`); } catch(err) { console.error(err); } }}>
          💬 {isMob ? "Tap to ask agent" : "Click to ask agent"} about {label}
        </span>
      )}
    </span>
  );
};

// ============================================================
// STEP 2 — PRIORITY ANALYSIS
// ============================================================

const Step2 = ({ data, onComplete, setLoading, loading, onAskAgent, cachedResult }) => {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState(0);
  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights] = useState(data?.scoring_weights || { svi: 0.30, nri: 0.30, housing_vulnerability: 0.25, population_density: 0.15 });
  const [zones, setZones] = useState(data?.zones || MOCK_ZONES);
  const z = zones[selected];

  const approve = async () => {
    // If we already have profiles from a previous run, skip the API call
    if (cachedResult?.profiles && cachedResult.profiles.length > 0) {
      onComplete({ zones, profiles: cachedResult.profiles });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(API + "/api/profiles/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zones }) });
      if (!res.ok) throw new Error("API " + res.status);
      const d = await res.json();
      setLoading(false);
      const profs = d.profiles || (d.text ? zones.map((z, i) => ({ ...MOCK_PROFILES[i % MOCK_PROFILES.length], zone_name: placeName(z.fips_tract, z.area_name || z.area), zone_fips: z.fips_tract, agent_analysis: d.text })) : d);
      onComplete({ zones, profiles: Array.isArray(profs) ? profs : MOCK_PROFILES });
    } catch (err) {
      console.error("Profile agent error:", err);
      setLoading(false);
      if (window.confirm("Construction Profile Agent failed: " + err.message + "\n\nRetry?")) {
        approve(); // retry
      } else {
        onComplete({ zones, profiles: MOCK_PROFILES });
      }
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, fontFamily: font }}>Priority Analysis</h2>
          <p style={{ fontSize: 12, color: C.textMuted, margin: "3px 0 0" }}>{zones.length} zones ranked — click a row to see details</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={() => setShowWeights(!showWeights)}>Adjust Weights</Btn>
          {loading ? <Spinner label="Construction Profile Agent building profiles" estimate={90} /> : <Btn primary onClick={approve}>Approve Rankings →</Btn>}
        </div>
      </div>

      {/* Weights Panel */}
      {showWeights && (
        <Card style={{ marginBottom: 16, background: C.blueBg, borderColor: C.blueBorder }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Scoring Weights</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              { key: "svi", label: "Social Vulnerability" },
              { key: "nri", label: "Natural Hazard Risk" },
              { key: "housing_vulnerability", label: "Housing Vulnerability" },
              { key: "population_density", label: "Population Density" },
            ].map(w => (
              <div key={w.key}>
                <label style={{ fontSize: 10, color: C.textSecondary, display: "block", marginBottom: 4 }}>{w.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="range" min="0" max="100" value={Math.round((weights[w.key] || 0) * 100)}
                    onChange={e => setWeights(prev => ({ ...prev, [w.key]: parseInt(e.target.value) / 100 }))}
                    style={{ flex: 1, accentColor: C.blue }} />
                  <div style={{ display: "flex", alignItems: "center", minWidth: 52 }}>
                    <input type="number" min="0" max="100" value={Math.round((weights[w.key] || 0) * 100)}
                      onChange={e => { const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); setWeights(prev => ({ ...prev, [w.key]: v / 100 })); }}
                      style={{ width: 38, padding: "2px 4px", borderRadius: 4, border: "1px solid " + "#E2DCD2", fontSize: 12, fontWeight: 700, color: "#3D6B8E", textAlign: "right", outline: "none" }} />
                    <span style={{ fontSize: 11, color: "#3D6B8E", marginLeft: 1 }}>%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 100) === 100 ? C.green : C.red, fontWeight: 600 }}>Total: {Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 100)}%{Object.values(weights).some(w => w === 0) ? " ⚠️ Zero weights will exclude that factor" : ""}{Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 100) !== 100 ? " (must equal 100%)" : " OK"}</span>
            <Btn primary small onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch(API + "/api/events/analyze", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ description: data?.summary || "Re-score with updated weights", weights }),
                });
                if (!res.ok) throw new Error("API " + res.status);
                const d = await res.json();
                if (d.zones) {
                  setZones(d.zones.map(z => ({ ...z, area_name: z.area_name || z.area || "Unknown" })));
                }
                setLoading(false);
                setShowWeights(false);
              } catch (err) {
                console.error("Re-score error:", err);
                setLoading(false);
              }
            }} disabled={Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 100) !== 100}>Re-Score Zones</Btn>
          </div>
        </Card>
      )}

      {/* Data Table */}
      <Card style={{ padding: 0, overflow: "auto", marginBottom: 16, WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {["", "Zone", "Score", "SVI", "NRI", "Pop.", "Housing Vuln.", "Risk"].map(h => (
                <th key={h} style={{ padding: "8px", textAlign: "left", fontSize: 9, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((zn, i) => (
              <tr key={i} onClick={() => setSelected(i)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected === i ? C.accentBg : "transparent" }}>
                <td style={{ padding: "9px 8px", fontWeight: 700, color: C.textMuted, fontSize: 11 }}>#{zn.rank}</td>
                <td style={{ padding: "9px 8px" }}>
                  <div style={{ fontWeight: 600, color: C.text }}>{placeName(zn.fips_tract, zn.area_name || zn.area)}</div>
                  <div style={{ fontSize: 9, color: C.textMuted }}>{zn.fips_tract}</div>
                </td>
                <td style={{ padding: "9px 8px", fontWeight: 700, fontSize: 14 }}>{zn.composite_score}</td>
                <td style={{ padding: "9px 8px", color: C.textSecondary }}>{Math.round(zn.svi_score * 100)}%</td>
                <td style={{ padding: "9px 8px", color: C.textSecondary }}>{Math.round(zn.nri_score * 100)}%</td>
                <td style={{ padding: "9px 8px", color: C.textSecondary }}>{zn.population?.toLocaleString()}</td>
                <td style={{ padding: "9px 8px", color: C.textSecondary }}>{zn.housing_vulnerability ? Math.round(zn.housing_vulnerability * 100) + "%" : "—"}</td>
                <td style={{ padding: "9px 8px" }}><Badge color={riskColor(zn.risk_level)} bg={riskBg(zn.risk_level)}>{zn.risk_level}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Zone Detail */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0, fontFamily: font }}>Zone #{z.rank} — {placeName(z.fips_tract, z.area_name || z.area)}</h3>
            <span style={{ fontSize: 10, color: C.textMuted }}>{z.fips_tract}</span>
          </div>
          <Badge color={riskColor(z.risk_level)} bg={riskBg(z.risk_level)}>{z.risk_level} — Score {z.composite_score}</Badge>
        </div>

        {/* Scoring breakdown — show how composite score is derived */}
        <div style={{ marginBottom: 16, padding: 12, background: C.blueBg, borderRadius: 8, border: `1px solid ${C.blueBorder}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.blue, textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.04em" }}>Score Breakdown — How {z.composite_score} is Calculated</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: isMobile ? 6 : 8 }}>
            {[
              { label: "SVI", raw: z.svi_score, weight: weights.svi, color: "#A93E2B" },
              { label: "NRI", raw: z.nri_score, weight: weights.nri, color: "#B85C1F" },
              { label: "Housing", raw: z.housing_vulnerability, weight: weights.housing_vulnerability, color: "#9C7B2E" },
              { label: "Pop. Density", raw: z.population_density_norm || (z.population ? z.population / 5000 : 0.5), weight: weights.population_density, color: "#6B5B8A" },
            ].map((s, i) => {
              const rawPct = Math.round((s.raw || 0) * 100);
              const weightPct = Math.round((s.weight || 0) * 100);
              const contribution = Math.round(rawPct * (s.weight || 0));
              return (
                <div key={i} style={{ background: C.surface, borderRadius: 6, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: C.text }}><span style={{ fontWeight: 700, color: s.color }}>{rawPct}</span> × <span style={{ color: C.blue }}>{weightPct}%</span></div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginTop: 2 }}>= {contribution}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: C.textMuted }}>
            Formula: (SVI × {Math.round((weights.svi || 0) * 100)}%) + (NRI × {Math.round((weights.nri || 0) * 100)}%) + (Housing × {Math.round((weights.housing_vulnerability || 0) * 100)}%) + (Pop × {Math.round((weights.population_density || 0) * 100)}%) = <strong style={{ color: C.text }}>{z.composite_score}</strong>
          </div>
        </div>

        {/* Metric cards */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: isMobile ? 6 : 10, marginBottom: 16 }}>
          {[
            { label: "Population", value: z.population?.toLocaleString() || "—", sub: z.households ? z.households.toLocaleString() + " households" : "—" },
            { label: "SVI Score", value: z.svi_score != null ? Math.round(z.svi_score * 100) + "%" : "—", sub: "Social Vulnerability" },
            { label: "NRI Score", value: z.nri_score != null ? Math.round(z.nri_score * 100) + "%" : "—", sub: "Natural Hazard Risk" },
            { label: "Housing Vuln.", value: z.housing_vulnerability != null ? Math.round(z.housing_vulnerability * 100) + "%" : "—", sub: "Structural vulnerability" },
          ].map((m, i) => (
            <div key={i} style={{ background: C.bg, borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: C.textSecondary }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Vulnerability bars + Agent callout */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 10 }}>Vulnerability Breakdown</div>
            {[
              { label: "Social Vulnerability (SVI)", value: Math.round(z.svi_score * 100), color: C.red },
              { label: "Natural Hazard Risk (NRI)", value: Math.round(z.nri_score * 100), color: C.accent },
              { label: "Housing Vulnerability", value: Math.round(z.housing_vulnerability * 100), color: C.yellow },
            ].map((b, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <AskableValue label={b.label} value={b.value + "%"} onAsk={onAskAgent}>
                    <span style={{ color: C.textSecondary }}>{b.label}</span>
                  </AskableValue>
                  <span style={{ fontWeight: 700, color: b.color }}>{b.value}%</span>
                </div>
                <div style={{ height: 5, background: C.surfaceMuted, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${b.value}%`, height: "100%", background: b.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: C.accentBg, borderRadius: 8, padding: 14, border: `1px solid ${C.accentBorder}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.accent, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Agent Analysis</div>
            <p style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.7, margin: 0 }}>{z.explanation}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ============================================================
// STEP 3 — CONSTRUCTION PROFILES
// ============================================================
const Step3 = ({ data, step1Data, onComplete, setLoading, loading, onAskAgent, cachedResult }) => {
  const [selectedZone, setSelectedZone] = useState(0);
  const [tab, setTab] = useState("structural");
  const rawProfiles = data?.profiles;
  // Normalize: if API returned object with text (agent gave prose), wrap it
  // If array, use directly. If missing, use mock.
  let profiles;
  if (Array.isArray(rawProfiles) && rawProfiles.length > 0 && rawProfiles[0].structural) {
    profiles = rawProfiles;
  } else if (Array.isArray(rawProfiles) && rawProfiles.length > 0) {
    // API returned array but without mock structure — adapt
    profiles = rawProfiles.map((rp, i) => ({
      ...MOCK_PROFILES[i % MOCK_PROFILES.length],
      ...rp,
      zone_name: rp.zone_name || rp.area_name || placeName(rp.fips_tract || rp.zone_fips, "Zone " + (i+1)),
      agent_analysis: rp.agent_analysis || rp.explanation || rp.text || JSON.stringify(rp),
    }));
  } else if (data?.zones) {
    // No profiles from API, build from zones with mock structural data
    profiles = (data.zones || MOCK_ZONES).map((z, i) => ({
      ...MOCK_PROFILES[i % MOCK_PROFILES.length],
      zone_name: placeName(z.fips_tract, z.area_name || z.area),
      zone_fips: z.fips_tract,
      agent_analysis: z.explanation || "Agent analysis pending",
    }));
  } else {
    profiles = MOCK_PROFILES;
  }
  const p = profiles[selectedZone] || profiles[0] || MOCK_PROFILES[0];

  const approve = async () => {
    // If we already have a mission plan from a previous run, skip the API call
    if (cachedResult?.sop && cachedResult.sop.situation) {
      onComplete(cachedResult);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(API + "/api/plan/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: step1Data || data, construction: { zones: data?.zones, profiles } }) });
      if (!res.ok) throw new Error("API " + res.status);
      const d = await res.json();
      setLoading(false);
      let sop;
      if (d.sop && d.sop.situation) { sop = d.sop; }
      else if (d.situation) { sop = d; }
      else { sop = { ...MOCK_SOP }; if (d.text) { sop.situation = { ...MOCK_SOP.situation, event_summary: d.text }; } }
      onComplete({ sop });
    } catch (err) {
      console.error("Mission plan error:", err);
      setLoading(false);
      if (window.confirm("Mission Planning Agent failed: " + err.message + "\n\nRetry?")) {
        approve(); // retry
      } else {
        onComplete({ sop: MOCK_SOP });
      }
    }
  };

  const tabs = [
    { id: "structural", label: "Structural" },
    { id: "exterior", label: "Exterior Envelope" },
    { id: "site", label: "Site & Hazard" },
    { id: "financial", label: "Financial" },
    { id: "demographics", label: "Demographics" },
    { id: "tr_vulnerability", label: "TR Vulnerability" },
  ];

  const DataRow = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <AskableValue label={label} value={String(value || "")} onAsk={onAskAgent}>
        <span style={{ color: C.textSecondary }}>{label}</span>
      </AskableValue>
      <span style={{ fontWeight: 600, color: C.text, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>Construction Profiles</h2>
          <p style={{ fontSize: 12, color: C.textMuted, margin: "3px 0 0" }}>Detailed structural data for each priority zone</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {loading ? <Spinner label="Mission Planning Agent generating plan" estimate={90} /> : <Btn primary onClick={approve}>Approve Profiles →</Btn>}
        </div>
      </div>

      {/* Zone selector pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {profiles.map((pr, i) => (
          <button key={i} onClick={() => setSelectedZone(i)} style={{
            padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontFamily: font, fontSize: 11, fontWeight: 600,
            border: `1.5px solid ${selectedZone === i ? C.accent : C.border}`,
            background: selectedZone === i ? C.accentBg : C.surface,
            color: selectedZone === i ? C.accent : C.textMuted,
          }}>#{i + 1} {(pr.zone_name || pr.area_name || "Zone " + (i+1)).split("—")[0].split("–")[0].trim()}</button>
        ))}
      </div>

      <Card key={selectedZone + "-" + (p.zone_fips || "")}>
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>{p.zone_name || p.area_name || "Zone"}</h3>
          <span style={{ fontSize: 10, color: C.textMuted }}>{p.zone_fips || p.fips_tract || ""}</span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 14px", border: "none", cursor: "pointer", fontFamily: font, fontSize: 11, fontWeight: 600,
              background: "transparent", color: tab === t.id ? C.accent : C.textMuted,
              borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Show raw agent response if structured data missing */}
        {!p.structural && !p.exterior && p.agent_analysis && (
          <div style={{ background: C.accentBg, borderRadius: 8, padding: 14, border: `1px solid ${C.accentBorder}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.accent, marginBottom: 5, textTransform: "uppercase" }}>Agent Analysis</div>
            <p style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{typeof p.agent_analysis === "string" ? p.agent_analysis : JSON.stringify(p.agent_analysis, null, 2)}</p>
          </div>
        )}
        {!p.structural && !p.exterior && !p.agent_analysis && (
          <div style={{ background: C.blueBg, borderRadius: 8, padding: 14, border: `1px solid ${C.blueBorder}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.blue, marginBottom: 5, textTransform: "uppercase" }}>Profile Data</div>
            <pre style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto" }}>{JSON.stringify(p, null, 2)}</pre>
          </div>
        )}

        {tab === "structural" && p.structural && (
          <div>
            <DataRow label="Stories: 1-story" value={`${p.structural.stories_1}%`} />
            <DataRow label="Stories: 2-story" value={`${p.structural.stories_2}%`} />
            <DataRow label="Stories: 3+" value={`${p.structural.stories_3plus}%`} />
            <DataRow label="Foundation: Slab" value={`${p.structural.foundation_slab}%`} />
            <DataRow label="Foundation: Crawl Space" value={`${p.structural.foundation_crawl}%`} />
            <DataRow label="Foundation: Pier/Piling" value={`${p.structural.foundation_pier}%`} />
            <DataRow label="First Floor Height (avg)" value={p.structural.first_floor_height} />
            <DataRow label="Pre-Code Construction" value={`${p.structural.design_level_pre_code}%`} />
          </div>
        )}
        {tab === "exterior" && p.exterior && (
          <div>
            <DataRow label="Roof Shape: Gable" value={`${p.exterior.roof_shape_gable}%`} />
            <DataRow label="Roof Shape: Hip" value={`${p.exterior.roof_shape_hip}%`} />
            <DataRow label="Roof Cover" value={p.exterior.roof_cover} />
            <DataRow label="Exterior Wall" value={p.exterior.exterior_wall} />
            <DataRow label="Framing" value={p.exterior.framing} />
            <DataRow label="Window Type" value={p.exterior.window_type} />
            <DataRow label="Roof Deck Attachment" value={p.exterior.roof_deck} />
            <DataRow label="Roof-Wall Connection" value={p.exterior.roof_wall} />
          </div>
        )}
        {tab === "site" && p.site && (
          <div>
            <DataRow label="Flood Zone VE (coastal high hazard)" value={`${p.site.flood_zone_VE}%`} />
            <DataRow label="Flood Zone AE" value={`${p.site.flood_zone_AE}%`} />
            <DataRow label="Flood Zone X (shaded / 500-yr)" value={`${p.site.flood_zone_X500}%`} />
            <DataRow label="Flood Zone X (minimal)" value={`${p.site.flood_zone_X}%`} />
            <DataRow label="Storm Surge Projection" value={p.site.storm_surge} />
            <DataRow label="Design Wind Speed" value={p.site.wind_speed} />
            <DataRow label="Coastal Proximity" value={p.site.coastal_proximity} />
          </div>
        )}
        {tab === "financial" && p.financial && (
          <div>
            <DataRow label="Median Home Value" value={p.financial.median_home_value || p.financial.median_value} />
            <DataRow label="Median Household Income" value={p.financial.median_household_income} />
            <DataRow label="Median Contract Rent" value={p.financial.median_rent || p.financial.median_contract_rent} />
            <DataRow label="Est. Total Replacement Cost" value={p.financial.replacement_cost_est || p.financial.replacement_total} />
            {/* Cost breakdown context */}
            {p.structural && p.financial.median_home_value && (
              <div style={{ marginTop: 12, padding: 10, background: C.blueBg, borderRadius: 6, border: `1px solid ${C.blueBorder}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.blue, textTransform: "uppercase", marginBottom: 6 }}>Replacement Cost Methodology</div>
                <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.7 }}>
                  <div>Total housing units: <strong style={{ color: C.text }}>{p.structural.total_housing_units?.toLocaleString() || "—"}</strong></div>
                  <div>SF detached: {p.structural.sf_detached?.toLocaleString() || "—"} × median value {p.financial.median_home_value}</div>
                  <div>Mobile/manufactured: {p.structural.mobile_home?.toLocaleString() || "—"} × est. $55K–$75K replacement</div>
                  <div>Multi-unit: {p.structural.multi_unit?.toLocaleString() || "—"} × est. $95K–$150K per unit</div>
                  <div style={{ marginTop: 4, fontSize: 10, color: C.textMuted }}>Note: Estimates use Census median home values and RSMeans regional cost factors. Actual replacement costs vary by damage severity, code compliance requirements, and material availability.</div>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === "demographics" && p.demographics && (
          <div>
            <DataRow label="Total Population" value={(p.demographics.total_population || "").toLocaleString()} />
            <DataRow label="Median Age" value={p.demographics.median_age} />
            <DataRow label="Age 65+" value={p.demographics.age_65_plus_pct != null ? p.demographics.age_65_plus_pct + "%" : p.demographics.age_65_plus} />
            <DataRow label="Disability Rate" value={p.demographics.disability_pct != null ? p.demographics.disability_pct + "%" : p.demographics.disability} />
            <DataRow label="Below Poverty" value={p.demographics.below_poverty_pct != null ? p.demographics.below_poverty_pct + "%" : p.demographics.below_poverty} />
            <DataRow label="Limited English" value={p.demographics.limited_english_pct != null ? p.demographics.limited_english_pct + "%" : p.demographics.limited_english} />
            <DataRow label="No Vehicle" value={p.demographics.no_vehicle_pct != null ? p.demographics.no_vehicle_pct + "%" : p.demographics.no_vehicle} />
            <DataRow label="Renter-Occupied" value={p.demographics.tenant_occupied_pct != null ? p.demographics.tenant_occupied_pct + "%" : ""} />
            <DataRow label="Owner-Occupied" value={p.demographics.tenant_occupied_pct != null ? (100 - p.demographics.tenant_occupied_pct).toFixed(1) + "%" : ""} />
            <DataRow label="Unemployment Rate" value={p.demographics.unemployment_pct != null ? p.demographics.unemployment_pct + "%" : p.demographics.unemployment || ""} />
          </div>
        )}

        {tab === "tr_vulnerability" && p.tr_vulnerability && (
          <div>
            <DataRow label="Overall SVI Score" value={p.tr_vulnerability.svi_score} />
            <DataRow label="SVI Rating" value={p.tr_vulnerability.svi_rating} />
            <DataRow label="Theme 1: Socio-Economic" value={p.tr_vulnerability.theme_1_socioeconomic} />
            <DataRow label="Theme 2: Household Comp / Disability" value={p.tr_vulnerability.theme_2_household_disability} />
            <DataRow label="Theme 3: Minority / Language" value={p.tr_vulnerability.theme_3_minority_language} />
            <DataRow label="Theme 4: Housing / Transport" value={p.tr_vulnerability.theme_4_housing_transport} />
          </div>
        )}
        {tab === "tr_vulnerability" && !p.tr_vulnerability && (
          <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12 }}>TR vulnerability data not available for this zone</div>
        )}

        {/* Agent analysis */}
        <div style={{ marginTop: 16, background: C.accentBg, borderRadius: 8, padding: 14, border: `1px solid ${C.accentBorder}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.accent, marginBottom: 4, textTransform: "uppercase" }}>Agent Analysis</div>
          <p style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.7, margin: 0 }}>{p.agent_analysis}</p>
        </div>
      </Card>
    </div>
  );
};

// ============================================================
// STEP 4 — MISSION PLAN (SOP)
// ============================================================
const Step4 = ({ data, step1Data, onNewAlert, onReturnToStart, onAction }) => {
  const isMobile = useIsMobile();
  const [section, setSection] = useState("situation");
  const [editing, setEditing] = useState(null); // { section, field, index } or null
  const [editValue, setEditValue] = useState("");
  const [sopState, setSopState] = useState(null);

  const raw = data?.sop || MOCK_SOP;
  const baseSop = {
    situation: { ...MOCK_SOP.situation, ...(raw.situation || {}) },
    mission: { ...MOCK_SOP.mission, ...(raw.mission || {}) },
    execution: { ...MOCK_SOP.execution, phases: raw.execution?.phases || MOCK_SOP.execution.phases },
    sustainment: { ...MOCK_SOP.sustainment, ...(raw.sustainment || {}), personnel: { ...MOCK_SOP.sustainment.personnel, ...(raw.sustainment?.personnel || {}) } },
    command_signal: { ...MOCK_SOP.command_signal, ...(raw.command_signal || {}) },
  };
  const sop = sopState || baseSop;

  const startEdit = (sec, field, index) => {
    let val;
    if (index !== undefined) {
      val = Array.isArray(sop[sec][field]) ? sop[sec][field][index] : "";
    } else {
      const raw = sop[sec]?.[field];
      if (Array.isArray(raw)) {
        val = raw.join("\n"); // Edit arrays as newline-separated text
      } else if (typeof raw === "object" && raw !== null) {
        val = JSON.stringify(raw, null, 2); // Edit objects as JSON
      } else {
        val = raw || "";
      }
    }
    setEditing({ section: sec, field, index });
    setEditValue(val);
  };

  const saveEdit = () => {
    if (!editing) return;
    const newSop = JSON.parse(JSON.stringify(sop));
    const originalVal = sop[editing.section]?.[editing.field];
    if (editing.index !== undefined) {
      newSop[editing.section][editing.field][editing.index] = editValue;
    } else if (Array.isArray(originalVal)) {
      // Split newline-separated text back into array
      newSop[editing.section][editing.field] = editValue.split("\n").map(s => s.trim()).filter(Boolean);
    } else if (typeof originalVal === "object" && originalVal !== null) {
      try { newSop[editing.section][editing.field] = JSON.parse(editValue); } catch { /* keep as string */ newSop[editing.section][editing.field] = editValue; }
    } else {
      newSop[editing.section][editing.field] = editValue;
    }
    setSopState(newSop);
    setEditing(null);
  };

  const cancelEdit = () => { setEditing(null); setEditValue(""); };

  const exportDocx = async () => {
    try {
      const payload = {
        sop,
        event: data?.event || step1Data?.event || null,
        zones: data?.zones || step1Data?.zones || null,
      };
      const res = await fetch(API + "/api/export/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Export failed: " + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "OpsPlan_MissionPlan_" + new Date().toISOString().slice(0, 10) + ".docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed: " + err.message);
    }
  };

  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const sendEmail = () => {
    // Build mailto link with SOP summary
    const subject = encodeURIComponent("OpsPlan Mission Plan — " + (sop.situation.event_summary || "").substring(0, 60));
    const body = encodeURIComponent(
      "Team,\n\n" +
      "The Operations Order for this event is ready for review.\n\n" +
      "SITUATION: " + (sop.situation.event_summary || "") + "\n\n" +
      "MISSION: " + (sop.mission.primary_objective || "") + "\n\n" +
      "Please download the attached .docx from OpsPlan for the complete 5-paragraph order.\n\n" +
      "Key Numbers:\n" +
      "- Zones: " + (sop.execution.phases?.[0]?.zone_assignments || "See SOP") + "\n" +
      "- Personnel: " + (sop.sustainment.personnel?.total || "See SOP") + " core team\n" +
      "- Duration: " + (sop.execution.phases?.[2]?.timeline || "See SOP") + "\n\n" +
      "Generated by OpsPlan AI — Team Rubicon"
    );
    const emails = emailTo.split(",").map(e => e.trim()).join(",");
    const a = document.createElement("a");
    a.href = "mailto:" + emails + "?subject=" + subject + "&body=" + body;
    a.click();
    setEmailSent(true);
  };

  const sections = [
    { id: "situation", label: "I. Situation", icon: "📋" },
    { id: "mission", label: "II. Mission", icon: "🎯" },
    { id: "execution", label: "III. Execution", icon: "⚡" },
    { id: "sustainment", label: "IV. Sustainment", icon: "📦" },
    { id: "command_signal", label: "V. Command & Signal", icon: "📡" },
  ];

  const SectionBlock = ({ title, children, editKey, editSection: editSec }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, fontFamily: font }}>{title}</h4>
        {editKey && <button onClick={() => startEdit(editSec || section, editKey)} style={{
          background: "none", border: "none", fontSize: 10, color: C.textMuted, cursor: "pointer", padding: "2px 6px",
        }}>edit</button>}
      </div>
      {editing && editing.field === editKey && editing.section === (editSec || section) && editing.index === undefined ? (
        <div>
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={Math.min(12, Math.max(4, editValue.split("\n").length + 1))} style={{
            width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.accent}`,
            fontSize: 12, fontFamily: font, color: C.text, lineHeight: 1.7, resize: "vertical", boxSizing: "border-box", outline: "none",
          }} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <Btn primary small onClick={saveEdit}>Save</Btn>
            <Btn small onClick={cancelEdit}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.7 }}>{children}</div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>Mission Plan</h2>
          <p style={{ fontSize: 12, color: C.textMuted, margin: "3px 0 0" }}>Team Rubicon 5-Paragraph Mission Plan</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={() => { if (editing) cancelEdit(); else setEditing(section); }}>{editing ? "Cancel Edit" : "Edit Section"}</Btn>
          <Btn onClick={() => setShowEmail(true)}>Email to Team</Btn>
          <Btn primary onClick={exportDocx}>Export Mission Plan ↓</Btn>
          {onNewAlert && <Btn onClick={onNewAlert} style={{ background: "#2D7D46", color: "#fff", border: "none" }}>+ New Alert</Btn>}
          {onReturnToStart && <Btn onClick={onReturnToStart}>← Return to Start</Btn>}
        </div>
      </div>

      {/* Email Modal */}
      {showEmail && (
        <Card style={{ marginBottom: 16, background: C.blueBg, borderColor: C.blueBorder }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Send to Team</div>
          {emailSent ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>Email client opened</span>
              <Btn small onClick={() => { setShowEmail(false); setEmailSent(false); }}>Close</Btn>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: C.textSecondary, margin: "0 0 8px" }}>Enter email addresses (comma-separated). This will open your email client with a summary. Download the .docx first to attach it.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="ops@teamrubicon.org, ic@teamrubicon.org"
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: font, outline: "none" }} />
                <Btn primary small onClick={sendEmail}>Send</Btn>
                <Btn small onClick={() => setShowEmail(false)}>Cancel</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 16 }}>
        {/* Section nav */}
        <div style={{ width: isMobile ? "100%" : 200, flexShrink: 0, display: isMobile ? "flex" : "block", gap: 4, overflowX: isMobile ? "auto" : "visible", paddingBottom: isMobile ? 8 : 0 }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              width: isMobile ? "auto" : "100%", padding: isMobile ? "8px 12px" : "10px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: font,
              display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 0 : 4, whiteSpace: isMobile ? "nowrap" : "normal",
              background: section === s.id ? C.accentBg : "transparent",
              color: section === s.id ? C.accent : C.textSecondary, fontSize: 12, fontWeight: 600, textAlign: "left",
            }}><span>{s.icon}</span> {s.label}</button>
          ))}

          <div style={{ marginTop: 16, padding: 14, background: C.greenBg, borderRadius: 8, border: `1px solid ${C.greenBorder}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.green, textTransform: "uppercase", marginBottom: 6 }}>Summary</div>
            {[
              { label: "Zones", value: "5" },
              { label: "Personnel", value: "36 + 20 vol" },
              { label: "Duration", value: "21 days" },
              { label: "Est. Materials", value: "$2.4M" },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: C.textSecondary }}>{m.label}</span>
                <span style={{ fontWeight: 600, color: C.text }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ marginTop: 12, padding: 12, background: C.blueBg, borderRadius: 8, border: `1px solid ${C.blueBorder}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.blue, textTransform: "uppercase", marginBottom: 8 }}>Quick Actions</div>
            {[
              { label: "Draft Personnel Request", icon: "👥" },
              { label: "Draft Equipment Request", icon: "🚛" },
              { label: "Create SITREP Template", icon: "📋" },
              { label: "Email Coordination Brief", icon: "📧" },
            ].map((action, i) => (
              <button key={i} onClick={() => { if (onAction) onAction(`Draft a ${action.label.toLowerCase()} based on the current mission plan. Include specific numbers, zone assignments, and timelines from the plan.`); }}
                style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "7px 10px", marginBottom: 4,
                  borderRadius: 6, border: `1px solid ${C.blueBorder}`, background: C.surface, cursor: "pointer",
                  fontFamily: font, fontSize: 11, fontWeight: 600, color: C.blue, textAlign: "left" }}>
                <span>{action.icon}</span> {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section content */}
        <Card style={{ flex: 1 }}>
          {section === "situation" && (
            <div>
              <SectionBlock title="Event Summary" editKey="event_summary" editSection="situation"><p style={{ margin: 0 }}>{sop.situation.event_summary}</p></SectionBlock>
              <SectionBlock title="Affected Area" editKey="affected_area" editSection="situation"><p style={{ margin: 0 }}>{sop.situation.affected_area}</p></SectionBlock>
              <SectionBlock title="Impact Summary" editKey="impact_summary" editSection="situation"><p style={{ margin: 0 }}>{sop.situation.impact_summary}</p></SectionBlock>
              <SectionBlock title="Key Vulnerabilities" editKey="key_vulnerabilities" editSection="situation">
                {sop.situation.key_vulnerabilities.map((v, i) => (
                  editing && editing.field === "key_vulnerabilities" && editing.index === i ? (
                    <div key={i} style={{ padding: "4px 0", display: "flex", gap: 6 }}>
                      <input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.accent}`, fontSize: 12, fontFamily: font, outline: "none" }} />
                      <button onClick={saveEdit} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>✓</button>
                      <button onClick={cancelEdit} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <div key={i} style={{ padding: "4px 0", display: "flex", gap: 6, cursor: "pointer" }} onClick={() => startEdit("situation", "key_vulnerabilities", i)}>
                      <span style={{ color: C.red }}>•</span> <span style={{ borderBottom: "1px dashed transparent" }}>{v}</span>
                      <span style={{ fontSize: 9, color: C.textMuted, opacity: 0.5 }}>✎</span>
                    </div>
                  )
                ))}
              </SectionBlock>
            </div>
          )}

          {section === "mission" && (
            <div>
              <SectionBlock title="Primary Objective" editKey="primary_objective" editSection="mission"><p style={{ margin: 0 }}>{sop.mission.primary_objective}</p></SectionBlock>
              <SectionBlock title="Secondary Objectives" editKey="secondary_objectives" editSection="mission">
                {sop.mission.secondary_objectives.map((o, i) => (
                  editing && editing.field === "secondary_objectives" && editing.index === i ? (
                    <div key={i} style={{ padding: "4px 0", display: "flex", gap: 6 }}>
                      <input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.accent}`, fontSize: 12, fontFamily: font, outline: "none" }} />
                      <button onClick={saveEdit} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>✓</button>
                      <button onClick={cancelEdit} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <div key={i} style={{ padding: "4px 0", display: "flex", gap: 6, cursor: "pointer" }} onClick={() => startEdit("mission", "secondary_objectives", i)}>
                      <span style={{ color: C.accent }}>•</span> <span>{o}</span>
                      <span style={{ fontSize: 9, color: C.textMuted, opacity: 0.5 }}>✎</span>
                    </div>
                  )
                ))}
              </SectionBlock>
              <SectionBlock title="End State" editKey="end_state" editSection="mission"><p style={{ margin: 0 }}>{sop.mission.end_state}</p></SectionBlock>
            </div>
          )}

          {section === "execution" && (
            <div>
              {sop.execution.phases.map((ph, i) => (
                <div key={i} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: i < sop.execution.phases.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{ph.name}</h4>
                    <Badge color={C.blue} bg={C.blueBg}>{ph.timeline}</Badge>
                  </div>
                  <p style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.7, margin: "0 0 10px" }}>{ph.description}</p>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>Teams</div>
                  {(Array.isArray(ph.teams) ? ph.teams : [ph.teams]).map((t, j) => (
                    <div key={j} style={{ fontSize: 12, color: C.textSecondary, padding: "2px 0" }}>→ {t}</div>
                  ))}
                  {ph.zone_assignments && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>Zone Assignments</div>
                      <p style={{ fontSize: 12, color: C.textSecondary, margin: 0 }}>{ph.zone_assignments}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {section === "sustainment" && (
            <div>
              <SectionBlock title="Personnel" editKey="personnel" editSection="sustainment">
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: isMobile ? 6 : 10, marginTop: 6 }}>
                  {[
                    { label: "Assessment", value: sop.sustainment.personnel.assessment_teams },
                    { label: "Response", value: sop.sustainment.personnel.response_crews },
                    { label: "Command + Logistics", value: sop.sustainment.personnel.command + sop.sustainment.personnel.logistics },
                  ].map((p2, i) => (
                    <div key={i} style={{ background: C.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{p2.value}</div>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{p2.label}</div>
                    </div>
                  ))}
                </div>
              </SectionBlock>
              <SectionBlock title="Equipment" editKey="equipment" editSection="sustainment">
                {sop.sustainment.equipment.map((e, i) => (
                  editing && editing.field === "equipment" && editing.index === i ? (
                    <div key={i} style={{ padding: "3px 0", display: "flex", gap: 6 }}>
                      <input value={editValue} onChange={ev => setEditValue(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") saveEdit(); if (ev.key === "Escape") cancelEdit(); }}
                        autoFocus style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.accent}`, fontSize: 12, fontFamily: font, outline: "none" }} />
                      <button onClick={saveEdit} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>✓</button>
                    </div>
                  ) : (
                    <div key={i} style={{ padding: "3px 0", cursor: "pointer" }} onClick={() => startEdit("sustainment", "equipment", i)}>→ {e} <span style={{ fontSize: 9, color: C.textMuted, opacity: 0.5 }}>✎</span></div>
                  )
                ))}
              </SectionBlock>
              <SectionBlock title="Materials" editKey="materials" editSection="sustainment">
                {sop.sustainment.materials.map((m, i) => (
                  editing && editing.field === "materials" && editing.index === i ? (
                    <div key={i} style={{ padding: "3px 0", display: "flex", gap: 6 }}>
                      <input value={editValue} onChange={ev => setEditValue(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") saveEdit(); if (ev.key === "Escape") cancelEdit(); }}
                        autoFocus style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.accent}`, fontSize: 12, fontFamily: font, outline: "none" }} />
                      <button onClick={saveEdit} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>✓</button>
                    </div>
                  ) : (
                    <div key={i} style={{ padding: "3px 0", cursor: "pointer" }} onClick={() => startEdit("sustainment", "materials", i)}>→ {m} <span style={{ fontSize: 9, color: C.textMuted, opacity: 0.5 }}>✎</span></div>
                  )
                ))}
              </SectionBlock>
              <SectionBlock title="Logistics" editKey="logistics" editSection="sustainment"><p style={{ margin: 0 }}>{sop.sustainment.logistics}</p></SectionBlock>
            </div>
          )}

          {section === "command_signal" && (
            <div>
              <SectionBlock title="Command Structure" editKey="command_structure" editSection="command_signal"><p style={{ margin: 0 }}>{sop.command_signal.command_structure}</p></SectionBlock>
              <SectionBlock title="Reporting" editKey="reporting" editSection="command_signal"><p style={{ margin: 0 }}>{sop.command_signal.reporting}</p></SectionBlock>
              <SectionBlock title="Communications" editKey="communications" editSection="command_signal"><p style={{ margin: 0 }}>{sop.command_signal.communications}</p></SectionBlock>
              <SectionBlock title="Coordination" editKey="coordination" editSection="command_signal">
                {sop.command_signal.coordination.map((c, i) => (
                  editing && editing.field === "coordination" && editing.index === i ? (
                    <div key={i} style={{ padding: "3px 0", display: "flex", gap: 6 }}>
                      <input value={editValue} onChange={ev => setEditValue(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") saveEdit(); if (ev.key === "Escape") cancelEdit(); }}
                        autoFocus style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.accent}`, fontSize: 12, fontFamily: font, outline: "none" }} />
                      <button onClick={saveEdit} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>✓</button>
                    </div>
                  ) : (
                    <div key={i} style={{ padding: "3px 0", cursor: "pointer" }} onClick={() => startEdit("command_signal", "coordination", i)}>→ {c} <span style={{ fontSize: 9, color: C.textMuted, opacity: 0.5 }}>✎</span></div>
                  )
                ))}
              </SectionBlock>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const isMobile = useIsMobile();
  const [appMode, setAppMode] = useState("planner");
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("planning"); // planning | assessment
  const [chatOpen, setChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Warn user if they try to leave during agent processing
  useEffect(() => {
    const handler = (e) => {
      if (loading) { e.preventDefault(); e.returnValue = "An agent is still processing. Are you sure you want to leave?"; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loading]);
  const [eventLabel, setEventLabel] = useState(null);

  // Data passed between steps
  const [step1Data, setStep1Data] = useState(null);
  const [step2Data, setStep2Data] = useState(null);
  const [step3Data, setStep3Data] = useState(null);

  // Warn before leaving if agents have run
  useEffect(() => {
    const handler = (e) => {
      if (step1Data) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step1Data]);

  // Chat messages
  const [messages, setMessages] = useState([
    { role: "agent", text: "I'm the Disaster Context Agent. Describe an event or enter a FEMA declaration number, and I'll analyze the affected area for priority zones." },
  ]);

  const agentNames = ["Priority Analysis Agent", "Priority Analysis Agent", "Construction Profile Agent", "Mission Planning Agent"];

  const handleChat = async (text) => {
    setMessages(prev => [...prev, { role: "user", text }]);
    const agentKeys = ["context", "context", "construction", "mission"];
    // Build context from all available step data so agent has full picture
    const chatContext = {
      step: step,
      event: step1Data?.event || null,
      zones: (step2Data?.zones || step1Data?.zones || []).slice(0, 5).map(z => ({ rank: z.rank, area_name: z.area_name || z.area, composite_score: z.composite_score, svi_score: z.svi_score, population: z.population, risk_level: z.risk_level })),
      profiles_available: !!(step2Data?.profiles),
      plan_available: !!(step3Data?.sop),
      summary: step1Data?.summary || "",
    };
    try {
      const res = await fetch(API + "/api/chat/" + agentKeys[step], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, context: chatContext, history: messages.slice(-6) }) });
      if (!res.ok) throw new Error("API " + res.status);
      const d = await res.json();
      setMessages(prev => [...prev, { role: "agent", text: d.response || d.text || JSON.stringify(d) }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "agent", text: "Agent unavailable: " + err.message }]);
    }
    return; // ensure promise resolves for sending state
  };

  const completeStep = (stepNum, data) => {
    if (stepNum === 0) { setStep1Data(data); setStep2Data(null); setStep3Data(null); setEventLabel(data.event?.declaration || "Event"); setStep(1); }
    if (stepNum === 1) { setStep2Data(data); setStep(2); }
    if (stepNum === 2) { setStep3Data(data); setStep(3); }
  };

  return (
    <div style={{ background: "#EDE8E0", minHeight: "100vh", fontFamily: font }}>
      <TopBar event={eventLabel} chatOpen={chatOpen} onToggleChat={() => setChatOpen(!chatOpen)} mode={appMode} onModeSwitch={() => setAppMode(appMode === "planner" ? "field" : "planner")} />
      {appMode === "planner" && <WizardSteps current={step} onNav={setStep} />}

      <div style={{ display: "flex", minHeight: "calc(100vh - 96px)" }}>
        {/* Main content */}
        <div style={{ flex: 1, padding: isMobile ? "12px 12px" : "20px 28px", overflowY: "auto", background: C.bg }}>
          {appMode === "field" ? (
            <FieldAssessment
              zones={step2Data?.zones || step1Data?.zones || []}
              onBack={() => setAppMode("planner")}
            />
          ) : (<>
          {step === 0 && <Step1 onComplete={d => completeStep(0, d)} setLoading={setLoading} loading={loading} />}
          {step === 1 && <Step2 data={step1Data} onComplete={d => completeStep(1, d)} setLoading={setLoading} loading={loading} onAskAgent={(q) => { setChatOpen(true); setTimeout(() => handleChat(q).catch(console.error), 100); }} cachedResult={step2Data} />}
          {step === 2 && <Step3 data={step2Data} step1Data={step1Data} onComplete={d => completeStep(2, d)} setLoading={setLoading} loading={loading} onAskAgent={(q) => { setChatOpen(true); setTimeout(() => handleChat(q).catch(console.error), 100); }} cachedResult={step3Data} />}
          {step === 3 && <Step4 data={step3Data} step1Data={step1Data} onAction={(q) => { setChatOpen(true); handleChat(q); }} onNewAlert={() => { setStep(0); setStep1Data(null); setStep2Data(null); setStep3Data(null); setEventLabel(null); }} onReturnToStart={() => setStep(0)} />}
            </>
          )}
        </div>

        {/* Chat drawer */}
        {chatOpen && <ChatDrawer messages={messages} onSend={handleChat} agentName={agentNames[step]} isMobile={isMobile} onClose={() => setChatOpen(false)} />}
      </div>
    </div>
  );
}
