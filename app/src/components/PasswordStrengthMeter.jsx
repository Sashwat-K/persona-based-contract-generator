import React, { useMemo } from 'react';
import { Checkmark, Close } from '@carbon/icons-react';

/**
 * PasswordStrengthMeter Component
 * Displays password strength with visual feedback and criteria checklist
 * Follows IBM Carbon Design System patterns
 */

const PASSWORD_CRITERIA = [
  { id: 'length', label: 'At least 12 characters', test: (pwd) => pwd.length >= 12 },
  { id: 'uppercase', label: 'Contains uppercase letter (A-Z)', test: (pwd) => /[A-Z]/.test(pwd) },
  { id: 'lowercase', label: 'Contains lowercase letter (a-z)', test: (pwd) => /[a-z]/.test(pwd) },
  { id: 'number', label: 'Contains number (0-9)', test: (pwd) => /[0-9]/.test(pwd) },
  { id: 'special', label: 'Contains special character (@$!%*?&)', test: (pwd) => /[@$!%*?&]/.test(pwd) }
];

const getStrengthLevel = (strength) => {
  if (strength === 0) return { label: 'No password', color: 'gray' };
  if (strength <= 20) return { label: 'Very Weak', color: 'red' };
  if (strength <= 40) return { label: 'Weak', color: 'red' };
  if (strength <= 60) return { label: 'Fair', color: 'yellow' };
  if (strength <= 80) return { label: 'Good', color: 'cyan' };
  return { label: 'Strong', color: 'green' };
};

const STRENGTH_COLOR_TOKENS = {
  red: 'var(--cds-support-error, #da1e28)',
  yellow: 'var(--cds-support-warning, #f1c21b)',
  cyan: 'var(--cds-support-info, #0043ce)',
  green: 'var(--cds-support-success, #198038)',
  gray: 'var(--cds-border-subtle-01, #c6c6c6)'
};

const calculatePasswordStrength = (password) => {
  if (!password) return { strength: 0, checks: {}, metCount: 0 };
  
  const checks = {};
  let metCount = 0;
  
  PASSWORD_CRITERIA.forEach((criterion) => {
    const met = criterion.test(password);
    checks[criterion.id] = met;
    if (met) metCount++;
  });
  
  // Calculate strength as percentage (0-100)
  const strength = Math.round((metCount / PASSWORD_CRITERIA.length) * 100);
  
  return { strength, checks, metCount };
};

export const PasswordStrengthMeter = ({ 
  password = '', 
  showCriteria = true,
  className = ''
}) => {
  const { strength, checks, metCount } = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  );
  
  const strengthLevel = useMemo(() => getStrengthLevel(strength), [strength]);
  const strengthFillColor = STRENGTH_COLOR_TOKENS[strengthLevel.color] || 'var(--cds-interactive, #0f62fe)';
  
  // Don't show anything if no password entered
  if (!password) return null;
  
  return (
    <div className={`password-strength-meter ${className}`}>
      <div className="password-strength-meter__header">
        <span className="password-strength-meter__label">
          Password Strength: <strong className={`password-strength-meter__level password-strength-meter__level--${strengthLevel.color}`}>
            {strengthLevel.label}
          </strong>
        </span>
        <span className="password-strength-meter__count">
          {metCount}/{PASSWORD_CRITERIA.length} criteria met
        </span>
      </div>
      
      <div
        className="password-strength-meter__bar"
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={strength}
      >
        <div
          className={`password-strength-meter__bar-fill password-strength-meter__bar-fill--${strengthLevel.color}`}
          style={{
            width: `${strength}%`,
            backgroundColor: strengthFillColor
          }}
        />
      </div>
      
      {showCriteria && (
        <div className="password-strength-meter__criteria">
          <p className="password-strength-meter__criteria-title">Password must contain:</p>
          <ul className="password-strength-meter__criteria-list">
            {PASSWORD_CRITERIA.map((criterion) => {
              const met = checks[criterion.id];
              return (
                <li 
                  key={criterion.id}
                  className={`password-strength-meter__criterion ${met ? 'password-strength-meter__criterion--met' : ''}`}
                >
                  {met ? (
                    <Checkmark size={16} className="password-strength-meter__icon password-strength-meter__icon--success" />
                  ) : (
                    <Close size={16} className="password-strength-meter__icon password-strength-meter__icon--error" />
                  )}
                  <span>{criterion.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export const isPasswordStrong = (password) => {
  const { strength } = calculatePasswordStrength(password);
  return strength > 80; // "Strong" is 81-100
};

export const isPasswordValid = (password) => {
  const { metCount } = calculatePasswordStrength(password);
  return metCount === PASSWORD_CRITERIA.length; // All criteria must be met
};

export default PasswordStrengthMeter;
