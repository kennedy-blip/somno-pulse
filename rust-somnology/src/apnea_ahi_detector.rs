//! Apnea/Hypopnea event detection: >=10s cessation + resuscitative gasp.
//! Snore formant site-of-collapse: palatal 45-160 Hz vs tongue-base 250-950 Hz.

/// A detected apnea/hypopnea event.
#[derive(Debug, Clone, PartialEq)]
pub struct ApneaEvent {
    pub start_sec: f64,
    pub duration_sec: f64,
    pub gasp_amplitude: f64,
    pub is_apnea: bool,
    pub event_type: String,
}

/// AHI severity grade.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AhiGrade {
    Normal,
    Mild,
    Moderate,
    Severe,
}

impl AhiGrade {
    pub fn from_ahi(ahi: f64) -> Self {
        if ahi < 5.0 {
            AhiGrade::Normal
        } else if ahi < 15.0 {
            AhiGrade::Mild
        } else if ahi < 30.0 {
            AhiGrade::Moderate
        } else {
            AhiGrade::Severe
        }
    }
}

/// Snore collapse site classification.
#[derive(Debug, Clone, PartialEq)]
pub struct SnoreSite {
    pub f1_hz: f64,
    pub f2_hz: f64,
    pub ratio: f64,
    pub site: String,
    pub severity: String,
}

/// Detect apneas in a respiratory envelope (0..1 at `sample_rate_hz`).
/// Rule: silence (< threshold) for >=10s, then a resuscitative gasp spike.
pub fn detect_apnea_events(envelope: &[f64], sample_rate_hz: f64, threshold: f64) -> Vec<ApneaEvent> {
    let mut events = Vec::new();
    let mut silence_start: Option<usize> = None;
    for (i, &level) in envelope.iter().enumerate() {
        let amp = level;
        let quiet = amp < threshold;
        if quiet && silence_start.is_none() {
            silence_start = Some(i);
        }
        if !quiet {
            if let Some(start) = silence_start.take() {
                let dur = (i - start) as f64 / sample_rate_hz;
                if dur >= 10.0 {
                    let gasp_end = (i + (3.0 * sample_rate_hz) as usize).min(envelope.len());
                    let gasp = envelope[i..gasp_end]
                        .iter()
                        .cloned()
                        .fold(0.0_f64, f64::max);
                    let is_apnea = gasp > 0.55;
                    events.push(ApneaEvent {
                        start_sec: start as f64 / sample_rate_hz,
                        duration_sec: dur,
                        gasp_amplitude: gasp,
                        is_apnea,
                        event_type: if is_apnea {
                            "OBSTRUCTIVE_APNEA".to_string()
                        } else {
                            "HYPOPNEA".to_string()
                        },
                    });
                }
            }
        }
    }
    events
}

/// Compute AHI (events per hour of sleep) and grade.
pub fn compute_ahi(events: &[ApneaEvent], hours_of_sleep: f64) -> (f64, AhiGrade) {
    let h = hours_of_sleep.max(0.25);
    let ahi = events.len() as f64 / h;
    (ahi, AhiGrade::from_ahi(ahi))
}

/// Classify snore collapse site from F1/F2 formants.
pub fn classify_snore_site(f1_hz: f64, f2_hz: f64) -> SnoreSite {
    let ratio = f2_hz / f1_hz.max(1.0);
    let (site, severity) = if f1_hz >= 250.0 || f2_hz >= 350.0 {
        ("VELOPHARYNGEAL_TONGUE_BASE", "DANGEROUS")
    } else if f1_hz >= 160.0 {
        ("MIXED", "ELEVATED")
    } else {
        ("PALATAL", "BENIGN")
    };
    SnoreSite {
        f1_hz,
        f2_hz,
        ratio,
        site: site.to_string(),
        severity: severity.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_ten_second_cessation() {
        // 10 Hz envelope: 5s breathing, 15s silence, gasp spike.
        let mut env = vec![0.6; 50];
        env.extend(vec![0.02; 150]);
        env.extend(vec![0.9; 20]);
        let ev = detect_apnea_events(&env, 10.0, 0.12);
        assert_eq!(ev.len(), 1);
        assert!(ev[0].is_apnea);
    }

    #[test]
    fn palatal_vs_tongue_base() {
        assert_eq!(classify_snore_site(92.0, 210.0).site, "PALATAL");
        assert_eq!(classify_snore_site(620.0, 880.0).site, "VELOPHARYNGEAL_TONGUE_BASE");
    }
}
