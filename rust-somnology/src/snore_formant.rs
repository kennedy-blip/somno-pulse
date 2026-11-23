//! Snore formant ratio math — site-of-collapse identification.
//!
//! Benign soft-palate snoring carries a low fundamental (~45-160 Hz, classically
//! ~92 Hz) with evenly spaced harmonics. Dangerous velopharyngeal / tongue-base
//! airway collapse shifts the dominant formant up into 250-950 Hz, with the
//! resuscitative gasp of an obstructive apnea peaking near 620 Hz.
//!
//! The F1/F2 ratio therefore acts as a cheap, robust discriminator that can run
//! on-device for eight hours without a full spectral model.

/// Palatal (benign) fundamental band in Hz.
pub const PALATAL_BAND: (f64, f64) = (45.0, 160.0);

/// Velopharyngeal / tongue-base collapse band in Hz.
pub const TONGUE_BASE_BAND: (f64, f64) = (250.0, 950.0);

/// Bruxism enamel-grinding tribological band in Hz.
pub const BRUXISM_BAND: (f64, f64) = (1800.0, 4800.0);

/// Typical resuscitative gasp peak after an apneic silence (Hz).
pub const GASP_PEAK_HZ: f64 = 620.0;

/// Site-of-collapse classification with the F1/F2 formant ratio.
#[derive(Debug, Clone, PartialEq)]
pub struct SnoreSite {
    pub f1_hz: f64,
    pub f2_hz: f64,
    pub ratio: f64,
    pub site: Site,
    pub severity: Severity,
    pub positional_candidate: bool,
}

/// Anatomical collapse site.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Site {
    Palatal,
    Mixed,
    VelopharyngealTongueBase,
}

impl Site {
    pub fn label(&self) -> &'static str {
        match self {
            Site::Palatal => "PALATAL",
            Site::Mixed => "MIXED",
            Site::VelopharyngealTongueBase => "VELOPHARYNGEAL_TONGUE_BASE",
        }
    }
}

/// Clinical severity attached to the collapse site.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Benign,
    Elevated,
    Dangerous,
}

impl Severity {
    pub fn label(&self) -> &'static str {
        match self {
            Severity::Benign => "BENIGN",
            Severity::Elevated => "ELEVATED",
            Severity::Dangerous => "DANGEROUS",
        }
    }
}

/// Classify the airway collapse site from the first two formants.
///
/// * `f1_hz` — dominant low formant (soft-palate flutter fundamental).
/// * `f2_hz` — second formant (pharyngeal cavity resonance).
pub fn classify_snore_site(f1_hz: f64, f2_hz: f64) -> SnoreSite {
    let f1 = f1_hz.max(1.0);
    let ratio = f2_hz / f1;

    let (site, severity) = if f1_hz >= TONGUE_BASE_BAND.0 || f2_hz >= 350.0 {
        (Site::VelopharyngealTongueBase, Severity::Dangerous)
    } else if f1_hz > PALATAL_BAND.1 {
        (Site::Mixed, Severity::Elevated)
    } else {
        (Site::Palatal, Severity::Benign)
    };

    // A narrow-band, low-ratio palatal snore with no apneas is the classic
    // positional / nasal-strip candidate rather than a surgical one.
    let positional_candidate =
        matches!(site, Site::Palatal) && (1.5..=3.5).contains(&ratio);

    SnoreSite {
        f1_hz,
        f2_hz,
        ratio,
        site,
        severity,
        positional_candidate,
    }
}

/// Snore duty cycle: fraction of the night spent snoring (0..1).
pub fn snore_duty_cycle(snoring_seconds: f64, total_sleep_seconds: f64) -> f64 {
    if total_sleep_seconds <= 0.0 {
        return 0.0;
    }
    (snoring_seconds / total_sleep_seconds).clamp(0.0, 1.0)
}

/// Recommend the conservative intervention ladder for a palatal snorer.
pub fn palatal_intervention(duty_cycle: f64, ahi: f64) -> &'static str {
    if ahi >= 15.0 {
        "REFER_FOR_PSG"
    } else if duty_cycle > 0.45 {
        "NASAL_STRIP_PLUS_POSITIONAL_THERAPY"
    } else if duty_cycle > 0.20 {
        "POSITIONAL_THERAPY_LATERAL_SLEEP"
    } else {
        "OBSERVE"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn palatal_fundamental_is_benign() {
        let s = classify_snore_site(92.0, 210.0);
        assert_eq!(s.site, Site::Palatal);
        assert_eq!(s.severity, Severity::Benign);
        assert!(s.positional_candidate);
    }

    #[test]
    fn tongue_base_collapse_is_dangerous() {
        let s = classify_snore_site(620.0, 880.0);
        assert_eq!(s.site, Site::VelopharyngealTongueBase);
        assert_eq!(s.severity, Severity::Dangerous);
        assert!(!s.positional_candidate);
    }

    #[test]
    fn duty_cycle_and_intervention() {
        let d = snore_duty_cycle(4.0 * 3600.0, 8.0 * 3600.0);
        assert!((d - 0.5).abs() < 1e-9);
        assert_eq!(palatal_intervention(d, 3.4), "NASAL_STRIP_PLUS_POSITIONAL_THERAPY");
        assert_eq!(palatal_intervention(d, 28.5), "REFER_FOR_PSG");
    }
}
