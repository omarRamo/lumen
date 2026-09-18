package com.omartrabelsi.lumen;

import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Collections;

/**
 * L'écran entier appartient au jeu : pas de barres, pas de veille, pas de geste volé.
 * Tout le reste — zones sûres, pause, sauvegarde — est décidé par le web, comme sur iOS.
 */
public class MainActivity extends BridgeActivity {

    /** Android n'accorde que 200 dp d'exclusion de geste par bord. Ils vont au pouce. */
    private static final int THUMB_BAND_DP = 200;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Le dessin va jusqu'aux bords ; l'encoche est rendue au CSS par env(safe-area-inset-*).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }

        // Une traversée dure plus longtemps qu'un délai de veille.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Cadence tenue plutôt qu'un pic suivi d'une chute thermique.
        getWindow().setSustainedPerformanceMode(true);

        hideSystemBars();
        keepThumbsAwayFromSystemGestures();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Une notification balayée fait revenir les barres : elles repartent au retour du focus.
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    /**
     * Les commandes tactiles tiennent le bas de l'écran, là où la navigation gestuelle
     * attend le « retour » et l'accueil. Cette bande revient au jeu.
     */
    private void keepThumbsAwayFromSystemGestures() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        getWindow()
            .getDecorView()
            .addOnLayoutChangeListener((view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
                int width = right - left, height = bottom - top;
                int band = Math.min(
                    height,
                    (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, THUMB_BAND_DP, getResources().getDisplayMetrics())
                );
                view.setSystemGestureExclusionRects(Collections.singletonList(new Rect(0, height - band, width, height)));
            });
    }
}
