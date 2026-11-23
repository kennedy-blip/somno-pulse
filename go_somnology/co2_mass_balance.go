// Package somnology — SOMNO-PULSE Go 1.22 somnology engine.
// Transient mass-balance bedroom CO2 accumulation C(t) in ppm (illustrative only).
//
// Governing ODE (well-mixed room):
//
//	dC/dt = (G - Q*(C - C_out)) / V
//
// where G = metabolic CO2 generation (L/hr), Q = ventilation flow (m3/hr),
// V = room volume (m3), C_out = outdoor CO2 (420 ppm baseline).
package somnology

import "math"

// Outdoor CO2 baseline in ppm.
const OutdoorCO2 = 420.0

// SleepZone classifies an overnight CO2 exposure band.
type SleepZone string

const (
	ZoneOptimal SleepZone = "OPTIMAL"   // <800 ppm — peak cognition
	ZoneStuffy  SleepZone = "STUFFY"    // 800-1400 ppm — micro-arousals
	ZoneSevere  SleepZone = "SEVERE"    // >1500 ppm — morning grogginess
)

// VentilationPrescription is an illustrative air change rate; crack widths are not estimated.
type VentilationPrescription struct {
	CrackCm   float64   `json:"crackCm"`
	CrackIn   float64   `json:"crackIn"`
	Ach       float64   `json:"ach"`
	Message   string    `json:"message"`
	Zone      SleepZone `json:"zone"`
	PeakPpm   float64   `json:"peakPpm"`
}

// CO2Point is one sample on the 8-hour accumulation curve.
type CO2Point struct {
	Minutes int     `json:"minutes"`
	Ppm     float64 `json:"ppm"`
}

// Room describes the bedroom microclimate.
type Room struct {
	LengthM   float64 `json:"lengthM"`
	WidthM    float64 `json:"widthM"`
	HeightM   float64 `json:"heightM"`
	Occupants int     `json:"occupants"`
	Pets      int     `json:"pets"`
	Ach       float64 `json:"ach"` // air changes per hour
}

// VolumeM3 returns the room volume in cubic metres.
func (r Room) VolumeM3() float64 {
	return r.LengthM * r.WidthM * r.HeightM
}

// GenerationLPerHr returns metabolic CO2 output in litres per hour.
// A sleeping adult produces ~0.005 L/s (≈18 L/hr); a pet counts as 0.4 of an
// adult. Matches src/engines/co2Engine.js exactly.
func (r Room) GenerationLPerHr() float64 {
	occ := float64(r.Occupants)
	if occ < 0 {
		occ = 0
	}
	return 18.0 * (occ + 0.4*float64(r.Pets))
}

// SimulateCO2 solves the well-mixed mass balance exactly at one-minute steps.
func SimulateCO2(r Room, minutes int) []CO2Point {
	v := math.Max(r.VolumeM3(), 5)
	ach := math.Max(r.Ach, 0)
	generation := r.GenerationLPerHr() * 1000 / v // ppm per hour
	c := OutdoorCO2
	out := make([]CO2Point, 0, int(math.Max(float64(minutes), 0))+1)
	out = append(out, CO2Point{Minutes: 0, Ppm: c})
	const dtHr = 1.0 / 60.0
	for m := 1; m <= minutes; m++ {
		if ach < 1e-9 {
			c += generation * dtHr
		} else {
			c = OutdoorCO2 + (c-OutdoorCO2)*math.Exp(-ach*dtHr) + generation/ach*(-math.Expm1(-ach*dtHr))
		}
		out = append(out, CO2Point{Minutes: m, Ppm: math.Round(c)})
	}
	return out
}

// PeakPpm returns the maximum of a curve.
func PeakPpm(points []CO2Point) float64 {
	peak := 0.0
	for _, p := range points {
		if p.Ppm > peak {
			peak = p.Ppm
		}
	}
	return peak
}

// ClassifyZone maps a ppm value to a sleep-quality band.
func ClassifyZone(ppm float64) SleepZone {
	switch {
	case ppm < 800:
		return ZoneOptimal
	case ppm < 1400:
		return ZoneStuffy
	default:
		return ZoneSevere
	}
}

// PrescribeVentilation estimates ventilation needed for a modelled 900 ppm
// target. Opening width cannot be inferred without measuring actual airflow.
func PrescribeVentilation(r Room) VentilationPrescription {
	peak := PeakPpm(SimulateCO2(r, 480))
	generation := r.GenerationLPerHr() * 1000 / math.Max(r.VolumeM3(), 5)
	concentration := func(ach float64) float64 {
		if ach < 1e-9 { return OutdoorCO2 + generation*8 }
		return OutdoorCO2 + generation/ach*(-math.Expm1(-ach*8))
	}
	lo, hi := 0.0, 1.0
	for concentration(hi) > 900 && hi < 10000 { hi *= 2 }
	for i := 0; i < 40; i++ {
		mid := (lo + hi) / 2
		if concentration(mid) > 900 { lo = mid } else { hi = mid }
	}
	return VentilationPrescription{
		Ach: math.Ceil(hi*10)/10,
		Message: "Estimate only; measure actual CO2 and ventilation. Crack width cannot reliably predict airflow.",
		Zone: ClassifyZone(peak), PeakPpm: peak,
	}
}

// ThermostatForTog returns the optimal bedroom set-point for a bedding TOG rating.
// Sleep-onset core-temperature drop favours ~18.3 C / 65 F.
func ThermostatForTog(tog float64) (celsius float64, fahrenheit float64) {
	celsius = 21.5 - 0.24*tog
	if celsius < 15.5 {
		celsius = 15.5
	}
	if celsius > 21.0 {
		celsius = 21.0
	}
	fahrenheit = celsius*9.0/5.0 + 32.0
	return math.Round(celsius*10) / 10, math.Round(fahrenheit*10) / 10
}
