package com.somnopulse.sleep;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * SOMNO-PULSE Android host activity (Java 17 + Capacitor 6).
 *
 * Registers the two native somnology plugins so the WebView can drive:
 *   - MattressActigraphyPlugin      (50 Hz ballistocardiography / actigraphy IMU)
 *   - NocturnalAudioMonitorPlugin   (uncompressed 16 kHz PCM respiratory capture)
 *
 * Edge-to-edge bedside layout: the phone sits on the nightstand or on the
 * corner of the mattress for an 8-hour overnight session.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register native plugins before the bridge initialises the WebView.
        registerPlugin(MattressActigraphyPlugin.class);
        registerPlugin(NocturnalAudioMonitorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
