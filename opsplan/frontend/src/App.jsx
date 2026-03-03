import { useState, useEffect, useRef } from "react";

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
const API = ""; // Vite proxy routes /api/* to backend // Change to Azure URL in production

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
    border: primary ? "none" : `1px solid ${C.border}`, fontFamily: font, fontSize: small ? 11 : 12, fontWeight: 600,
    background: disabled ? C.surfaceMuted : primary ? C.accent : C.surface,
    color: disabled ? C.textMuted : primary ? "#fff" : C.textSecondary,
    opacity: disabled ? 0.6 : 1, transition: "all 0.15s", ...s,
  }}>{children}</button>
);

const Card = ({ children, style: s }) => (
  <div style={{ background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16, ...s }}>{children}</div>
);

const Badge = ({ children, color, bg }) => (
  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600, color, background: bg }}>{children}</span>
);

const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 20, justifyContent: "center" }}>
    <div style={{ width: 18, height: 18, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <span style={{ fontSize: 12, color: C.textMuted }}>Agent processing...</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
);

// ============================================================
// TOP BAR
// ============================================================
const TopBar = ({ event, chatOpen, onToggleChat }) => (
  <div style={{ padding: "10px 20px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>O</div>
      <span style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: font }}>OpsPlan</span>
      {event && <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 8, padding: "2px 8px", background: C.surfaceMuted, borderRadius: 4 }}>{event}</span>}
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: C.greenBg, color: C.green, fontWeight: 600 }}>Demo Mode</span>
      <button onClick={onToggleChat} style={{
        padding: "6px 14px", borderRadius: 6, border: `1px solid ${chatOpen ? C.accent : C.border}`,
        background: chatOpen ? C.accentBg : C.surface, color: chatOpen ? C.accent : C.textSecondary,
        fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font,
      }}>💬 Agent Chat {chatOpen ? "✕" : ""}</button>
    </div>
  </div>
);

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
    <div style={{ padding: "12px 24px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center" }}>
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
const ChatDrawer = ({ messages, onSend, agentName }) => {
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => { if (input.trim()) { onSend(input.trim()); setInput(""); } };

  return (
    <div style={{ width: 320, borderLeft: `1px solid ${C.border}`, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: font }}>Agent Chat</div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>Talking to: {agentName || "Disaster Context Agent"}</div>
      </div>
      <div style={{ flex: 1, padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
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
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about the analysis..." style={{
          flex: 1, padding: "9px 12px", borderRadius: 6, border: `1px solid ${C.border}`,
          background: C.bg, color: C.text, fontSize: 12, outline: "none", fontFamily: font,
        }} />
        <Btn primary small onClick={send}>Send</Btn>
      </div>
    </div>
  );
};

// ============================================================
// STEP 1 — DEFINE EVENT
// ============================================================
const Step1 = ({ onComplete, setLoading, loading }) => {
  const [mode, setMode] = useState("fema"); // fema | location | text
  const [femaNum, setFemaNum] = useState("DR-4332-TX");
  const [locState, setLocState] = useState("Texas");
  const [locCounties, setLocCounties] = useState("Aransas, Refugio");
  const [eventType, setEventType] = useState("Hurricane");
  const [freeText, setFreeText] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  const submit = () => {
    setLoading(true);
    // In production: POST to /api/events/analyze
    // Demo mode: simulate a 2-second delay then return mock data
    setTimeout(() => {
      setLoading(false);
      onComplete({
        event: { type: eventType, name: "Harvey", declaration: femaNum, affected_counties: locCounties.split(",").map(s => s.trim()) },
        zones: MOCK_ZONES,
        scoring_weights: { svi: 0.30, nri: 0.30, housing_vulnerability: 0.25, population_density: 0.15 },
        summary: `5 zones analyzed across ${locCounties}. 2 Critical, 2 High, 1 Moderate.`,
      });
    }, 2200);
  };

  const prefill = () => {
    setPrefilled(true); setMode("fema"); setFemaNum("DR-4332-TX"); setLocState("Texas");
    setLocCounties("Aransas, Refugio, Calhoun, Victoria, San Patricio"); setEventType("Hurricane");
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {!prefilled && (
        <Card style={{ marginBottom: 16, background: C.accentBg, borderColor: C.accentBorder }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>⚡ Weather Sentinel Alert</div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 4 }}>Hurricane Harvey — Cat 4 projected landfall TX coast</div>
              <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>5 counties, ~45,200 structures, ~128,000 population at risk</div>
            </div>
            <Btn primary small onClick={prefill}>Pre-fill from Alert →</Btn>
          </div>
        </Card>
      )}

      {prefilled && (
        <div style={{ padding: "8px 14px", background: C.greenBg, borderRadius: 6, border: `1px solid ${C.greenBorder}`, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C.green, fontWeight: 600, fontSize: 12 }}>✓ Pre-filled from Weather Sentinel Alert</span>
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
                <input value={femaNum} onChange={e => setFemaNum(e.target.value)} placeholder="DR-4332-TX"
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, outline: "none", color: C.text }} />
                {prefilled && <Badge color={C.green} bg={C.greenBg}>AUTO</Badge>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>Event Type</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, background: C.surface, color: C.text }}>
                  {["Hurricane", "Tornado", "Flood", "Earthquake", "Wildfire", "Winter Storm", "Other"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>State</label>
                <input value={locState} onChange={e => setLocState(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, outline: "none", color: C.text, boxSizing: "border-box" }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 4 }}>Affected Counties</label>
              <input value={locCounties} onChange={e => setLocCounties(e.target.value)} placeholder="Aransas, Refugio, Calhoun"
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
                  {["Hurricane", "Tornado", "Flood", "Earthquake", "Wildfire", "Winter Storm", "Other"].map(t => <option key={t}>{t}</option>)}
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

      {loading ? <Spinner /> : (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn primary onClick={submit}>Run Disaster Context Agent →</Btn>
        </div>
      )}
    </div>
  );
};

// ============================================================
// STEP 2 — PRIORITY ANALYSIS
// ============================================================
const Step2 = ({ data, onComplete, setLoading, loading }) => {
  const [selected, setSelected] = useState(0);
  const zones = data?.zones || MOCK_ZONES;
  const z = zones[selected];

  const approve = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); onComplete({ zones, profiles: MOCK_PROFILES }); }, 1800);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, fontFamily: font }}>Priority Analysis</h2>
          <p style={{ fontSize: 12, color: C.textMuted, margin: "3px 0 0" }}>{zones.length} zones ranked — click a row to see details</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn>Adjust Weights</Btn>
          {loading ? <Spinner /> : <Btn primary onClick={approve}>Approve Rankings →</Btn>}
        </div>
      </div>

      {/* Data Table */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {["", "Zone", "Score", "SVI", "NRI", "Pop.", "Structures", "Est. Cost", "Risk"].map(h => (
                <th key={h} style={{ padding: "8px", textAlign: "left", fontSize: 9, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((zn, i) => (
              <tr key={i} onClick={() => setSelected(i)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected === i ? C.accentBg : "transparent" }}>
                <td style={{ padding: "9px 8px", fontWeight: 700, color: C.textMuted, fontSize: 11 }}>#{zn.rank}</td>
                <td style={{ padding: "9px 8px" }}>
                  <div style={{ fontWeight: 600, color: C.text }}>{zn.area}</div>
                  <div style={{ fontSize: 9, color: C.textMuted }}>{zn.fips_tract}</div>
                </td>
                <td style={{ padding: "9px 8px", fontWeight: 700, fontSize: 14 }}>{zn.composite_score}</td>
                <td style={{ padding: "9px 8px", color: C.textSecondary }}>{Math.round(zn.svi_score * 100)}%</td>
                <td style={{ padding: "9px 8px", color: C.textSecondary }}>{Math.round(zn.nri_score * 100)}%</td>
                <td style={{ padding: "9px 8px", color: C.textSecondary }}>{zn.population?.toLocaleString()}</td>
                <td style={{ padding: "9px 8px", color: C.textSecondary }}>{zn.total_structures?.toLocaleString()}</td>
                <td style={{ padding: "9px 8px", color: C.textSecondary }}>{zn.est_cost}</td>
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
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0, fontFamily: font }}>Zone #{z.rank} — {z.area}</h3>
            <span style={{ fontSize: 10, color: C.textMuted }}>{z.fips_tract}</span>
          </div>
          <Badge color={riskColor(z.risk_level)} bg={riskBg(z.risk_level)}>{z.risk_level} — Score {z.composite_score}</Badge>
        </div>

        {/* Metric cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Population", value: z.population?.toLocaleString(), sub: `${z.households?.toLocaleString()} households` },
            { label: "Structures", value: z.total_structures?.toLocaleString(), sub: `${z.manufactured_pct}% manufactured` },
            { label: "Est. Replacement", value: z.est_cost, sub: `${z.cost_sqft}/sqft avg` },
            { label: "Pre-1980 Stock", value: `${z.pre1980_pct}%`, sub: "of all structures" },
          ].map((m, i) => (
            <div key={i} style={{ background: C.bg, borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: C.textSecondary }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Vulnerability bars + Agent callout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 10 }}>Vulnerability Breakdown</div>
            {[
              { label: "Social Vulnerability (SVI)", value: Math.round(z.svi_score * 100), color: C.red },
              { label: "Natural Hazard Risk (NRI)", value: Math.round(z.nri_score * 100), color: C.accent },
              { label: "Housing Vulnerability", value: Math.round(z.housing_vulnerability * 100), color: C.yellow },
            ].map((b, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: C.textSecondary }}>{b.label}</span>
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
const Step3 = ({ data, onComplete, setLoading, loading }) => {
  const [selectedZone, setSelectedZone] = useState(0);
  const [tab, setTab] = useState("structural");
  const profiles = data?.profiles || MOCK_PROFILES;
  const p = profiles[selectedZone];

  const approve = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); onComplete({ sop: MOCK_SOP }); }, 2500);
  };

  const tabs = [
    { id: "structural", label: "Structural" },
    { id: "exterior", label: "Exterior Envelope" },
    { id: "site", label: "Site & Hazard" },
    { id: "financial", label: "Financial" },
    { id: "demographics", label: "Demographics" },
  ];

  const DataRow = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <span style={{ color: C.textSecondary }}>{label}</span>
      <span style={{ fontWeight: 600, color: C.text, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>Construction Profiles</h2>
          <p style={{ fontSize: 12, color: C.textMuted, margin: "3px 0 0" }}>Detailed structural data for each priority zone</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {loading ? <Spinner /> : <Btn primary onClick={approve}>Approve Profiles →</Btn>}
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
          }}>#{i + 1} {pr.zone_name.split("—")[0].trim()}</button>
        ))}
      </div>

      <Card>
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>{p.zone_name}</h3>
          <span style={{ fontSize: 10, color: C.textMuted }}>{p.zone_fips}</span>
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

        {tab === "structural" && (
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
        {tab === "exterior" && (
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
        {tab === "site" && (
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
        {tab === "financial" && (
          <div>
            <DataRow label="Median Home Value" value={p.financial.median_value} />
            <DataRow label="Replacement Cost (SF)" value={p.financial.replacement_sf} />
            <DataRow label="Replacement Cost (Manufactured)" value={p.financial.replacement_mfg} />
            <DataRow label="Est. Total Replacement" value={p.financial.replacement_total} />
            <DataRow label="Flood Insurance Penetration" value={p.financial.flood_insurance} />
            <DataRow label="Est. Uninsured" value={p.financial.uninsured_est} />
          </div>
        )}
        {tab === "demographics" && (
          <div>
            <DataRow label="Median Age" value={p.demographics.median_age} />
            <DataRow label="Age 65+" value={p.demographics.age_65_plus} />
            <DataRow label="Disability Rate" value={p.demographics.disability} />
            <DataRow label="Below Poverty" value={p.demographics.below_poverty} />
            <DataRow label="Limited English" value={p.demographics.limited_english} />
            <DataRow label="No Vehicle" value={p.demographics.no_vehicle} />
          </div>
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
const Step4 = ({ data }) => {
  const [section, setSection] = useState("situation");
  const sop = data?.sop || MOCK_SOP;

  const sections = [
    { id: "situation", label: "I. Situation", icon: "📋" },
    { id: "mission", label: "II. Mission", icon: "🎯" },
    { id: "execution", label: "III. Execution", icon: "⚡" },
    { id: "sustainment", label: "IV. Sustainment", icon: "📦" },
    { id: "command_signal", label: "V. Command & Signal", icon: "📡" },
  ];

  const SectionBlock = ({ title, children }) => (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 8px", fontFamily: font }}>{title}</h4>
      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.7 }}>{children}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>Mission Plan — SOP</h2>
          <p style={{ fontSize: 12, color: C.textMuted, margin: "3px 0 0" }}>Team Rubicon 5-Paragraph Operations Order</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn>Edit Section</Btn>
          <Btn primary>Export .docx ↓</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Section nav */}
        <div style={{ width: 200, flexShrink: 0 }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              width: "100%", padding: "10px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: font,
              display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
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
        </div>

        {/* Section content */}
        <Card style={{ flex: 1 }}>
          {section === "situation" && (
            <div>
              <SectionBlock title="Event Summary"><p style={{ margin: 0 }}>{sop.situation.event_summary}</p></SectionBlock>
              <SectionBlock title="Affected Area"><p style={{ margin: 0 }}>{sop.situation.affected_area}</p></SectionBlock>
              <SectionBlock title="Impact Summary"><p style={{ margin: 0 }}>{sop.situation.impact_summary}</p></SectionBlock>
              <SectionBlock title="Key Vulnerabilities">
                {sop.situation.key_vulnerabilities.map((v, i) => (
                  <div key={i} style={{ padding: "4px 0", display: "flex", gap: 6 }}>
                    <span style={{ color: C.red }}>•</span> {v}
                  </div>
                ))}
              </SectionBlock>
            </div>
          )}

          {section === "mission" && (
            <div>
              <SectionBlock title="Primary Objective"><p style={{ margin: 0 }}>{sop.mission.primary_objective}</p></SectionBlock>
              <SectionBlock title="Secondary Objectives">
                {sop.mission.secondary_objectives.map((o, i) => (
                  <div key={i} style={{ padding: "4px 0", display: "flex", gap: 6 }}><span style={{ color: C.accent }}>•</span> {o}</div>
                ))}
              </SectionBlock>
              <SectionBlock title="End State"><p style={{ margin: 0 }}>{sop.mission.end_state}</p></SectionBlock>
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
              <SectionBlock title="Personnel">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 6 }}>
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
              <SectionBlock title="Equipment">
                {sop.sustainment.equipment.map((e, i) => <div key={i} style={{ padding: "3px 0" }}>→ {e}</div>)}
              </SectionBlock>
              <SectionBlock title="Materials">
                {sop.sustainment.materials.map((m, i) => <div key={i} style={{ padding: "3px 0" }}>→ {m}</div>)}
              </SectionBlock>
              <SectionBlock title="Logistics"><p style={{ margin: 0 }}>{sop.sustainment.logistics}</p></SectionBlock>
            </div>
          )}

          {section === "command_signal" && (
            <div>
              <SectionBlock title="Command Structure"><p style={{ margin: 0 }}>{sop.command_signal.command_structure}</p></SectionBlock>
              <SectionBlock title="Reporting"><p style={{ margin: 0 }}>{sop.command_signal.reporting}</p></SectionBlock>
              <SectionBlock title="Communications"><p style={{ margin: 0 }}>{sop.command_signal.communications}</p></SectionBlock>
              <SectionBlock title="Coordination">
                {sop.command_signal.coordination.map((c, i) => <div key={i} style={{ padding: "3px 0" }}>→ {c}</div>)}
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
  const [step, setStep] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eventLabel, setEventLabel] = useState(null);

  // Data passed between steps
  const [step1Data, setStep1Data] = useState(null);
  const [step2Data, setStep2Data] = useState(null);
  const [step3Data, setStep3Data] = useState(null);

  // Chat messages
  const [messages, setMessages] = useState([
    { role: "agent", text: "I'm the Disaster Context Agent. Describe an event or enter a FEMA declaration number, and I'll analyze the affected area for priority zones." },
  ]);

  const agentNames = ["Disaster Context Agent", "Disaster Context Agent", "Construction Profile Agent", "Mission Planning Agent"];

  const handleChat = (text) => {
    setMessages(prev => [...prev, { role: "user", text }]);
    // In production: POST to /api/chat/{agent_name}
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "agent", text: "I understand your question. In the full deployment, this message would come from the Semantic Kernel agent running on Azure OpenAI. For now, this is demo mode — all data is pre-loaded from Hurricane Harvey (2017) analysis." }]);
    }, 800);
  };

  const completeStep = (stepNum, data) => {
    if (stepNum === 0) { setStep1Data(data); setEventLabel(data.event?.declaration || "Event"); setStep(1); }
    if (stepNum === 1) { setStep2Data(data); setStep(2); }
    if (stepNum === 2) { setStep3Data(data); setStep(3); }
  };

  return (
    <div style={{ background: "#EDE8E0", minHeight: "100vh", fontFamily: font }}>
      <TopBar event={eventLabel} chatOpen={chatOpen} onToggleChat={() => setChatOpen(!chatOpen)} />
      <WizardSteps current={step} onNav={setStep} />

      <div style={{ display: "flex", minHeight: "calc(100vh - 96px)" }}>
        {/* Main content */}
        <div style={{ flex: 1, padding: "20px 28px", overflowY: "auto", background: C.bg }}>
          {step === 0 && <Step1 onComplete={d => completeStep(0, d)} setLoading={setLoading} loading={loading} />}
          {step === 1 && <Step2 data={step1Data} onComplete={d => completeStep(1, d)} setLoading={setLoading} loading={loading} />}
          {step === 2 && <Step3 data={step2Data} onComplete={d => completeStep(2, d)} setLoading={setLoading} loading={loading} />}
          {step === 3 && <Step4 data={step3Data} />}
        </div>

        {/* Chat drawer */}
        {chatOpen && <ChatDrawer messages={messages} onSend={handleChat} agentName={agentNames[step]} />}
      </div>
    </div>
  );
}
