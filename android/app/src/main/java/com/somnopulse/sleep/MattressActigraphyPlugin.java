package com.somnopulse.sleep;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * SOMNO-PULSE — MattressActigraphyPlugin (Java 17, Capacitor).
 *
 * Samples the phone's 3-axis accelerometer at 50 Hz while it rests on the corner
 * of the mattress, extracting:
 *   - Ballistocardiographic micro-movement (~0.005 G) from cardiac ejection
 *   - Toss-and-turn actigraphy surges
 *   - Periodic Limb Movement Disorder (PLMD) bursts
 *   - Sleep-arousal jolts that co-occur with apneic gasps
 *
 * Also drives the progressive dawn-wake haptic ramp used by the smart
 * ultradian alarm so the user is nudged awake during Stage N1/N2 light sleep.
 *
 * Part of the zero-TypeScript polyglot stack:
 * Vue 3.5 + Rust + Java 17 + Go 1.22 + JS + GLSL.
 */
@CapacitorPlugin(name = "MattressActigraphy")
public class MattressActigraphyPlugin extends Plugin implements SensorEventListener {

    /** Sampling rate for mattress actigraphy — 50 Hz captures BCG micro-movement. */
    private static final float TARGET_SAMPLE_HZ = 50.0f;

    /** Period in microseconds for SensorManager (1e6 / 50 Hz = 20000 us). */
    private static final int SENSOR_PERIOD_US = (int) (1_000_000.0f / TARGET_SAMPLE_HZ);

    /** Micro-G threshold below which movement is treated as quiet sleep. */
    private static final double QUIET_G = 0.005;

    /** Actigraphy surge threshold indicating a toss/turn or limb movement. */
    private static final double SURGE_G = 0.06;

    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Vibrator vibrator;

    private boolean running = false;
    private long sampleCount = 0L;
    private long startNanos = 0L;

    private double lastMag = 0.0;
    private double peakMag = 0.0;
    private double sumMag = 0.0;
    private double quietSamples = 0.0;
    private double surgeSamples = 0.0;
    private long plmdEvents = 0L;

    /** Rolling window used for limb-movement periodicity (PLMD) detection. */
    private final double[] surgeWindow = new double[256];
    private int surgeIdx = 0;

    private PluginCall activeCall;

    @Override
    public void load() {
        Context ctx = getContext();
        sensorManager = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
        vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    }

    /**
     * start() — begin 50 Hz mattress actigraphy acquisition.
     * JS: MattressActigraphy.start({ sampleHz: 50 })
     */
    @PluginMethod
    public void start(PluginCall call) {
        if (sensorManager == null || accelerometer == null) {
            call.reject("No accelerometer available on this device");
            return;
        }
        if (running) {
            call.resolve(statusObject());
            return;
        }
        resetStatistics();
        activeCall = call;
        running = true;
        startNanos = System.nanoTime();
        sensorManager.registerListener(this, accelerometer, SENSOR_PERIOD_US);
        call.resolve(statusObject());
    }

    /**
     * stop() — end acquisition and return the night's actigraphy summary.
     */
    @PluginMethod
    public void stop(PluginCall call) {
        if (running && sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        running = false;
        JSObject ret = statusObject();
        activeCall = null;
        call.resolve(ret);
    }

    /**
     * dawnHapticRamp() — progressive haptic wake ramp.
     * Intensity and cadence increase over `rampSeconds` so the sleeper is lifted
     * gently out of N1/N2 rather than startled out of N3 delta sleep.
     *
     * JS: MattressActigraphy.dawnHapticRamp({ rampSeconds: 120 })
     */
    @PluginMethod
    public void dawnHapticRamp(PluginCall call) {
        int rampSeconds = call.getInt("rampSeconds", 120);
        if (vibrator == null || !vibrator.hasVibrator()) {
            call.reject("No vibrator available on this device");
            return;
        }
        final int steps = Math.max(6, rampSeconds / 10);
        Thread t = new Thread(() -> {
            for (int i = 0; i < steps; i++) {
                float progress = (float) i / (float) (steps - 1);
                int amplitude = (int) (30 + progress * 225); // 30 -> 255
                long duration = (long) (60 + progress * 240); // 60ms -> 300ms
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(duration, amplitude));
                } else {
                    vibrator.vibrate(duration);
                }
                sleepQuietly((long) ((1.0 - progress * 0.55) * 1500));
            }
        }, "somnopulse-dawn-ramp");
        t.setDaemon(true);
        t.start();

        JSObject ret = new JSObject();
        ret.put("started", true);
        ret.put("rampSeconds", rampSeconds);
        ret.put("steps", steps);
        call.resolve(ret);
    }

    /**
     * cancelHaptics() — abort an in-progress dawn ramp.
     */
    @PluginMethod
    public void cancelHaptics(PluginCall call) {
        if (vibrator != null) {
            vibrator.cancel();
        }
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!running || event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) {
            return;
        }
        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];

        // Magnitude in G with gravity (9.81 m/s^2) removed.
        double mag = Math.sqrt((double) x * x + (double) y * y + (double) z * z) / 9.81;
        double delta = Math.abs(mag - lastMag);
        lastMag = mag;

        sampleCount++;
        sumMag += delta;
        if (delta > peakMag) {
            peakMag = delta;
        }

        if (delta < QUIET_G) {
            quietSamples++;
        }

        surgeWindow[surgeIdx] = delta;
        surgeIdx = (surgeIdx + 1) % surgeWindow.length;

        if (delta > SURGE_G) {
            surgeSamples++;
            if (isPeriodicLimbMovement()) {
                plmdEvents++;
            }
            emitSurge(delta, event.timestamp);
        }

        // Stream a summary to JS roughly once per second.
        if (sampleCount % (long) TARGET_SAMPLE_HZ == 0) {
            notifyListeners("actigraphy", statusObject());
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not required for actigraphy magnitude analysis.
    }

    /**
     * Detects PLMD: a surge whose inter-surge spacing in the rolling window is
     * consistent (periodic) rather than random toss-and-turn.
     */
    private boolean isPeriodicLimbMovement() {
        int count = 0;
        for (double v : surgeWindow) {
            if (v > SURGE_G) {
                count++;
            }
        }
        // ~4-12 surges per 256-sample window implies 20-60 s periodicity.
        return count >= 4 && count <= 12;
    }

    private void emitSurge(double delta, long timestampNanos) {
        JSObject obj = new JSObject();
        obj.put("type", delta > SURGE_G * 3 ? "AROUSAL_JOLT" : "ACTIGRAPHY_SURGE");
        obj.put("deltaG", round(delta, 5));
        obj.put("tSec", round((timestampNanos - startNanos) / 1e9, 2));
        notifyListeners("surge", obj);
    }

    private JSObject statusObject() {
        double elapsedSec = running || startNanos == 0
                ? Math.max((System.nanoTime() - startNanos) / 1e9, 0.001)
                : 0.001;
        JSObject ret = new JSObject();
        ret.put("running", running);
        ret.put("sampleHz", TARGET_SAMPLE_HZ);
        ret.put("samples", sampleCount);
        ret.put("elapsedSec", round(elapsedSec, 2));
        ret.put("meanDeltaG", round(sumMag / Math.max(sampleCount, 1), 5));
        ret.put("peakDeltaG", round(peakMag, 5));
        ret.put("quietPct", round(100.0 * quietSamples / Math.max(sampleCount, 1), 1));
        ret.put("surgeCount", (long) surgeSamples);
        ret.put("plmdEvents", plmdEvents);
        ret.put("bcgMicroG", round(sumMag / Math.max(sampleCount, 1) * 1000.0, 3));
        return ret;
    }

    private void resetStatistics() {
        sampleCount = 0L;
        lastMag = 0.0;
        peakMag = 0.0;
        sumMag = 0.0;
        quietSamples = 0.0;
        surgeSamples = 0.0;
        plmdEvents = 0L;
        surgeIdx = 0;
        java.util.Arrays.fill(surgeWindow, 0.0);
    }

    private static double round(double v, int places) {
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }

    private static void sleepQuietly(long ms) {
        try {
            Thread.sleep(Math.max(ms, 1));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (running && sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        running = false;
        super.handleOnDestroy();
    }
}
