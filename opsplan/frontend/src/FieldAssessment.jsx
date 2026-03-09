/**
 * FieldAssessment.jsx — Part 2: Mobile Field Assessment
 * 
 * 6-screen flow:
 * 1. Select Zone — pick from active mission zones
 * 2. Capture Photo — camera/gallery upload
 * 3. AI Analysis — Azure AI Vision damage classification (auto-runs)
 * 4. Tag & Annotate — add hazard/damage tags, notes
 * 5. Review & Submit — confirm and save
 * 6. Summary — assessment saved, option for another
 */
import { useState, useRef } from "react";

const API = "https://opsplan-api.blackgrass-5f5980e2.eastus.azurecontainerapps.io"; // Production Azure Container App

const C = {
  bg: "#EDE8E0", surface: "#FAFAF8", surfaceMuted: "#F3F0EB",
  border: "#D6D0C4", text: "#2C2825", textSecondary: "#6B6560", textMuted: "#9E9890",
  accent: "#B45309", accentBg: "#FEF3E2", accentBorder: "#FDE8C8",
  green: "#16A34A", greenBg: "#F0FDF4", greenBorder: "#BBF7D0",
  red: "#DC2626", redBg: "#FEF2F2", redBorder: "#FECACA",
  blue: "#2563EB", blueBg: "#EFF6FF", blueBorder: "#BFDBFE",
  yellow: "#CA8A04", yellowBg: "#FEFCE8",
};
const font = `"Segoe UI",-apple-system,BlinkMacSystemFont,sans-serif`;

const DAMAGE_COLORS = {
  destroyed: "#991B1B", major: "#DC2626", minor: "#CA8A04",
  affected: "#2563EB", none: "#16A34A", unknown: "#9E9890",
};

const HAZARD_OPTIONS = [
  "Downed power lines", "Gas leak / odor", "Standing water / flooding",
  "Structural collapse risk", "Mold / mildew", "Asbestos risk (pre-1980)",
  "Loose debris / glass", "Tree on structure", "Fire damage",
  "Sewage / contamination", "Animal hazard", "Chemical spill",
];

const DAMAGE_TAGS = [
  "Roof — missing shingles", "Roof — structural failure", "Roof — tarp needed",
  "Windows — broken", "Siding — stripped", "Foundation — cracking",
  "Foundation — shifting", "Interior — water damage", "Interior — mold",
  "Utility — electrical", "Utility — plumbing", "Utility — HVAC",
];

// ---- Shared UI components ----

const Btn = ({ primary, danger, small, disabled, onClick, children, style }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: small ? "6px 12px" : "10px 20px",
      borderRadius: 8,
      border: primary ? "none" : danger ? `1px solid ${C.red}` : `1px solid ${C.border}`,
      background: disabled ? C.surfaceMuted : primary ? C.accent : danger ? C.redBg : C.surface,
      color: disabled ? C.textMuted : primary ? "#fff" : danger ? C.red : C.text,
      fontWeight: 600, fontSize: small ? 11 : 13, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: font, transition: "all 0.15s", ...style,
    }}
  >
    {children}
  </button>
);

const Card = ({ children, style }) => (
  <div style={{
    background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`,
    padding: 16, ...style,
  }}>
    {children}
  </div>
);

const ScreenTitle = ({ step, total, title, subtitle }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
      Step {step} of {total}
    </div>
    <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 4px", fontFamily: font }}>{title}</h2>
    {subtitle && <p style={{ fontSize: 12, color: C.textSecondary, margin: 0 }}>{subtitle}</p>}
  </div>
);

// ---- Screen 1: Select Zone ----

const SelectZone = ({ zones, onSelect, onViewHistory }) => {
  if (!zones || zones.length === 0) {
    return (
      <Card>
        <ScreenTitle step={1} total={6} title="Select Zone" subtitle="No active zones. Run the planning wizard (Part 1) first to create zones." />
        <p style={{ color: C.textMuted, fontSize: 13 }}>Switch to the Mission Planner tab to analyze an event and generate priority zones.</p>
      </Card>
    );
  }

  return (
    <div>
      <ScreenTitle step={1} total={6} title="Select Zone" subtitle="Choose the zone you're assessing in the field." />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {zones.map((z, i) => (
          <Card
            key={z.fips_tract || i}
            style={{ cursor: "pointer", borderLeft: `4px solid ${z.composite_score > 60 ? C.red : z.composite_score > 40 ? C.yellow : C.green}` }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div onClick={() => onSelect(z)} style={{ flex: 1, cursor: "pointer" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  #{z.rank || i + 1} — {z.area_name || z.zone_name || z.fips_tract}
                </div>
                <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                  SVI: {z.svi_score?.toFixed(2) || "—"} &nbsp;|&nbsp; Score: {z.composite_score?.toFixed(1) || "—"} &nbsp;|&nbsp; Pop: {(z.population || 0).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {onViewHistory && (
                  <button onClick={(e) => { e.stopPropagation(); onViewHistory(z); }}
                    style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surfaceMuted, color: C.textSecondary, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
                    📋 History
                  </button>
                )}
                <span onClick={() => onSelect(z)} style={{ fontSize: 18, color: C.textMuted, cursor: "pointer" }}>&rsaquo;</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ---- Screen 2: Capture Photo ----

const CapturePhoto = ({ zone, onCapture, onBack }) => {
  const fileRef = useRef(null);
  const [photos, setPhotos] = useState([]); // [{preview, data, contentType, id}]

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = ev.target.result.split(",")[1];
        setPhotos(prev => [...prev, {
          id: Date.now() + Math.random(),
          preview: ev.target.result,
          data: b64,
          contentType: file.type || "image/jpeg",
          name: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = ""; // reset so same file can be re-selected
  };

  const removePhoto = (id) => setPhotos(prev => prev.filter(p => p.id !== id));

  return (
    <div>
      <ScreenTitle
        step={2} total={6}
        title="Capture Photos"
        subtitle={`Zone: ${zone.area_name || zone.zone_name || zone.fips_tract}`}
      />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 8 }}>
            {photos.map(p => (
              <div key={p.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, aspectRatio: "4/3" }}>
                <img src={p.preview} alt="Photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => removePhoto(p.id)} style={{
                  position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, lineHeight: "22px",
                }}>✕</button>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 8px",
                  background: "linear-gradient(transparent, rgba(0,0,0,0.6))", fontSize: 9, color: "#fff" }}>
                  {p.name?.substring(0, 20) || "Photo"}
                </div>
              </div>
            ))}
            {/* Add more button as a grid cell */}
            <div onClick={() => { fileRef.current.removeAttribute("capture"); fileRef.current.click(); }}
              style={{ borderRadius: 8, border: `2px dashed ${C.border}`, aspectRatio: "4/3", display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: C.surfaceMuted }}>
              <div style={{ fontSize: 24, color: C.textMuted }}>+</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Add Photo</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.textSecondary }}>{photos.length} photo{photos.length > 1 ? "s" : ""} — multiple angles recommended for best AI assessment</div>
        </div>
      )}

      {/* Empty state */}
      {photos.length === 0 && (
        <Card style={{ textAlign: "center", padding: 40, marginBottom: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
          <p style={{ color: C.textSecondary, fontSize: 13, marginBottom: 4 }}>
            Take photos of the structure from multiple angles.
          </p>
          <p style={{ color: C.textMuted, fontSize: 11, marginBottom: 16 }}>
            Front, sides, roof line, and any visible damage. More photos = better AI assessment.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Btn primary onClick={() => { fileRef.current.setAttribute("capture", "environment"); fileRef.current.click(); }}>
              Take Photo
            </Btn>
            <Btn onClick={() => { fileRef.current.removeAttribute("capture"); fileRef.current.click(); }}>
              Choose from Gallery
            </Btn>
          </div>
        </Card>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />

      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={onBack}>← Back</Btn>
        <Btn primary disabled={photos.length === 0} onClick={() => onCapture(photos[0].data, photos[0].contentType, photos)} style={{ flex: 1 }}>
          Analyze {photos.length} Photo{photos.length !== 1 ? "s" : ""} →
        </Btn>
      </div>

      <div style={{ marginTop: 12 }}>
        <Btn small onClick={onBack}>&larr; Back to zone selection</Btn>
      </div>
    </div>
  );
};

// ---- Screen 3: AI Analysis (auto-runs) ----

const AIAnalysis = ({ zone, imageData, contentType, allPhotos, onResult, onRetake }) => {
  const [status, setStatus] = useState("analyzing");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [approvedFindings, setApprovedFindings] = useState({});
  const ranRef = useRef(false);

  useState(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        let data;
        // If multiple photos, use multi-photo endpoint
        if (allPhotos && allPhotos.length > 1) {
          const images = allPhotos.map(p => ({ image: p.data, content_type: p.contentType || "image/jpeg" }));
          const res = await fetch(API + "/api/assess/photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images }),
          });
          if (!res.ok) throw new Error("API error " + res.status);
          data = await res.json();
        } else {
          const res = await fetch(API + "/api/assess/photo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageData, content_type: contentType }),
          });
          if (!res.ok) throw new Error("API error " + res.status);
          data = await res.json();
        }
        if (data.error && !data.damage_classification) {
          throw new Error(data.error);
        }
        setResult(data);
        setStatus(data.structure_detected === false ? "no_structure" : "complete");
      } catch (err) {
        setError(err.message);
        setStatus("error");
      }
    })();
  });

  const dmgColor = result ? (DAMAGE_COLORS[result.damage_classification] || C.textMuted) : C.textMuted;

  if (status === "analyzing") {
    return (
      <div>
        <ScreenTitle step={3} total={6} title="AI Analysis" subtitle="Azure AI Vision is analyzing the photo..." />
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, border: `4px solid ${C.border}`, borderTop: `4px solid ${C.accent}`,
              borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
          <p style={{ color: C.textSecondary, fontSize: 13 }}>Classifying structural damage{allPhotos && allPhotos.length > 1 ? ` across ${allPhotos.length} photos` : ""}...</p>
          <p style={{ color: C.textMuted, fontSize: 11 }}>This typically takes 5-15 seconds</p>
        </Card>
      </div>
    );
  }

  if (status === "no_structure") {
    return (
      <div>
        <ScreenTitle step={3} total={6} title="No Structure Detected" subtitle="The AI could not find a building in this image." />
        <Card style={{ background: C.yellowBg, borderColor: "#FDE68A" }}>
          <div style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>🏗️</div>
          <p style={{ color: C.yellow, fontWeight: 600, fontSize: 13, textAlign: "center" }}>No man-made structure was detected in this photo.</p>
          <p style={{ color: C.textSecondary, fontSize: 12, textAlign: "center" }}>Please retake the photo with the building clearly visible. Make sure the structure fills most of the frame.</p>
        </Card>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn primary onClick={onRetake}>← Retake Photo</Btn>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div>
        <ScreenTitle step={3} total={6} title="AI Analysis" subtitle="Analysis could not be completed." />
        <Card style={{ background: C.redBg, borderColor: C.redBorder }}>
          <p style={{ color: C.red, fontWeight: 600, fontSize: 13 }}>{error}</p>
          <p style={{ color: C.textSecondary, fontSize: 12 }}>You can retake the photo or continue with manual assessment.</p>
        </Card>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn onClick={onRetake}>Retake Photo</Btn>
          <Btn primary onClick={() => { setResult(_manualFallback()); setStatus("complete"); }}>Continue Manually</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenTitle step={3} total={6} title="AI Analysis Complete" subtitle={result._mock ? "Demo mode — mock classification" : `Confidence: ${((result.confidence || 0) * 100).toFixed(0)}% — ${(result.confidence || 0) >= 0.9 ? "High certainty (clear full view)" : (result.confidence || 0) >= 0.7 ? "Good assessment (partial view)" : (result.confidence || 0) >= 0.5 ? "Moderate certainty (limited view)" : "Low certainty — consider re-assessment"}`} />

      {/* Photo with AI overlay annotations */}
      {imageData && (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 12, background: "#000" }}>
          <img src={`data:image/jpeg;base64,${imageData}`} alt="Analyzed" style={{ width: "100%", maxHeight: 350, objectFit: "contain", display: "block" }} />
          {/* Overlay annotations for each component with damage */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            {Object.entries(result.components || {}).map(([key, val], i) => {
              if (val.damage === "none" || val.damage === "unknown") return null;
              const lvlColor = DAMAGE_COLORS[val.damage === "severe" ? "major" : val.damage] || C.textMuted;
              // Position annotations at different spots on the image
              const positions = { roof: { top: "8%", left: "30%" }, walls: { top: "45%", left: "5%" }, foundation: { top: "80%", left: "20%" }, windows: { top: "40%", right: "5%" }, utilities: { top: "15%", right: "8%" } };
              const pos = positions[key] || { top: `${20 + i * 18}%`, left: "10%" };
              return (
                <div key={key} style={{ position: "absolute", ...pos, background: lvlColor + "DD", color: "#fff", padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", pointerEvents: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
                  {key}: {val.damage}
                </div>
              );
            })}
          </div>
          {allPhotos && allPhotos.length > 1 && (
            <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "3px 8px", borderRadius: 4, fontSize: 10 }}>
              {allPhotos.length} photos analyzed
            </div>
          )}
        </div>
      )}

      {/* Overall classification banner */}
      <Card style={{ background: dmgColor + "12", borderColor: dmgColor + "40", borderLeft: `5px solid ${dmgColor}`, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Damage Classification</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: dmgColor, textTransform: "uppercase", marginTop: 2 }}>
              {result.damage_classification}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Damage %</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: dmgColor }}>{result.damage_percentage}%</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 8, lineHeight: 1.6 }}>{result.summary}</p>
      </Card>

      {/* Component breakdown — approve/reject each finding */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 4 }}>Component Damage — Review & Approve</div>
        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 10 }}>Toggle each finding to approve (✓) or reject (✕) the AI classification.</div>
        {Object.entries(result.components || {}).map(([key, val]) => {
          const lvlColor = DAMAGE_COLORS[val.damage === "severe" ? "major" : val.damage] || C.textMuted;
          const approved = approvedFindings[key] !== false; // default to approved
          return (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}`, opacity: approved ? 1 : 0.45 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, color: C.text, fontWeight: 600, textTransform: "capitalize" }}>{key.replace("_", " ")}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: lvlColor, textTransform: "uppercase", marginLeft: 8 }}>{val.damage}</span>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{val.notes}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setApprovedFindings(prev => ({ ...prev, [key]: true }))}
                  style={{ width: 28, height: 28, borderRadius: 6, border: `2px solid ${approved ? C.green : C.border}`, background: approved ? C.greenBg : "transparent", color: approved ? C.green : C.textMuted, cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</button>
                <button onClick={() => setApprovedFindings(prev => ({ ...prev, [key]: false }))}
                  style={{ width: 28, height: 28, borderRadius: 6, border: `2px solid ${!approved ? C.red : C.border}`, background: !approved ? C.redBg : "transparent", color: !approved ? C.red : C.textMuted, cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Hazards */}
      {result.hazards?.length > 0 && (
        <Card style={{ marginBottom: 12, background: C.yellowBg }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.yellow, textTransform: "uppercase", marginBottom: 6 }}>⚠ Hazards Detected</div>
          {result.hazards.map((h, i) => (
            <div key={i} style={{ fontSize: 12, color: C.text, padding: "3px 0" }}>• {h}</div>
          ))}
        </Card>
      )}

      {/* Recommended actions */}
      {result.recommended_actions?.length > 0 && (
        <Card style={{ marginBottom: 12, background: C.accentBg }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", marginBottom: 6 }}>Recommended Actions</div>
          {result.recommended_actions.map((a, i) => (
            <div key={i} style={{ fontSize: 12, color: C.text, padding: "3px 0" }}>{i + 1}. {a}</div>
          ))}
        </Card>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={onRetake}>Retake Photos</Btn>
        <Btn onClick={() => {
          const payload = { ...result, timestamp: new Date().toISOString() };
          fetch(API + "/api/assess/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
            .then(r => r.blob())
            .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "FieldAssessment_Report.docx"; a.click(); URL.revokeObjectURL(url); })
            .catch(err => console.error("Export error:", err));
        }}>Export Report ↓</Btn>
        <Btn primary onClick={() => {
          // Filter out rejected findings
          const filtered = { ...result };
          if (filtered.components) {
            const approved = {};
            Object.entries(filtered.components).forEach(([k, v]) => {
              if (approvedFindings[k] !== false) approved[k] = v;
            });
            filtered.components = approved;
            filtered.human_reviewed = true;
            filtered.rejected_components = Object.keys(result.components).filter(k => approvedFindings[k] === false);
          }
          onResult(filtered);
        }}>Continue to Tagging →</Btn>
      </div>
    </div>
  );
};

const _manualFallback = () => ({
  damage_classification: "unknown",
  damage_percentage: 0,
  components: {
    roof: { damage: "unknown", notes: "Manual assessment needed" },
    walls: { damage: "unknown", notes: "Manual assessment needed" },
    foundation: { damage: "unknown", notes: "Manual assessment needed" },
    windows: { damage: "unknown", notes: "Manual assessment needed" },
    utilities: { damage: "unknown", notes: "Manual assessment needed" },
  },
  hazards: [],
  recommended_actions: [],
  estimated_repair_category: "unknown",
  confidence: 0,
  summary: "AI analysis unavailable — complete manual tagging below.",
  _manual: true,
});

// ---- Screen 4: Tag & Annotate ----

const TagAnnotate = ({ aiResult, onContinue, onBack }) => {
  const [selectedHazards, setSelectedHazards] = useState(aiResult?.hazards || []);
  const [selectedDamage, setSelectedDamage] = useState([]);
  const [notes, setNotes] = useState("");
  const [classification, setClassification] = useState(aiResult?.damage_classification || "unknown");

  const toggleTag = (tag, list, setList) => {
    setList(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const TagChip = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
      padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      border: `1px solid ${active ? C.accent : C.border}`, cursor: "pointer",
      background: active ? C.accentBg : C.surface, color: active ? C.accent : C.textSecondary,
      fontFamily: font, transition: "all 0.15s",
    }}>
      {active ? "✓ " : ""}{label}
    </button>
  );

  return (
    <div>
      <ScreenTitle step={4} total={6} title="Tag & Annotate" subtitle="Verify AI findings and add field observations." />

      {/* Override classification */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 8 }}>Damage Classification</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["destroyed", "major", "minor", "affected", "none"].map(cls => (
            <button
              key={cls} onClick={() => setClassification(cls)}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: classification === cls ? `2px solid ${DAMAGE_COLORS[cls]}` : `1px solid ${C.border}`,
                background: classification === cls ? DAMAGE_COLORS[cls] + "18" : C.surface,
                color: classification === cls ? DAMAGE_COLORS[cls] : C.textMuted,
                cursor: "pointer", fontFamily: font, textTransform: "uppercase",
              }}
            >
              {cls}
            </button>
          ))}
        </div>
        {classification !== aiResult?.damage_classification && (
          <div style={{ fontSize: 10, color: C.accent, marginTop: 6, fontWeight: 600 }}>
            ↑ Overriding AI classification ({aiResult?.damage_classification} → {classification})
          </div>
        )}
      </Card>

      {/* Hazard tags */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 8 }}>Hazard Tags</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {HAZARD_OPTIONS.map(h => (
            <TagChip key={h} label={h} active={selectedHazards.includes(h)} onClick={() => toggleTag(h, selectedHazards, setSelectedHazards)} />
          ))}
        </div>
      </Card>

      {/* Damage tags */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 8 }}>Damage Tags</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAMAGE_TAGS.map(d => (
            <TagChip key={d} label={d} active={selectedDamage.includes(d)} onClick={() => toggleTag(d, selectedDamage, setSelectedDamage)} />
          ))}
        </div>
      </Card>

      {/* Notes */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", marginBottom: 8 }}>Field Notes</div>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Additional observations, access issues, resident contact info..."
          rows={3}
          style={{
            width: "100%", borderRadius: 6, border: `1px solid ${C.border}`, padding: 10,
            fontSize: 12, fontFamily: font, resize: "vertical", boxSizing: "border-box",
          }}
        />
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={onBack}>&larr; Back</Btn>
        <Btn primary onClick={() => onContinue({ classification, hazards: selectedHazards, damage_tags: selectedDamage, notes })} style={{ flex: 1 }}>
          Review Assessment
        </Btn>
      </div>
    </div>
  );
};

// ---- Screen 5: Review & Submit ----

const ReviewSubmit = ({ zone, aiResult, tags, imageData, onSubmit, onBack, saving }) => {
  const dmgColor = DAMAGE_COLORS[tags.classification] || C.textMuted;

  return (
    <div>
      <ScreenTitle step={5} total={6} title="Review & Submit" subtitle="Verify all details before saving this assessment." />

      <Card style={{ marginBottom: 12, borderLeft: `5px solid ${dmgColor}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", fontWeight: 600 }}>Zone</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{zone.area_name || zone.zone_name || zone.fips_tract}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", fontWeight: 600 }}>Classification</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: dmgColor, textTransform: "uppercase" }}>{tags.classification}</div>
          </div>
        </div>
      </Card>

      {/* Photo thumbnail */}
      {imageData && (
        <Card style={{ marginBottom: 12, padding: 8 }}>
          <img
            src={`data:image/jpeg;base64,${imageData}`}
            alt="Assessment"
            style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 6 }}
          />
        </Card>
      )}

      {/* AI analysis summary */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.text, marginBottom: 6 }}>AI Analysis</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: 0 }}>{aiResult?.summary || "No AI analysis"}</p>
        {tags.classification !== aiResult?.damage_classification && (
          <div style={{ fontSize: 11, color: C.accent, marginTop: 6, fontWeight: 600 }}>
            Field override: {aiResult?.damage_classification} → {tags.classification}
          </div>
        )}
      </Card>

      {/* Tags summary */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.text, marginBottom: 6 }}>Tags Applied</div>
        {tags.hazards?.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: C.yellow, fontWeight: 700 }}>HAZARDS: </span>
            <span style={{ fontSize: 11, color: C.textSecondary }}>{tags.hazards.join(", ")}</span>
          </div>
        )}
        {tags.damage_tags?.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>DAMAGE: </span>
            <span style={{ fontSize: 11, color: C.textSecondary }}>{tags.damage_tags.join(", ")}</span>
          </div>
        )}
        {tags.notes && (
          <div>
            <span style={{ fontSize: 10, color: C.blue, fontWeight: 700 }}>NOTES: </span>
            <span style={{ fontSize: 11, color: C.textSecondary }}>{tags.notes}</span>
          </div>
        )}
        {!tags.hazards?.length && !tags.damage_tags?.length && !tags.notes && (
          <p style={{ fontSize: 11, color: C.textMuted }}>No additional tags or notes added.</p>
        )}
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={onBack}>&larr; Edit Tags</Btn>
        <Btn primary disabled={saving} onClick={onSubmit} style={{ flex: 1 }}>
          {saving ? "Saving..." : "Submit Assessment"}
        </Btn>
      </div>
    </div>
  );
};

// ---- Screen 6: Summary ----

const Summary = ({ zone, result, tags, onAnother, onDone, onViewHistory }) => {
  const dmgColor = DAMAGE_COLORS[tags.classification] || C.textMuted;

  return (
    <div>
      <ScreenTitle step={6} total={6} title="Assessment Saved" subtitle={new Date().toLocaleString()} />

      <Card style={{ marginBottom: 16, background: C.greenBg, borderColor: C.greenBorder, textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>Assessment Submitted</div>
        <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 8 }}>
          <strong>{zone.area_name || zone.fips_tract}</strong> — classified as{" "}
          <span style={{ fontWeight: 800, color: dmgColor, textTransform: "uppercase" }}>{tags.classification}</span>
        </p>
        <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          This assessment will feed back into the mission plan's resource allocation model.
        </p>
      </Card>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn primary onClick={onAnother} style={{ flex: 1 }}>Assess Another</Btn>
        <Btn onClick={() => {
          const payload = { ...result, zone: zone || {}, tags: tags || {}, timestamp: new Date().toISOString() };
          fetch(API + "/api/assess/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
            .then(r => r.blob())
            .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "FieldAssessment_Report.docx"; a.click(); URL.revokeObjectURL(url); })
            .catch(err => console.error("Export error:", err));
        }} style={{ flex: 1 }}>Export Report ↓</Btn>
        <Btn onClick={onViewHistory} style={{ flex: 1 }}>History</Btn>
        <Btn onClick={onDone} style={{ flex: 1 }}>Back</Btn>
      </div>
    </div>
  );
};

// ---- Screen 7: Assessment History ----
const AssessmentHistory = ({ zone, onBack }) => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    if (!zone) return;
    (async () => {
      try {
        const res = await fetch(API + "/api/assess/history/" + (zone.fips_tract || ""));
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setAssessments(data.assessments || []);
      } catch (err) {
        console.error("History fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  });

  const dmgColor = (cls) => DAMAGE_COLORS[cls] || C.textMuted;

  return (
    <div>
      <ScreenTitle step={null} total={null} title="Assessment History" subtitle={zone?.area_name || zone?.fips_tract || "All Zones"} />

      {loading ? (
        <Card style={{ textAlign: "center", padding: 32 }}>
          <p style={{ color: C.textMuted, fontSize: 13 }}>Loading assessments...</p>
        </Card>
      ) : assessments.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <p style={{ color: C.textMuted, fontSize: 13 }}>No assessments recorded for this zone yet.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{assessments.length} assessment{assessments.length !== 1 ? "s" : ""} recorded</div>
          {assessments.map((a, i) => {
            const cls = a.damage_classification || "unknown";
            const components = typeof a.damage_by_component === "string" ? JSON.parse(a.damage_by_component || "{}") : (a.damage_by_component || {});
            const hazards = typeof a.tags_hazards === "string" ? JSON.parse(a.tags_hazards || "[]") : (a.tags_hazards || []);
            return (
              <Card key={a.assessment_id || i}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: cls === "none" ? C.greenBg : cls === "minor" || cls === "affected" ? C.yellowBg : C.redBg, color: dmgColor(cls) }}>
                      {cls}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text, marginLeft: 8 }}>{a.overall_damage_pct || 0}% damage</span>
                  </div>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</span>
                </div>
                {/* Component breakdown */}
                {Object.keys(components).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    {Object.entries(components).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: C.surfaceMuted, color: C.textSecondary, border: `1px solid ${C.border}` }}>
                        {k}: {typeof v === "object" ? v.damage || "—" : v}
                      </span>
                    ))}
                  </div>
                )}
                {hazards.length > 0 && (
                  <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}>
                    ⚠️ {hazards.join(" • ")}
                  </div>
                )}
                {a.notes && <p style={{ fontSize: 11, color: C.textMuted, margin: "6px 0 0", fontStyle: "italic" }}>"{a.notes}"</p>}
                <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: C.textMuted }}>
                  <span>📷 {a.photo_count || 1} photo{(a.photo_count || 1) > 1 ? "s" : ""}</span>
                  <span>👤 {a.assessed_by || "field_team"}</span>
                  {a.latitude && <span>📍 {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Btn onClick={onBack}>← Back</Btn>
      </div>
    </div>
  );
};

// ---- Main FieldAssessment Component ----

export default function FieldAssessment({ zones, onBack }) {
  const [screen, setScreen] = useState(1);
  const [selectedZone, setSelectedZone] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [contentType, setContentType] = useState("image/jpeg");
  const [photos, setPhotos] = useState([]); // {data: base64, contentType: string}[]
  const [aiResult, setAiResult] = useState(null);
  const [tags, setTags] = useState(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setScreen(1);
    setSelectedZone(null);
    setImageData(null);
    setPhotos([]);
    setAiResult(null);
    setTags(null);
    setSaving(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        fips_tract: selectedZone?.fips_tract || "",
        latitude: selectedZone?.latitude || null,
        longitude: selectedZone?.longitude || null,
        damage_classification: tags.classification,
        damage_percentage: aiResult?.damage_percentage || 0,
        components: aiResult?.components || {},
        hazards: tags.hazards || [],
        tags_damage: tags.damage_tags || [],
        notes: tags.notes || "",
        estimated_repair_category: aiResult?.estimated_repair_category || "unknown",
        assessed_by: "field_team",
        ai_confidence: aiResult?.confidence || 0,
      };
      const res = await fetch(API + "/api/assess/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed: " + res.status);
      setScreen(6);
    } catch (err) {
      console.error("Save error:", err);
      setScreen(6);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 12px" }}>
      {onBack && screen === 1 && (
        <div style={{ marginBottom: 12 }}>
          <Btn small onClick={onBack}>&larr; Back to Mission Planner</Btn>
        </div>
      )}

      {screen === 1 && (
        <SelectZone
          zones={zones || []}
          onSelect={(z) => { setSelectedZone(z); setScreen(2); }}
          onViewHistory={(z) => { setSelectedZone(z); setScreen(7); }}
        />
      )}

      {screen === 2 && (
        <CapturePhoto
          zone={selectedZone}
          onCapture={(data, ct, allPhotos) => { setImageData(data); setContentType(ct); setPhotos(allPhotos || [{ data, contentType: ct }]); setScreen(3); }}
          onBack={() => setScreen(1)}
        />
      )}

      {screen === 3 && (
        <AIAnalysis
          zone={selectedZone}
          imageData={imageData}
          contentType={contentType}
          allPhotos={photos}
          onResult={(r) => { setAiResult(r); setScreen(4); }}
          onRetake={() => { setImageData(null); setScreen(2); }}
        />
      )}

      {screen === 4 && (
        <TagAnnotate
          aiResult={aiResult}
          onContinue={(t) => { setTags(t); setScreen(5); }}
          onBack={() => setScreen(3)}
        />
      )}

      {screen === 5 && (
        <ReviewSubmit
          zone={selectedZone}
          aiResult={aiResult}
          tags={tags}
          imageData={imageData}
          onSubmit={handleSubmit}
          onBack={() => setScreen(4)}
          saving={saving}
        />
      )}

      {screen === 6 && (
        <Summary
          zone={selectedZone}
          result={aiResult}
          tags={tags}
          onAnother={() => { setImageData(null); setPhotos([]); setAiResult(null); setTags(null); setScreen(2); }}
          onViewHistory={() => setScreen(7)}
          onDone={reset}
        />
      )}

      {screen === 7 && (
        <AssessmentHistory
          zone={selectedZone}
          onBack={() => setScreen(1)}
        />
      )}
    </div>
  );
}
