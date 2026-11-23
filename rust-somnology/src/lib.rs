//! SOMNO-PULSE somnology crate — polyglot sleep engine.
//!
//! Zero-TypeScript stack: Vue 3.5 + Rust + Java 17 + Go 1.22 + JS + GLSL.
//!
//! Modules:
//!   * `apnea_ahi_detector` — >=10 s cessation + resuscitative gasp events, AHI.
//!   * `snore_formant`      — palatal (45-160 Hz) vs tongue-base (250-950 Hz).
//!   * `bruxism_tribology`  — 1.8-4.8 kHz enamel-on-enamel attrition grading.
//!   * `ultradian`          — 90-minute REM/N3 architecture + smart wake solver.
//!
//! A byte-for-byte behavioural mirror of this crate lives in
//! `src/engines/rustSomnoBridge.js` so Vercel builds succeed with no Rust
//! toolchain present; the WASM artefact produced by CI is loaded opportunistically.

pub mod apnea_ahi_detector;
pub mod bruxism_tribology;
pub mod snore_formant;
pub mod ultradian;

pub use apnea_ahi_detector::{ApneaEvent, AhiGrade, compute_ahi, detect_apnea_events};
pub use bruxism_tribology::{BruxismClass, classify_bruxism, wear_risk};
pub use snore_formant::{Severity, Site, SnoreSite, classify_snore_site, palatal_intervention};
pub use ultradian::{CycleBoundary, SmartWake, Stage, solve_smart_wake, ultradian_boundaries};

/// AASM Apnea-Hypopnea Index severity grade.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AhiSeverity {
    Normal,
    Mild,
    Moderate,
    Severe,
}

impl AhiSeverity {
    /// Normal <5/hr · Mild 5-14/hr · Moderate 15-29/hr · Severe >=30/hr.
    pub fn from_ahi(ahi: f64) -> Self {
        if ahi < 5.0 {
            AhiSeverity::Normal
        } else if ahi < 15.0 {
            AhiSeverity::Mild
        } else if ahi < 30.0 {
            AhiSeverity::Moderate
        } else {
            AhiSeverity::Severe
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            AhiSeverity::Normal => "NORMAL <5/hr",
            AhiSeverity::Mild => "MILD 5-14/hr",
            AhiSeverity::Moderate => "MODERATE 15-29/hr",
            AhiSeverity::Severe => "SEVERE >=30/hr",
        }
    }

    /// True when a full in-lab polysomnogram is warranted.
    pub fn needs_referral(&self) -> bool {
        matches!(self, AhiSeverity::Moderate | AhiSeverity::Severe)
    }
}

/// Positional therapy correlation: supine vs lateral apnea distribution.
///
/// A supine-predominant profile (>=2x more events on the back) responds well to
/// positional devices; a non-positional profile points at CPAP / oral appliance.
#[derive(Debug, Clone, PartialEq)]
pub struct PositionalProfile {
    pub supine_events: u32,
    pub lateral_events: u32,
    pub supine_index: f64,
    pub positional: bool,
    pub therapy: &'static str,
}

pub fn positional_profile(supine_events: u32, lateral_events: u32, hours: f64) -> PositionalProfile {
    let h = hours.max(0.25);
    let supine_index = supine_events as f64 / h;
    let lateral_index = lateral_events as f64 / h;
    let positional = supine_index >= 2.0 * lateral_index.max(0.1) && supine_events >= 5;
    PositionalProfile {
        supine_events,
        lateral_events,
        supine_index,
        positional,
        therapy: if positional {
            "POSITIONAL_THERAPY_DEVICE"
        } else {
            "CPAP_OR_ORAL_APPLIANCE"
        },
    }
}

/// 90-minute ultradian boundary (minutes from midnight) — convenience wrapper.
pub fn ultradian_boundary(bedtime_min: u32, cycle: u32) -> u32 {
    (bedtime_min + cycle * ultradian::CYCLE_MIN) % ultradian::DAY_MIN
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ahi_grades() {
        assert_eq!(AhiSeverity::from_ahi(1.2), AhiSeverity::Normal);
        assert_eq!(AhiSeverity::from_ahi(9.0), AhiSeverity::Mild);
        assert_eq!(AhiSeverity::from_ahi(28.5), AhiSeverity::Moderate);
        assert_eq!(AhiSeverity::from_ahi(35.0), AhiSeverity::Severe);
        assert!(AhiSeverity::from_ahi(28.5).needs_referral());
    }

    #[test]
    fn ultradian_math() {
        assert_eq!(ultradian_boundary(22 * 60 + 30, 5), 6 * 60);
    }

    #[test]
    fn supine_predominance_is_positional() {
        let p = positional_profile(40, 6, 7.5);
        assert!(p.positional);
        assert_eq!(p.therapy, "POSITIONAL_THERAPY_DEVICE");

        let n = positional_profile(20, 18, 7.5);
        assert!(!n.positional);
        assert_eq!(n.therapy, "CPAP_OR_ORAL_APPLIANCE");
    }
}
