// Package handler — SOMNO-PULSE Vercel Go serverless function.
// POST /api/somno-clinical
//
// Computes AASM AHI severity grades, STOP-BANG clinical risk scores,
// Epworth Sleepiness Scale bands, and 90-minute ultradian REM/N3 architecture.
//
// Zero-TypeScript polyglot stack: Vue 3.5 + Rust + Java 17 + Go 1.22 + JS + GLSL.
package handler

import (
	"encoding/json"
	"math"
	"net/http"
)

// AhiGrade is an AASM severity band.
type AhiGrade string

const (
	GradeNormal   AhiGrade = "NORMAL"
	GradeMild     AhiGrade = "MILD"
	GradeModerate AhiGrade = "MODERATE"
	GradeSevere   AhiGrade = "SEVERE"
)

// StopBangRequest carries the 8 STOP-BANG items plus Epworth.
type StopBangRequest struct {
	Snoring      bool    `json:"snoring"`
	Tired        bool    `json:"tired"`
	Observed     bool    `json:"observed"`
	Pressure     bool    `json:"pressure"`
	Bmi          float64 `json:"bmi"`
	Age          int     `json:"age"`
	NeckCm       float64 `json:"neckCm"`
	Male         bool    `json:"male"`
	Epworth      int     `json:"epworth"`
	Ahi          float64 `json:"ahi"`
	BedtimeMin   int     `json:"bedtimeMin"`
	TargetWakeMin int    `json:"targetWakeMin"`
	WakeWindowMin int   `json:"wakeWindowMin"`
}

// CycleBoundary is one 90-minute ultradian phase end.
type CycleBoundary struct {
	Cycle    int    `json:"cycle"`
	EndMin   int    `json:"endMin"`
	EndLabel string `json:"endLabel"`
	Stage    string `json:"stage"`
}

// ClinicalResponse is the scored result returned to the Vue client.
type ClinicalResponse struct {
	Ahi          float64         `json:"ahi"`
	Grade        AhiGrade        `json:"grade"`
	StopBang     int             `json:"stopBang"`
	Risk         string          `json:"risk"`
	Epworth      int             `json:"epworth"`
	EpworthBand  string          `json:"epworthBand"`
	Cycles       []CycleBoundary `json:"cycles"`
	IdealWakeMin int             `json:"idealWakeMin"`
	InertiaRisk  bool            `json:"inertiaRisk"`
	Note         string          `json:"note"`
}

// GradeAhi maps events/hour to an AASM severity band.
func GradeAhi(ahi float64) AhiGrade {
	switch {
	case ahi < 5:
		return GradeNormal
	case ahi < 15:
		return GradeMild
	case ahi < 30:
		return GradeModerate
	default:
		return GradeSevere
	}
}

// ScoreStopBang returns the 0-8 STOP-BANG count.
// BMI > 35, Age > 50, Neck > 43 cm (male) / 40 cm (female) score a point.
func ScoreStopBang(r StopBangRequest) int {
	score := 0
	if r.Snoring {
		score++
	}
	if r.Tired {
		score++
	}
	if r.Observed {
		score++
	}
	if r.Pressure {
		score++
	}
	if r.Bmi > 35 {
		score++
	}
	if r.Age > 50 {
		score++
	}
	neckLimit := 40.0
	if r.Male {
		neckLimit = 43.0
	}
	if r.NeckCm > neckLimit {
		score++
	}
	if r.Male {
		score++
	}
	return score
}

// RiskBand maps a STOP-BANG score to an OSA risk tier.
func RiskBand(score int) string {
	switch {
	case score <= 2:
		return "LOW"
	case score <= 4:
		return "INTERMEDIATE"
	default:
		return "HIGH"
	}
}

// EpworthBand maps the 0-24 ESS total to excessive-daytime-sleepiness severity.
func EpworthBand(score int) string {
	switch {
	case score <= 7:
		return "NORMAL"
	case score <= 10:
		return "MILD_EDS"
	case score <= 15:
		return "MODERATE_EDS"
	default:
		return "SEVERE_EDS"
	}
}

// UltradianBoundaries returns six 90-minute cycle ends from bedtime.
// N3 deep delta dominates cycles 1-2; REM lengthens through cycles 5-6.
func UltradianBoundaries(bedtimeMin int) []CycleBoundary {
	out := make([]CycleBoundary, 0, 6)
	for c := 1; c <= 6; c++ {
		end := (bedtimeMin + c*90) % 1440
		stage := "N2_LIGHT"
		switch {
		case c <= 2:
			stage = "N3_DEEP"
		case c == 3:
			stage = "N3_MIXED"
		case c >= 5:
			stage = "REM_LONG"
		}
		out = append(out, CycleBoundary{
			Cycle:    c,
			EndMin:   end,
			EndLabel: FormatClock(end),
			Stage:    stage,
		})
	}
	return out
}

// IdealWake finds the cycle boundary closest to the target wake time.
func IdealWake(bedtimeMin, targetWakeMin, windowMin int) (int, bool, string) {
	cycles := UltradianBoundaries(bedtimeMin)
	best := targetWakeMin
	bestDelta := 1440
	for _, c := range cycles {
		d := absDelta(c.EndMin, targetWakeMin)
		if d < bestDelta {
			bestDelta = d
			best = c.EndMin
		}
	}
	inWindow := bestDelta <= windowMin
	note := "Target wake is near a 90-minute clock boundary; actual sleep stages vary."
	if !inWindow {
		note = "Nearest 90-minute clock boundary is outside the window; sleep stage cannot be inferred from clock time."
	}
	return best, inWindow, note
}

// FormatClock renders minutes-from-midnight as HH:MM.
func FormatClock(min int) string {
	h := (min / 60) % 24
	m := min % 60
	return pad(h) + ":" + pad(m)
}

func pad(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := ""
	for n > 0 {
		digits = string(rune('0'+n%10)) + digits
		n /= 10
	}
	return digits
}

func absDelta(a, b int) int {
	d := a - b
	if d < 0 {
		d = -d
	}
	if d > 720 {
		d = 1440 - d
	}
	return d
}

// Handler is the Vercel Go serverless entrypoint.
func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var req StopBangRequest
	if r.Method == http.MethodPost {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
			return
		}
	}
	if req.WakeWindowMin == 0 {
		req.WakeWindowMin = 20
	}
	if req.BedtimeMin == 0 {
		req.BedtimeMin = 22*60 + 30
	}

	score := ScoreStopBang(req)
	ideal, inWindow, note := IdealWake(req.BedtimeMin, req.TargetWakeMin, req.WakeWindowMin)

	resp := ClinicalResponse{
		Ahi:          math.Round(req.Ahi*10) / 10,
		Grade:        GradeAhi(req.Ahi),
		StopBang:     score,
		Risk:         RiskBand(score),
		Epworth:      req.Epworth,
		EpworthBand:  EpworthBand(req.Epworth),
		Cycles:       UltradianBoundaries(req.BedtimeMin),
		IdealWakeMin: ideal,
		InertiaRisk:  !inWindow,
		Note:         note,
	}
	_ = json.NewEncoder(w).Encode(resp)
}
