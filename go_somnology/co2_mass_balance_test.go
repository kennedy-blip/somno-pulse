package somnology

import (
    "math"
    "testing"
)

func TestSimulationAndVentilation(t *testing.T) {
    room := Room{LengthM: 4.5, WidthM: 3.5, HeightM: 2.6, Occupants: 2, Ach: 0}
    closed := SimulateCO2(room, 480)
    expected := OutdoorCO2 + room.GenerationLPerHr()*1000/room.VolumeM3()*8
    if math.Abs(PeakPpm(closed)-expected) > 1 {
        t.Fatalf("closed room expected about %.2f ppm, got %.2f", expected, PeakPpm(closed))
    }
    target := PrescribeVentilation(room)
    room.Ach = target.Ach
    if peak := PeakPpm(SimulateCO2(room, 480)); peak > 900 {
        t.Fatalf("recommended ACH %.2f gave %.0f ppm", room.Ach, peak)
    }
}

func TestHighVentilationIsStable(t *testing.T) {
    room := Room{LengthM: 4.5, WidthM: 3.5, HeightM: 2.6, Occupants: 2, Ach: 20}
    peak := PeakPpm(SimulateCO2(room, 480))
    if peak < OutdoorCO2 || peak > 500 {
        t.Fatalf("unexpected high ventilation peak %.0f", peak)
    }
}
