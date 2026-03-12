import { useAppSettings } from "../lib/app-settings";

const STAR_FIELD = Array.from({ length: 54 }, (_, index) => ({
  top: 6 + ((index * 11) % 58),
  left: 3 + ((index * 17) % 94),
  size: [1.2, 1.6, 2.1, 1.4, 2.8, 1.8][index % 6],
  opacity: 0.42 + (index % 5) * 0.11,
  delay: -((index % 9) * 0.55),
  duration: 2.8 + (index % 7) * 0.8,
}));

export function SkyBackdrop() {
  const { theme } = useAppSettings();

  return (
    <div aria-hidden="true" className={`sky-scene sky-scene--${theme}`}>
      <div className="sky-scene__layer sky-scene__layer--day" />
      <div className="sky-scene__layer sky-scene__layer--night" />

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

      <div
        key={`sun-${theme}`}
        className={`sky-scene__orbit sky-scene__orbit--sun${theme === "light" ? " sky-scene__orbit--incoming-sun" : ""}`}
      >
        <div className="sky-scene__sun" />
      </div>
      <div
        key={`moon-${theme}`}
        className={`sky-scene__orbit sky-scene__orbit--moon${theme === "dark" ? " sky-scene__orbit--incoming-moon" : ""}`}
      >
        <div className="sky-scene__moon" />
      </div>
      <div className="sky-scene__clouds sky-scene__clouds--far" />
      <div className="sky-scene__clouds sky-scene__clouds--mid" />
      <div className="sky-scene__clouds sky-scene__clouds--near" />
      <div className="sky-scene__haze" />
    </div>
  );
}
