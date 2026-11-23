//! 90-minute ultradian REM / N3 sleep-cycle architecture and the smart
//! zero-inertia wake window solver.
//!
//! Waking from Stage N3 slow-wave delta sleep produces severe sleep inertia;
//! waking at a cycle boundary (Stage N1/N2 light sleep) leaves the sleeper
//! energized. This module computes the boundaries and scores a requested wake
//! time against them.

/// Length of one ultradian cycle in minutes.
pub const CYCLE_MIN: u32 = 90;

/// Minutes in a day.
pub const DAY_MIN: u32 = 1440;

/// Sleep stage at a cycle boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stage {
    Wake,
    Rem,
    N1Light,
    N2Spindle,
    N3Deep,
}

impl Stage {
    pub fn label(&self) -> &'static str {
        match self {
            Stage::Wake => "WAKE",
            Stage::Rem => "REM",
            Stage::N1Light => "N1_LIGHT",
            Stage::N2Spindle => "N2_SPINDLE",
            Stage::N3Deep => "N3_DEEP",
        }
    }

    /// True when waking from this stage is restorative rather than inertial.
    pub fn is_light(&self) -> bool {
        matches!(self, Stage::N1Light | Stage::N2Spindle | Stage::Wake)
    }
}

/// One 90-minute ultradian phase boundary.
#[derive(Debug, Clone, PartialEq)]
pub struct CycleBoundary {
    pub cycle: u32,
    pub end_minutes: u32,
    pub end_label: String,
    pub stage: Stage,
    pub deep_share: f64,
    pub rem_share: f64,
}

/// Result of solving a requested wake time against the ultradian architecture.
#[derive(Debug, Clone, PartialEq)]
pub struct SmartWake {
    pub cycles: u32,
    pub ideal_wake_minutes: u32,
    pub ideal_wake_label: String,
    pub delta_minutes: i32,
    pub in_window: bool,
    pub inertia_risk: bool,
    pub note: String,
}

/// Format minutes-from-midnight as HH:MM.
pub fn fmt_time(minutes: u32) -> String {
    let h = (minutes / 60) % 24;
    let m = minutes % 60;
    format!("{:02}:{:02}", h, m)
}

/// Dominant stage at the end of a given cycle number.
///
/// N3 slow-wave delta dominates the first third of the night; REM periods
/// lengthen across the later cycles, which is why the last boundary before a
/// normal wake time is the cheapest place to open the eyes.
pub fn stage_at_cycle(cycle: u32) -> Stage {
    match cycle {
        0 => Stage::Wake,
        1 | 2 => Stage::N3Deep,
        3 => Stage::N2Spindle,
        4 => Stage::Rem,
        _ => Stage::N1Light,
    }
}

/// N3 and REM share of a cycle (0..1) for hypnogram rendering.
pub fn architecture_shares(cycle: u32, total_cycles: u32) -> (f64, f64) {
    let t = if total_cycles == 0 {
        0.0
    } else {
        (cycle - 1) as f64 / total_cycles as f64
    };
    // Deep sleep decays exponentially; REM grows toward the morning.
    let deep = 0.62 * (-2.1 * t).exp();
    let rem = 0.10 + 0.45 * t * t;
    (deep.min(1.0), rem.min(1.0))
}

/// Compute `cycles` ultradian boundaries starting from bedtime.
pub fn ultradian_boundaries(bedtime_minutes: u32, cycles: u32) -> Vec<CycleBoundary> {
    let mut out = Vec::with_capacity(cycles as usize);
    for c in 1..=cycles {
        let end = (bedtime_minutes + c * CYCLE_MIN) % DAY_MIN;
        let (deep, rem) = architecture_shares(c, cycles);
        out.push(CycleBoundary {
            cycle: c,
            end_minutes: end,
            end_label: fmt_time(end),
            stage: stage_at_cycle(c),
            deep_share: deep,
            rem_share: rem,
        });
    }
    out
}

/// Shortest signed distance between two clock times (minutes, wraps at 24 h).
fn clock_delta(a: u32, b: u32) -> i32 {
    let raw = a as i32 - b as i32;
    let wrapped = ((raw + 720).rem_euclid(1440)) - 720;
    wrapped
}

/// Solve the smart wake window: which cycle boundary is nearest the requested
/// wake time, and does it fall inside the user's tolerance window?
pub fn solve_smart_wake(bedtime_minutes: u32, wake_minutes: u32, window_min: u32) -> SmartWake {
    let elapsed = (wake_minutes + DAY_MIN - bedtime_minutes) % DAY_MIN;
    let cycles = ((elapsed as f64) / CYCLE_MIN as f64).round().max(1.0) as u32;
    let ideal = (bedtime_minutes + cycles * CYCLE_MIN) % DAY_MIN;
    let delta = clock_delta(ideal, wake_minutes);
    let in_window = delta.unsigned_abs() <= window_min;
    let stage = stage_at_cycle(cycles);

    let note = if in_window {
        format!(
            "Waking at {} ends cycle {} in {} — zero sleep inertia.",
            fmt_time(ideal),
            cycles,
            stage.label()
        )
    } else {
        format!(
            "Waking at {} lands mid-cycle {} ({} trough) — severe grogginess. Shift to {}.",
            fmt_time(wake_minutes),
            cycles,
            Stage::N3Deep.label(),
            fmt_time(ideal)
        )
    };

    SmartWake {
        cycles,
        ideal_wake_minutes: ideal,
        ideal_wake_label: fmt_time(ideal),
        delta_minutes: delta,
        in_window,
        inertia_risk: !in_window && !stage.is_light(),
        note,
    }
}

/// Sleep-efficiency percentage: time asleep divided by time in bed.
pub fn sleep_efficiency(asleep_min: u32, in_bed_min: u32) -> f64 {
    if in_bed_min == 0 {
        return 0.0;
    }
    (asleep_min as f64 / in_bed_min as f64 * 100.0).clamp(0.0, 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boundaries_from_2230() {
        let b = ultradian_boundaries(22 * 60 + 30, 6);
        assert_eq!(b.len(), 6);
        assert_eq!(b[4].end_label, "06:00");
        assert_eq!(b[0].stage, Stage::N3Deep);
        assert_eq!(b[5].stage, Stage::N1Light);
    }

    #[test]
    fn cycle_boundary_wake_has_no_inertia() {
        let w = solve_smart_wake(22 * 60 + 30, 6 * 60 + 0, 20);
        assert_eq!(w.cycles, 5);
        assert!(w.in_window);
        assert!(!w.inertia_risk);
    }

    #[test]
    fn mid_cycle_wake_is_flagged() {
        let w = solve_smart_wake(22 * 60 + 30, 7 * 60 + 5, 20);
        assert!(!w.in_window);
        assert_eq!(w.ideal_wake_label, "07:30");
    }

    #[test]
    fn efficiency_is_clamped() {
        assert_eq!(sleep_efficiency(420, 480), 87.5);
        assert_eq!(sleep_efficiency(500, 480), 100.0);
    }
}
