import { useState } from 'react';
import Icon from './Icon';
import { emailProblem, passwordIssues } from '../utils/validation';

// Validation messages always sit directly under their field, in red.
export const FieldError = ({ id, message }) => (message ? <span className="field-error" id={id} role="alert">{message}</span> : null);

const Label = ({ label, required }) => (
  <span className="field-label">{label}{required ? <span className="req"> *</span> : <span className="opt-l"> (optional)</span>}</span>
);

// Text input or textarea with its error underneath
export function TextField({ id, label, value, onChange, onBlur, error, required = true, type = 'text', placeholder = '', autoComplete, maxLength, multiline = false, inputMode, counter, min, max, step, children }) {
  const Tag = multiline ? 'textarea' : 'input';
  const len = String(value ?? '').length;
  return (
    <label className="field">
      {label && <Label label={label} required={required} />}
      <Tag id={id} type={multiline ? undefined : type} value={value ?? ''} placeholder={placeholder} autoComplete={autoComplete} maxLength={maxLength} inputMode={inputMode} min={min} max={max} step={step}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} className={error ? 'invalid' : ''}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      {(error || counter) && (
        <span className="field-foot">
          <FieldError id={`${id}-err`} message={error} />
          {counter && <span className="field-count">{len}/{maxLength}</span>}
        </span>
      )}
      {children}
    </label>
  );
}

export function SelectField({ id, label, value, onChange, onBlur, error, options, required = true, placeholder = 'Select' }) {
  return (
    <label className="field">
      {label && <Label label={label} required={required} />}
      <select id={id} value={value ?? ''} aria-invalid={Boolean(error)} className={error ? 'invalid' : ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}>
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
      </select>
      <FieldError id={`${id}-err`} message={error} />
    </label>
  );
}

// Email: the format is checked while typing; `error` adds outside messages (e.g. already registered)
export function EmailField({ id, label = 'Email address', value, onChange, onBlur, error, required = true, placeholder = 'you@example.com', autoComplete = 'email' }) {
  const [touched, setTouched] = useState(false);
  const live = value ? emailProblem(value) : null;
  const shown = (value && live) || error || (touched && required && !value ? `Please enter your ${label.toLowerCase()}.` : null);
  return (
    <label className="field">
      <Label label={label} required={required} />
      <input id={id} type="email" inputMode="email" value={value || ''} placeholder={placeholder} autoComplete={autoComplete}
        aria-invalid={Boolean(shown)} className={shown ? 'invalid' : ''}
        onChange={(e) => onChange(e.target.value)} onBlur={() => { setTouched(true); onBlur?.(); }} />
      <FieldError id={`${id}-err`} message={shown} />
    </label>
  );
}

// Password with show/hide. While typing it lists exactly which rules are not met yet
// (for example "Must not contain your username"); each line disappears once that rule is met.
export function PasswordField({ id, label = 'Password', value, onChange, onBlur, error, context, showRules = true, autoComplete = 'new-password', placeholder = 'Create a strong password', required = true }) {
  const [show, setShow] = useState(false);
  const issues = showRules ? passwordIssues(value, context) : [];
  const invalid = issues.length > 0 || Boolean(error);
  return (
    <label className="field">
      <Label label={label} required={required} />
      <span className="pw-wrap">
        <input id={id} type={show ? 'text' : 'password'} value={value || ''} placeholder={placeholder} autoComplete={autoComplete}
          aria-invalid={invalid} className={invalid ? 'invalid' : ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
        <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'eyeOff' : 'eye'} size={17} /></button>
      </span>
      {issues.length > 0 ? (
        <ul className="pw-issues" role="alert">{issues.map((m) => <li key={m}><Icon name="x" size={12} />{m}</li>)}</ul>
      ) : <FieldError id={`${id}-err`} message={error} />}
    </label>
  );
}

// Confirm-password with a live match message
export function ConfirmField({ id, label = 'Confirm password', value, password, onChange, onBlur, error }) {
  const [show, setShow] = useState(false);
  const mismatch = value && password !== value;
  const shown = mismatch ? 'Passwords do not match.' : !value ? error : null;
  return (
    <label className="field">
      <Label label={label} required />
      <span className="pw-wrap">
        <input id={id} type={show ? 'text' : 'password'} value={value || ''} placeholder="Enter your password again" autoComplete="new-password"
          aria-invalid={Boolean(shown)} className={shown ? 'invalid' : ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
        <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'eyeOff' : 'eye'} size={17} /></button>
      </span>
      {shown ? <FieldError id={`${id}-err`} message={shown} /> : value ? <span className="field-ok"><Icon name="check" size={13} />Passwords match</span> : null}
    </label>
  );
}

// Checkbox with its error under it (used for accepting the terms)
export function CheckField({ id, checked, onChange, error, children }) {
  return (
    <div className="field">
      <label className="checkbox">
        <input id={id} type="checkbox" checked={!!checked} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.checked)} />
        <span>{children}</span>
      </label>
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}
