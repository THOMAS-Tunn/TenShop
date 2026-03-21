import { useAppSettings } from "../lib/app-settings";

const STAR_FIELD = Array.from({ length: 54 }, (_, index) => ({
  top: 6 + ((index * 11) % 58),
  left: 3 + ((index * 17) % 94),
  size: [1.2, 1.6, 2.1, 1.4, 2.8, 1.8][index % 6],
  opacity: 0.42 + (index % 5) * 0.11,
  delay: -((index % 9) * 0.55),
  duration: 2.8 + (index % 7) * 0.8,
}));

// Cloud definitions per layer: [widthPct, heightPct, leftPct, topPct, delayS]
const CLOUDS_FAR = [
  [32, 100, -2, 18, 0],
  [25, 85, 22, 4, -14],
  [28, 90, 44, 12, -32],
  [26, 82, 65, 6, -7],
  [30, 95, 84, 20, -22],
];
const CLOUDS_MID = [
  [36, 100, -3, 14, 0],
  [30, 88, 20, 2, -10],
  [32, 92, 44, 10, -25],
  [28, 85, 68, 4, -16],
  [34, 96, 85, 18, -38],
];
const CLOUDS_NEAR = [
  [42, 100, -4, 12, 0],
  [36, 90, 18, 0, -8],
  [38, 92, 42, 8, -20],
  [34, 88, 66, 2, -14],
  [40, 96, 84, 14, -30],
];

function CloudLayer({ suffix, clouds }: { suffix: string; clouds: number[][] }) {
  return (
    <div className={`sky-scene__cloud-layer sky-scene__cloud-layer--${suffix}`}>
      {clouds.map(([w, h, l, t, delay], i) => (
        <div
          key={i}
          className="sky-scene__cloud"
          style={{
            width: `${w}%`,
            height: `${h}%`,
            left: `${l}%`,
            top: `${t}%`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function SkyBackdrop() {
  const { theme } = useAppSettings();

  return (
    <div aria-hidden="true" className={`sky-scene sky-scene--${theme}`}>
      <div className="sky-scene__layer sky-scene__layer--day" />
      <div className="sky-scene__layer sky-scene__layer--night" />

      {/* Stars */}
      <div className="sky-scene__stars">
        {STAR_FIELD.map((star, index) => (
          <span
            key={`${star.top}-${star.left}-${index}`}
            className="sky-scene__star"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Sun */}
      <div
        key={`sun-${theme}`}
        className={`sky-scene__orbit sky-scene__orbit--sun${theme === "light" ? " sky-scene__orbit--incoming-sun" : ""}`}
      >
        <div className="sky-scene__sun" />
      </div>

      {/* Moon */}
      <div
        key={`moon-${theme}`}
        className={`sky-scene__orbit sky-scene__orbit--moon${theme === "dark" ? " sky-scene__orbit--incoming-moon" : ""}`}
      >
        <div className="sky-scene__moon" />
      </div>

      {/* Clouds — three depth layers */}
      <div className="sky-scene__clouds" style={{ inset: 0 }}>
        <CloudLayer suffix="far" clouds={CLOUDS_FAR} />
        <CloudLayer suffix="mid" clouds={CLOUDS_MID} />
        <CloudLayer suffix="near" clouds={CLOUDS_NEAR} />
      </div>

      {/* Ground haze */}
      <div className="sky-scene__haze" />
    </div>
  );
}
