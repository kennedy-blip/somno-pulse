//! Nocturnal bruxism tribology: high-frequency 1.8-4.8 kHz enamel attrition.
//! Enamel-on-enamel friction bursts during sleep arousals.

/// Bruxism classification result.
#[derive(Debug, Clone, PartialEq)]
pub struct BruxismClass {
    pub peak_hz: f64,
    pub duration_ms: f64,
    pub bursts_per_min: f64,
    pub in_band: bool,
    pub grade: String,
    pub estimated_force_n: f64,
}

/// Classify a grinding burst by peak frequency, duration, and burst rate.
pub fn classify_bruxism(peak_hz: f64, duration_ms: f64, bursts_per_min: f64) -> BruxismClass {
    let in_band = (1800.0..=4800.0).contains(&peak_hz);
    let grade = if in_band && duration_ms >= 200.0 && bursts_per_min >= 3.0 {
        "SEVERE_ATTRITION"
    } else if in_band && duration_ms >= 100.0 {
        "MODERATE"
    } else if in_band {
        "MILD"
    } else {
        "NONE"
    };
    let estimated_force_n = if in_band {
        (peak_hz / 1000.0) * 18.0 + bursts_per_min * 2.0
    } else {
        0.0
    };
    BruxismClass {
        peak_hz,
        duration_ms,
        bursts_per_min,
        in_band,
        grade: grade.to_string(),
        estimated_force_n,
    }
}

/// Estimate enamel wear risk over a night (0..1).
pub fn wear_risk(bursts: &[BruxismClass]) -> f64 {
    if bursts.is_empty() {
        return 0.0;
    }
    let total_ms: f64 = bursts.iter().map(|b| b.duration_ms).sum();
    (total_ms / 30_000.0).min(1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_grinding_band() {
        let c = classify_bruxism(3200.0, 350.0, 6.0);
        assert!(c.in_band);
        assert_eq!(c.grade, "SEVERE_ATTRITION");
        assert!(c.estimated_force_n > 50.0);
    }

    #[test]
    fn rejects_low_frequency_snore() {
        let c = classify_bruxism(92.0, 500.0, 10.0);
        assert!(!c.in_band);
        assert_eq!(c.grade, "NONE");
    }
}
