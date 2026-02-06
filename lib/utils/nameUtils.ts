export interface NormalizePersonNameInput {
  first?: string | null;
  last?: string | null;
  full?: string | null;
}

export interface NormalizedPersonName {
  firstName: string;
  lastName: string;
  fullName: string;
  shortName: string;
  initials: string;
}

const normalizeToken = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
};

const collapseDuplicateTokens = (value: string): string => {
  const cleaned = normalizeToken(value);
  if (!cleaned) return '';
  const parts = cleaned.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0];
  }
  return cleaned;
};

export const normalizePersonName = (input: NormalizePersonNameInput = {}): NormalizedPersonName => {
  let firstName = normalizeToken(input.first);
  let lastName = normalizeToken(input.last);
  let fullName = normalizeToken(input.full);

  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(' ');
    firstName = parts.shift() || '';
    lastName = parts.join(' ').trim();
  }

  if (firstName && lastName && firstName.toLowerCase() === lastName.toLowerCase()) {
    lastName = '';
  }

  if (fullName) {
    fullName = collapseDuplicateTokens(fullName);
  }

  if (!fullName) {
    fullName = [firstName, lastName].filter(Boolean).join(' ');
  }

  const shortName = firstName || fullName;
  const initials = [firstName, lastName]
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);

  return {
    firstName,
    lastName,
    fullName,
    shortName,
    initials,
  };
};
