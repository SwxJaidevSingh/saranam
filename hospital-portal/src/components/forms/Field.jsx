/**
 * Thin wrappers around react-hook-form `register` to keep the form markup
 * compact and consistent. Each renders a label, the control, and an error.
 */

export function TextField({ label, name, register, error, required, type = 'text', ...rest }) {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <input
        id={name}
        type={type}
        className={error ? 'input-error' : 'input'}
        aria-invalid={!!error}
        {...register(name)}
        {...rest}
      />
      {error && <p className="form-error">{error.message}</p>}
    </div>
  )
}

export function TextArea({ label, name, register, error, rows = 3, ...rest }) {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">{label}</label>
      <textarea
        id={name}
        rows={rows}
        className={error ? 'input-error' : 'input'}
        aria-invalid={!!error}
        {...register(name)}
        {...rest}
      />
      {error && <p className="form-error">{error.message}</p>}
    </div>
  )
}

export function SelectField({ label, name, register, error, required, options, placeholder = 'Select…', ...rest }) {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <select
        id={name}
        className={error ? 'input-error' : 'input'}
        aria-invalid={!!error}
        {...register(name)}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.value
          const text = typeof opt === 'string' ? opt : opt.label
          return (
            <option key={value} value={value}>
              {text}
            </option>
          )
        })}
      </select>
      {error && <p className="form-error">{error.message}</p>}
    </div>
  )
}

export function CheckboxField({ label, name, register, ...rest }) {
  return (
    <label className="flex items-center gap-2 py-2 text-sm text-foreground">
      <input type="checkbox" className="h-4 w-4 rounded border-border" {...register(name)} {...rest} />
      {label}
    </label>
  )
}
