/**
 * PGR algorithm configuration.
 * Centralise all thresholds and defaults so they are never scattered across files.
 */
export declare const PGR_CONFIG: {
    readonly DEFAULT_RATING: 1500;
    readonly DEFAULT_RD: 350;
    readonly DEFAULT_VOLATILITY: 0.06;
    readonly TAU: 0.5;
    readonly CONVERGENCE_EPSILON: 0.000001;
    readonly MAX_RD: 350;
    readonly RATING_PERIOD_DAYS: 7;
    readonly PROVISIONAL_THRESHOLD: 15;
    readonly STABLE_THRESHOLD: 50;
    readonly STABLE_RD_TARGET: 100;
    readonly PUBLIC_RATING_MIN_MATCHES: 3;
    readonly ALGORITHM_VERSION: "glicko2-v1";
    readonly QUESTIONNAIRE_RATINGS: {
        readonly COMPLETE_BEGINNER: {
            readonly rating: 900;
            readonly rd: 400;
        };
        readonly RECREATIONAL: {
            readonly rating: 1100;
            readonly rd: 350;
        };
        readonly CLUB_BEGINNER: {
            readonly rating: 1300;
            readonly rd: 300;
        };
        readonly LOCAL_COMPETITOR: {
            readonly rating: 1500;
            readonly rd: 250;
        };
    };
    readonly SOURCE_INITIAL_RD: {
        readonly WTT: 100;
        readonly ITTF: 100;
        readonly TTR: 120;
        readonly FFTT: 150;
        readonly RANKEDIN: 170;
        readonly RFETM: 170;
        readonly FITET: 180;
        readonly CTTA: 180;
        readonly JTTA: 180;
        readonly KTTF: 180;
        readonly PING_PANG: 200;
        readonly MANUAL: 250;
        readonly QUESTIONNAIRE: 300;
    };
};
export type PgrConfig = typeof PGR_CONFIG;
//# sourceMappingURL=config.d.ts.map