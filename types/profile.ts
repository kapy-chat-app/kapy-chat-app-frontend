export interface ProfileFormData {
  full_name: string;
  username: string;
  bio?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'private';
  location?: string;
  website?: string;
  status?: string;
}

export interface GenderOption {
  label: string;
  value: 'male' | 'female' | 'other' | 'private';
  icon: string;
}

export const GENDER_OPTIONS: GenderOption[] = [
  { label: 'Male', value: 'male', icon: 'man' },
  { label: 'Female', value: 'female', icon: 'woman' },
  { label: 'Other', value: 'other', icon: 'person' },
  { label: 'Prefer not to say', value: 'private', icon: 'help-circle' },
];

export interface ProfileValidationResult {
  isValid: boolean;
  errors: { [key: string]: string };
}

export const validateProfile = (data: ProfileFormData): ProfileValidationResult => {
  const errors: { [key: string]: string } = {};

  // Full name validation
  if (!data.full_name || data.full_name.trim().length < 2) {
    errors.full_name = 'Full name must be at least 2 characters long';
  }

  // Username validation
  if (!data.username || data.username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters long';
  } else if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
    errors.username = 'Username can only contain letters, numbers, and underscores';
  }

  // Phone validation (optional)
  if (data.phone && !/^\+?[\d\s\-\(\)]+$/.test(data.phone)) {
    errors.phone = 'Please enter a valid phone number';
  }

  // Website validation (optional)
  if (data.website) {
    try {
      new URL(data.website.startsWith('http') ? data.website : `https://${data.website}`);
    } catch {
      errors.website = 'Please enter a valid website URL';
    }
  }

  // Bio length validation
  if (data.bio && data.bio.length > 500) {
    errors.bio = 'Bio must be less than 500 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};