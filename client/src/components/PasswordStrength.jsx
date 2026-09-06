import React from 'react';

function PasswordStrength({ password }) {
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'No password', color: '#ccc' };
    
    let score = 0;
    
    // Length check
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    
    // Complexity checks
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;
    
    // More checks for very strong passwords
    if (pwd.length >= 16 && /[^a-zA-Z0-9]/.test(pwd) && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) {
      score += 1;
    }
    
    // Normalize score to 0-4 range
    const normalizedScore = Math.min(score, 6);
    
    if (normalizedScore <= 1) return { score: 1, label: 'Weak', color: '#ff4444' };
    if (normalizedScore <= 2) return { score: 2, label: 'Weak', color: '#ff6b6b' };
    if (normalizedScore <= 3) return { score: 3, label: 'Fair', color: '#ffa500' };
    if (normalizedScore <= 4) return { score: 4, label: 'Good', color: '#4CAF50' };
    if (normalizedScore <= 5) return { score: 5, label: 'Strong', color: '#2e7d32' };
    return { score: 6, label: 'Very Strong', color: '#1b5e20' };
  };

  const strength = getPasswordStrength(password);
  const percentage = (strength.score / 6) * 100;

  if (!password) return null;

  return (
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <span style={styles.label}>Password Strength:</span>
        <span style={{ ...styles.strengthLabel, color: strength.color }}>
          {strength.label}
        </span>
      </div>
      <div style={styles.barContainer}>
        <div 
          style={{
            ...styles.bar,
            width: `${percentage}%`,
            backgroundColor: strength.color,
            transition: 'width 0.3s ease, background-color 0.3s ease'
          }}
        />
      </div>
      <div style={styles.requirements}>
        <ul style={styles.requirementList}>
          <li style={password.length >= 8 ? styles.requirementMet : styles.requirementNotMet}>
            {password.length >= 8 ? '✅' : '❌'} At least 8 characters
          </li>
          <li style={/[a-z]/.test(password) ? styles.requirementMet : styles.requirementNotMet}>
            {/[a-z]/.test(password) ? '✅' : '❌'} Lowercase letter
          </li>
          <li style={/[A-Z]/.test(password) ? styles.requirementMet : styles.requirementNotMet}>
            {/[A-Z]/.test(password) ? '✅' : '❌'} Uppercase letter
          </li>
          <li style={/[0-9]/.test(password) ? styles.requirementMet : styles.requirementNotMet}>
            {/[0-9]/.test(password) ? '✅' : '❌'} Number
          </li>
          <li style={/[^a-zA-Z0-9]/.test(password) ? styles.requirementMet : styles.requirementNotMet}>
            {/[^a-zA-Z0-9]/.test(password) ? '✅' : '❌'} Special character
          </li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginTop: '8px',
    width: '100%'
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  label: {
    fontSize: '0.85rem',
    color: '#666'
  },
  strengthLabel: {
    fontSize: '0.85rem',
    fontWeight: 'bold'
  },
  barContainer: {
    width: '100%',
    height: '6px',
    backgroundColor: '#e0e0e0',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  bar: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease, background-color 0.3s ease'
  },
  requirements: {
    marginTop: '4px'
  },
  requirementList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    fontSize: '0.8rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2px 16px'
  },
  requirementMet: {
    color: '#4CAF50'
  },
  requirementNotMet: {
    color: '#ff4444'
  }
};

export default PasswordStrength;