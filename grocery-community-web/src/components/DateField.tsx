type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isDark?: boolean;
};

/**
 * DateField — styled date input that is clearly an input field (not a button).
 * Uses .date-field-wrapper / .date-field-input classes from styles.css.
 */
export function DateField({ label, value, onChange, isDark = false }: DateFieldProps) {
  return (
    <div className="date-field-wrapper">
      <label className="date-field-label">
        <i className="fa-regular fa-calendar date-field-icon" aria-hidden="true" />
        {label}
      </label>
      <div className="date-field-input-wrap">
        <i className="fa-solid fa-calendar-days date-field-cal-icon" aria-hidden="true" />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="date-field-input"
          style={isDark ? { colorScheme: "dark" } : undefined}
        />
      </div>
    </div>
  );
}
