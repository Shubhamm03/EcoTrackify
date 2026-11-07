import { useCallback, useMemo, useState } from 'react';

// Live, per-field validation.
// - `validate(values)` returns { field: 'message' } for every field that is wrong right now.
// - A message shows under its field as soon as the person types in it (or leaves it),
//   and disappears the moment the rule is met. Submitting shows every remaining message
//   and moves the cursor to the first wrong field.
export default function useForm(initial, validate) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  const errors = useMemo(() => ({ ...validate(values), ...serverErrors }), [values, validate, serverErrors]);

  const set = useCallback((k, v) => {
    setValues((x) => ({ ...x, [k]: v }));
    setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
    setServerErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  }, []);
  const setMany = useCallback((patch) => setValues((x) => ({ ...x, ...patch })), []);
  const blur = useCallback((k) => setTouched((t) => (t[k] ? t : { ...t, [k]: true })), []);
  const err = (k) => ((touched[k] || submitted) && errors[k]) || undefined;

  // Call at the start of submit. Returns true when everything is valid.
  const check = (fields) => {
    setSubmitted(true);
    const keys = (fields || Object.keys(errors)).filter((k) => errors[k]);
    if (keys.length) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) }));
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return false;
    }
    return true;
  };

  const reset = (next = initial) => { setValues(next); setTouched({}); setSubmitted(false); setServerErrors({}); };
  // Put a message from the server (e.g. "already exists") under a field
  const fieldError = (k, message) => setServerErrors((e) => ({ ...e, [k]: message }));

  return { values, set, setMany, blur, err, errors, check, reset, fieldError, setSubmitted };
}
