package net.mlultimate.client.animation;

/**
 * Easing mathematical functions for MLUltimate Client UI animations.
 * Provides smooth transitions independent of render framerate.
 */
public enum Ease {
    LINEAR {
        @Override
        public double ease(double t) {
            return t;
        }
    },
    EASE_IN_QUAD {
        @Override
        public double ease(double t) {
            return t * t;
        }
    },
    EASE_OUT_QUAD {
        @Override
        public double ease(double t) {
            return t * (2.0 - t);
        }
    },
    EASE_IN_OUT_QUAD {
        @Override
        public double ease(double t) {
            return t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t;
        }
    },
    EASE_IN_CUBIC {
        @Override
        public double ease(double t) {
            return t * t * t;
        }
    },
    EASE_OUT_CUBIC {
        @Override
        public double ease(double t) {
            double f = t - 1.0;
            return f * f * f + 1.0;
        }
    },
    EASE_IN_OUT_CUBIC {
        @Override
        public double ease(double t) {
            return t < 0.5 ? 4.0 * t * t * t : (t - 1.0) * (2.0 * t - 2.0) * (2.0 * t - 2.0) + 1.0;
        }
    },
    EASE_OUT_BACK {
        @Override
        public double ease(double t) {
            double c1 = 1.70158;
            double c3 = c1 + 1.0;
            double f = t - 1.0;
            return 1.0 + c3 * Math.pow(f, 3) + c1 * Math.pow(f, 2);
        }
    },
    EASE_OUT_ELASTIC {
        @Override
        public double ease(double t) {
            if (t <= 0.0) return 0.0;
            if (t >= 1.0) return 1.0;
            double c4 = (2.0 * Math.PI) / 3.0;
            return Math.pow(2.0, -10.0 * t) * Math.sin((t * 10.0 - 0.75) * c4) + 1.0;
        }
    };

    public abstract double ease(double t);
}
