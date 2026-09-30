package com.pulseepg.tvguide;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity sécurisée pour Box Android TV (ex: Echolink Atomo) et appareils mobiles/tablettes :
 * 1. Protège le cycle de vie de l'Activity contre les crashs liés à la barre de statut (setDecorFitsSystemWindows).
 * 2. Maintient l'accélération matérielle GPU (Hardware Acceleration) stable sans surcharge de tuiles hors-écran.
 * 3. Désactive les APIs WebView trop récentes ou instables (SafeBrowsing, AlgorithmicDarkening, OffscreenPreRaster)
 *    qui provoquent des écrans noirs sur les anciens moteurs Android System WebView.
 */
public class MainActivity extends BridgeActivity {

    private static final int BG_MIDNIGHT_NAVY = Color.parseColor("#0A0E17");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Configuration pré-super sécurisée de la fenêtre pour éviter toute interruption du cycle de vie sur Android TV
        configureSafeWindowDecorFitsSystemWindows();

        super.onCreate(savedInstanceState);

        // Ré-application post-super au cas où un plugin Capacitor aurait modifié les flags de fenêtre
        configureSafeWindowDecorFitsSystemWindows();
        configureAndroidTvWebViewSafety();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureAndroidTvWebViewSafety();
    }

    private boolean isTelevisionDevice() {
        try {
            UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
            if (uiModeManager != null && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) {
                return true;
            }
            return getPackageManager().hasSystemFeature("android.software.leanback")
                || getPackageManager().hasSystemFeature("android.hardware.type.television");
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Garantit que setDecorFitsSystemWindows et la gestion de la barre de statut
     * n'interrompent jamais le cycle de vie de l'Activity au lancement sur Box Android TV.
     */
    private void configureSafeWindowDecorFitsSystemWindows() {
        try {
            Window window = getWindow();
            if (window == null) {
                return;
            }

            window.getDecorView().setBackgroundColor(BG_MIDNIGHT_NAVY);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

            // Force l'accélération matérielle stable au niveau de la fenêtre
            window.setFlags(
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            );

            // Sur Android TV, on maintient decorFitsSystemWindows = true pour éviter les surfaces WebView à 0px
            // et les exceptions WindowInsetsController sur les firmwares AOSP TV dépourvus de StatusBar.
            boolean fitSystemWindows = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    window.setDecorFitsSystemWindows(fitSystemWindows);
                } catch (Throwable ignored) {
                    // Fallback silencieux sur certaines ROMs Android TV personnalisées
                }
            } else {
                try {
                    WindowCompat.setDecorFitsSystemWindows(window, fitSystemWindows);
                } catch (Throwable ignored) {
                    // Ignore
                }
            }

            if (!isTelevisionDevice() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                try {
                    window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                    window.setStatusBarColor(BG_MIDNIGHT_NAVY);
                    window.setNavigationBarColor(BG_MIDNIGHT_NAVY);
                } catch (Throwable ignored) {
                    // Ignore sur les box TV sans barre de statut système
                }
            }
        } catch (Throwable ignored) {
            // Ne jamais interrompre onCreate() si le WindowManager TV rejette un attribut
        }
    }

    /**
     * Stabilise le rendu GPU de la WebView et désactive les APIs WebView trop récentes
     * qui plantent ou bloquent le rendu sur les anciens moteurs Android TV (ex: Echolink Atomo).
     */
    private void configureAndroidTvWebViewSafety() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                return;
            }

            final WebView webView = getBridge().getWebView();
            webView.setBackgroundColor(BG_MIDNIGHT_NAVY);

            // Maintient l'accélération matérielle (GPU) stable
            try {
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            } catch (Throwable ignored) {
                // Ignore
            }

            // Focus clavier / D-Pad télécommande immédiat pour Android TV
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);

            WebSettings settings = webView.getSettings();
            if (settings == null) {
                return;
            }

            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                try {
                    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
                } catch (Throwable ignored) {
                    // Ignore
                }
            }

            // 1. Désactive OffscreenPreRaster (évite la saturation VRAM sur GPU Mali-450 / Mali-G31 des Box TV)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    settings.setOffscreenPreRaster(false);
                } catch (Throwable ignored) {
                    // Ignore
                }
            }

            // 2. Désactive SafeBrowsing (bloque souvent le premier chargement sur Box Android TV sans GMS complet)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    settings.setSafeBrowsingEnabled(false);
                } catch (Throwable ignored) {
                    // Ignore
                }
            }

            // 3. Désactive AlgorithmicDarkening / ForceDark auto qui fait planter certains anciens moteurs WebView TV
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                try {
                    settings.setAlgorithmicDarkeningAllowed(false);
                } catch (Throwable ignored) {
                    // Ignore
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    //noinspection deprecation
                    settings.setForceDark(WebSettings.FORCE_DARK_OFF);
                } catch (Throwable ignored) {
                    // Ignore
                }
            }
        } catch (Throwable ignored) {
            // Protection totale contre tout crash d'initialisation WebView
        }
    }
}
