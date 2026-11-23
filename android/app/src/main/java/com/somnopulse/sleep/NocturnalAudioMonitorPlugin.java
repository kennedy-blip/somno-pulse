package com.somnopulse.sleep;

import android.Manifest;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Arrays;

/**
 * SOMNO-PULSE — NocturnalAudioMonitorPlugin (Java 17, Capacitor).
 *
 * Captures uncompressed overnight respiratory acoustics via {@link AudioRecord}
 * with NO platform voice processing. This is critical for clinical fidelity:
 * Android's default AudioRecord path may apply AGC / noise suppression /
 * acoustic echo cancellation, which destroys exactly the signals we need:
 *
 *   - Quiet nasal breathing at ~25 dBA
 *   - 10+ second apneic silence troughs (would be "gated" by AGC)
 *   - 3.2-4.1 kHz enamel-on-enamel bruxism grinding bursts
 *   - 620 Hz pharyngeal resuscitative gasps
 *
 * We therefore request {@code MediaRecorder.AudioSource.UNPROCESSED} where
 * available (API 24+) and fall back to MIC otherwise, with a 16-bit mono PCM
 * stream at 16 kHz feeding a Goertzel-band energy estimator on-device.
 *
 * Detection bands (mirrors rust-somnology/src/apnea_ahi_detector.rs):
 *   PALATAL_SNORE      45 - 160 Hz
 *   TONGUE_BASE_CHOKE 250 - 950 Hz
 *   BRUXISM_GRIND    1800 - 4800 Hz
 *
 * Zero-TypeScript polyglot stack: Vue 3.5 + Rust + Java 17 + Go 1.22 + JS + GLSL.
 */
@CapacitorPlugin(
        name = "NocturnalAudioMonitor",
        permissions = { @com.getcapacitor.annotation.Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class NocturnalAudioMonitorPlugin extends Plugin {

    private static final int SAMPLE_RATE = 16000;
    private static final int CHANNEL = AudioFormat.CHANNEL_IN_MONO;
    private static final int ENCODING = AudioFormat.ENCODING_PCM_16BIT;

    /** Apnea rule: respiratory envelope silence lasting at least this many seconds. */
    private static final double APNEA_MIN_SEC = 10.0;

    /** Resuscitative gasp must exceed this normalized amplitude to count as apnea. */
    private static final double GASP_THRESHOLD = 0.55;

    /** Band edges in Hz. */
    private static final double[] PALATAL = { 45.0, 160.0 };
    private static final double[] TONGUE_BASE = { 250.0, 950.0 };
    private static final double[] BRUXISM = { 1800.0, 4800.0 };

    private AudioRecord recorder;
    private Thread captureThread;
    private volatile boolean running = false;

    private long framesRead = 0L;
    private long apneaEvents = 0L;
    private long hypopneaEvents = 0L;
    private long snoreEvents = 0L;
    private long bruxismBursts = 0L;
    private double silenceSec = 0.0;
    private double recordSilenceSec = 0.0;
    private double sessionSec = 0.0;
    private double lastPeakHz = 0.0;
    private double lastPeakAmp = 0.0;

    /**
     * start() — begin uncompressed nocturnal capture.
     * JS: NocturnalAudioMonitor.start()
     */
    @PluginMethod
    public void start(PluginCall call) {
        if (running) {
            call.resolve(statusObject());
            return;
        }
        int minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL, ENCODING);
        if (minBuf <= 0) {
            call.reject("Device cannot allocate an audio buffer at 16 kHz mono PCM");
            return;
        }
        final int bufferSize = Math.max(minBuf, SAMPLE_RATE / 5); // >= 200 ms

        recorder = createUnprocessedRecord(bufferSize);
        if (recorder == null || recorder.getState() != AudioRecord.STATE_INITIALIZED) {
            call.reject("AudioRecord init failed — grant microphone permission and retry");
            return;
        }

        resetStatistics();
        running = true;
        captureThread = new Thread(this::captureLoop, "somnopulse-nocturnal-audio");
        captureThread.setDaemon(true);
        captureThread.start();

        JSObject ret = statusObject();
        ret.put("bufferSize", bufferSize);
        call.resolve(ret);
    }

    /**
     * Requests a genuinely UNPROCESSED source so AGC / NS / AEC are bypassed.
     */
    private AudioRecord createUnprocessedRecord(int bufferSize) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                return new AudioRecord(
                        MediaRecorder.AudioSource.UNPROCESSED,
                        SAMPLE_RATE, CHANNEL, ENCODING, bufferSize);
            }
        } catch (IllegalArgumentException ignored) {
            // Fall through to the MIC source below.
        }
        try {
            return new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE, CHANNEL, ENCODING, bufferSize);
        } catch (IllegalArgumentException | SecurityException e) {
            return null;
        }
    }

    /**
     * stop() — end capture and return the night's respiratory summary + AHI.
     */
    @PluginMethod
    public void stop(PluginCall call) {
        running = false;
        if (captureThread != null) {
            try {
                captureThread.join(1500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            captureThread = null;
        }
        if (recorder != null) {
            try {
                recorder.stop();
            } catch (IllegalStateException ignored) {
                // Already stopped.
            }
            recorder.release();
            recorder = null;
        }
        call.resolve(statusObject());
    }

    /** 200 ms analysis frame loop. */
    private void captureLoop() {
        final int frameSamples = SAMPLE_RATE / 5;
        final short[] pcm = new short[frameSamples];

        try {
            recorder.startRecording();
        } catch (IllegalStateException e) {
            running = false;
            return;
        }

        while (running) {
            int read = recorder.read(pcm, 0, frameSamples);
            if (read <= 0) {
                continue;
            }
            framesRead += read;
            sessionSec += read / (double) SAMPLE_RATE;

            double rms = rms(pcm, read);
            double norm = Math.min(rms / 3000.0, 1.0);

            double palatal = goertzelBand(pcm, read, PALATAL[0], PALATAL[1]);
            double tongue = goertzelBand(pcm, read, TONGUE_BASE[0], TONGUE_BASE[1]);
            double grind = goertzelBand(pcm, read, BRUXISM[0], BRUXISM[1]);
            double peakHz = dominantHz(pcm, read);
            lastPeakHz = peakHz;
            lastPeakAmp = norm;

            // --- Apnea / hypopnea: silence >= 10 s then a resuscitative gasp ---
            if (norm < 0.06) {
                silenceSec += read / (double) SAMPLE_RATE;
                if (silenceSec > recordSilenceSec) {
                    recordSilenceSec = silenceSec;
                }
            } else {
                if (silenceSec >= APNEA_MIN_SEC) {
                    if (norm > GASP_THRESHOLD) {
                        apneaEvents++;
                        emitEvent("OBSTRUCTIVE_APNEA", silenceSec, norm, peakHz);
                    } else {
                        hypopneaEvents++;
                        emitEvent("HYPOPNEA", silenceSec, norm, peakHz);
                    }
                }
                silenceSec = 0.0;
            }

            // --- Snore classification by formant site ---
            if (palatal > 0.35 || tongue > 0.35) {
                snoreEvents++;
                String site = tongue > palatal ? "VELOPHARYNGEAL_TONGUE_BASE" : "PALATAL";
                JSObject obj = new JSObject();
                obj.put("type", "SNORE");
                obj.put("site", site);
                obj.put("peakHz", round(peakHz, 1));
                obj.put("palatalEnergy", round(palatal, 4));
                obj.put("tongueEnergy", round(tongue, 4));
                obj.put("tSec", round(sessionSec, 2));
                notifyListeners("snore", obj);
            }

            // --- Bruxism: 1.8-4.8 kHz enamel tribological friction ---
            if (grind > 0.45) {
                bruxismBursts++;
                JSObject obj = new JSObject();
                obj.put("type", "BRUXISM_BURST");
                obj.put("peakHz", round(peakHz, 1));
                obj.put("bandEnergy", round(grind, 4));
                obj.put("amplitude", round(norm, 4));
                obj.put("tSec", round(sessionSec, 2));
                notifyListeners("bruxism", obj);
            }

            JSObject live = new JSObject();
            live.put("rms", round(rms, 2));
            live.put("normalized", round(norm, 4));
            live.put("peakHz", round(peakHz, 1));
            live.put("palatal", round(palatal, 4));
            live.put("tongueBase", round(tongue, 4));
            live.put("bruxism", round(grind, 4));
            live.put("silenceSec", round(silenceSec, 2));
            notifyListeners("envelope", live);
        }

        try {
            recorder.stop();
        } catch (IllegalStateException ignored) {
            // Best effort.
        }
    }

    private void emitEvent(String type, double dur, double amp, double hz) {
        JSObject obj = new JSObject();
        obj.put("type", type);
        obj.put("durationSec", round(dur, 2));
        obj.put("gaspAmplitude", round(amp, 4));
        obj.put("peakHz", round(hz, 1));
        obj.put("tSec", round(sessionSec, 2));
        notifyListeners("apnea", obj);
    }

    private JSObject statusObject() {
        double hours = Math.max(sessionSec / 3600.0, 0.25 / 60.0);
        double ahi = (apneaEvents + hypopneaEvents) / Math.max(hours, 0.004);
        JSObject ret = new JSObject();
        ret.put("running", running);
        ret.put("sampleRate", SAMPLE_RATE);
        ret.put("unprocessedSource", android.os.Build.VERSION.SDK_INT >= 24);
        ret.put("framesRead", framesRead);
        ret.put("sessionSec", round(sessionSec, 2));
        ret.put("apneaEvents", apneaEvents);
        ret.put("hypopneaEvents", hypopneaEvents);
        ret.put("snoreEvents", snoreEvents);
        ret.put("bruxismBursts", bruxismBursts);
        ret.put("longestSilenceSec", round(recordSilenceSec, 2));
        ret.put("ahi", round(ahi, 1));
        ret.put("ahiGrade", gradeAhi(ahi));
        ret.put("lastPeakHz", round(lastPeakHz, 1));
        ret.put("lastAmplitude", round(lastPeakAmp, 4));
        return ret;
    }

    /** AASM AHI severity grading — mirrors api/somno_clinical.go. */
    private static String gradeAhi(double ahi) {
        if (ahi < 5.0) return "NORMAL";
        if (ahi < 15.0) return "MILD";
        if (ahi < 30.0) return "MODERATE";
        return "SEVERE";
    }

    private static double rms(short[] buf, int n) {
        double acc = 0.0;
        for (int i = 0; i < n; i++) {
            acc += (double) buf[i] * buf[i];
        }
        return Math.sqrt(acc / Math.max(n, 1));
    }

    /**
     * Goertzel band energy: relative power concentrated between lo and hi Hz,
     * normalized 0..1. Cheap enough for an 8-hour overnight session.
     */
    private double goertzelBand(short[] buf, int n, double lo, double hi) {
        final int probes = 12;
        double total = 0.0;
        double energySum = rms(buf, n);
        for (int p = 0; p < probes; p++) {
            double f = lo + (hi - lo) * (p / (double) (probes - 1));
            double k = Math.round(n * f / SAMPLE_RATE);
            double w = 2.0 * Math.PI * k / n;
            double coeff = 2.0 * Math.cos(w);
            double s0 = 0.0, s1 = 0.0, s2 = 0.0;
            for (int i = 0; i < n; i++) {
                s0 = buf[i] + coeff * s1 - s2;
                s2 = s1;
                s1 = s0;
            }
            double power = Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
            total = Math.max(total, power);
        }
        double norm = total / (n * 12000.0 + 1e-9);
        return Math.min(norm * (1.0 + Math.min(energySum / 3000.0, 1.0)), 1.0);
    }

    /** Coarse dominant-frequency estimate via a 64-bin magnitude scan. */
    private double dominantHz(short[] buf, int n) {
        final int bins = 64;
        double bestMag = -1.0;
        double bestHz = 0.0;
        for (int b = 1; b <= bins; b++) {
            double f = b * (SAMPLE_RATE / 2.0) / bins;
            double re = 0.0, im = 0.0;
            // Decimate by 8 for speed; adequate for band identification.
            for (int i = 0; i < n; i += 8) {
                double ang = 2.0 * Math.PI * f * i / SAMPLE_RATE;
                re += buf[i] * Math.cos(ang);
                im -= buf[i] * Math.sin(ang);
            }
            double mag = Math.sqrt(re * re + im * im);
            if (mag > bestMag) {
                bestMag = mag;
                bestHz = f;
            }
        }
        return bestHz;
    }

    private void resetStatistics() {
        framesRead = 0L;
        apneaEvents = 0L;
        hypopneaEvents = 0L;
        snoreEvents = 0L;
        bruxismBursts = 0L;
        silenceSec = 0.0;
        recordSilenceSec = 0.0;
        sessionSec = 0.0;
        lastPeakHz = 0.0;
        lastPeakAmp = 0.0;
    }

    private static double round(double v, int places) {
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }

    @Override
    protected void handleOnDestroy() {
        running = false;
        if (recorder != null) {
            try {
                recorder.stop();
            } catch (IllegalStateException ignored) {
                // Best effort.
            }
            recorder.release();
            recorder = null;
        }
        super.handleOnDestroy();
    }

    /** Exposed for unit testing of the apnea silence rule. */
    static boolean qualifiesAsApnea(double silenceSeconds, double gaspAmplitude) {
        return silenceSeconds >= APNEA_MIN_SEC && gaspAmplitude > GASP_THRESHOLD;
    }

    /** Exposed for unit testing — unused arrays must not leak into analysis. */
    static double[] bandEdges(String band) {
        switch (band) {
            case "PALATAL": return Arrays.copyOf(PALATAL, PALATAL.length);
            case "TONGUE_BASE": return Arrays.copyOf(TONGUE_BASE, TONGUE_BASE.length);
            case "BRUXISM": return Arrays.copyOf(BRUXISM, BRUXISM.length);
            default: return new double[0];
        }
    }
}
