// Types for validation error details from server
export interface ValidationErrorDetail {
  code: string;
  minimum?: number;
  maximum?: number;
  type: string;
  inclusive?: boolean;
  exact?: boolean;
  message: string;
  path: string[];
}

export interface ValidationErrorResponse {
  success: false;
  error: string;
  details: ValidationErrorDetail[];
}

// Field-specific error message mappings
const FIELD_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  email: {
    invalid_string: 'Please enter a valid email address',
    invalid_type: 'Email is required',
    invalid_email: 'Please enter a valid email address',
  },
  password: {
    too_small: 'Password must be at least 6 characters long',
    invalid_type: 'Password is required',
  },
  fullName: {
    too_small: 'Full name is required',
    invalid_type: 'Full name is required',
  },
  name: {
    too_small: 'Name is required',
    invalid_type: 'Name is required',
  },
  providerIP: {
    invalid_string: 'Please enter a valid IP address',
    invalid_type: 'IP address is required',
  },
  username: {
    too_small: 'Username is required',
    invalid_type: 'Username is required',
  },
  privateKeyFilename: {
    too_small: 'Private key filename is required',
    invalid_type: 'Private key filename is required',
  },
  SSHPort: {
    too_small: 'SSH port must be at least 1',
    too_big: 'SSH port must be at most 65535',
    invalid_type: 'SSH port must be a number',
  },
  serviceIP: {
    invalid_string: 'Please enter a valid IP address',
  },
  serviceStatus: {
    too_small: 'Service status is required',
    invalid_type: 'Service status is required',
  },
  tagName: {
    too_small: 'Tag name is required',
    too_big: 'Tag name must be less than 50 characters',
    invalid_type: 'Tag name is required',
  },
  color: {
    invalid_string: 'Please enter a valid hex color (e.g., #FF0000)',
    invalid_type: 'Color is required',
  },
  externalUrl: {
    invalid_string: 'Please enter a valid URL',
    invalid_url: 'Please enter a valid URL',
    invalid_type: 'URL is required',
  },
  kubeconfigPath: {
    too_small: 'Kubeconfig path is required',
    invalid_type: 'Kubeconfig path is required',
  },
  region: {
    too_small: 'Region is required',
    invalid_type: 'Region is required',
  },
  accessKeyId: {
    invalid_string: 'Please enter a valid Access Key ID',
    invalid_regex: 'Access Key ID must start with AKIA and be 20 characters long',
    invalid_type: 'Access Key ID is required',
  },
  secretAccessKey: {
    too_small: 'Secret Access Key is required',
    invalid_type: 'Secret Access Key is required',
  },
  projectId: {
    too_small: 'Project ID is required',
    invalid_type: 'Project ID is required',
  },
  zone: {
    too_small: 'Zone is required',
    invalid_type: 'Zone is required',
  },
  credentialsPath: {
    too_small: 'Service Account Key Path is required',
    invalid_type: 'Service Account Key Path is required',
  },
  subscriptionId: {
    invalid_string: 'Please enter a valid Subscription ID',
    invalid_uuid: 'Subscription ID must be a valid UUID',
    invalid_type: 'Subscription ID is required',
  },
  tenantId: {
    invalid_string: 'Please enter a valid Tenant ID',
    invalid_uuid: 'Tenant ID must be a valid UUID',
    invalid_type: 'Tenant ID is required',
  },
  clientId: {
    invalid_string: 'Please enter a valid Client ID',
    invalid_uuid: 'Client ID must be a valid UUID',
    invalid_type: 'Client ID is required',
  },
  clientSecret: {
    too_small: 'Client Secret is required',
    invalid_type: 'Client Secret is required',
  },
  resourceGroup: {
    too_small: 'Resource Group is required',
    invalid_type: 'Resource Group is required',
  },
  newPassword: {
    too_small: 'New password must be at least 8 characters long',
    invalid_type: 'New password is required',
  },
};

// Generic error message mappings based on error codes
const GENERIC_ERROR_MESSAGES: Record<string, string> = {
  too_small: 'This field is too short',
  too_big: 'This field is too long',
  invalid_string: 'Invalid format',
  invalid_type: 'This field is required',
  invalid_enum_value: 'Invalid selection',
  invalid_date: 'Invalid date',
  invalid_email: 'Please enter a valid email address',
  invalid_url: 'Please enter a valid URL',
  invalid_uuid: 'Invalid format',
  invalid_regex: 'Invalid format',
  invalid_arguments: 'Invalid arguments',
  invalid_union: 'Invalid value',
  invalid_union_discriminator: 'Invalid selection',
  invalid_literal: 'Invalid value',
  unrecognized_keys: 'Unknown field',
  custom: 'Invalid value',
};

/**
 * Maps a validation error detail to a user-friendly message
 */
function mapValidationErrorDetail(detail: ValidationErrorDetail): string {
  const fieldName = detail.path[detail.path.length - 1] || 'field';
  
  // Try field-specific error message first
  if (FIELD_ERROR_MESSAGES[fieldName] && FIELD_ERROR_MESSAGES[fieldName][detail.code]) {
    return FIELD_ERROR_MESSAGES[fieldName][detail.code];
  }
  
  // Try generic error message
  if (GENERIC_ERROR_MESSAGES[detail.code]) {
    return GENERIC_ERROR_MESSAGES[detail.code];
  }
  
  // Fallback to server message or create a generic one
  if (detail.message && detail.message !== 'Required') {
    return detail.message;
  }
  
  // Create a generic message based on the error code
  switch (detail.code) {
    case 'too_small':
      if (detail.type === 'string') {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at least ${detail.minimum} characters`;
      }
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is too small`;
    case 'too_big':
      if (detail.type === 'string') {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at most ${detail.maximum} characters`;
      }
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is too large`;
    case 'invalid_string':
      return `Please enter a valid ${fieldName}`;
    case 'invalid_type':
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    default:
      return `Invalid ${fieldName}`;
  }
}

/**
 * Maps server validation errors to user-friendly messages
 */
export function mapValidationErrors(response: ValidationErrorResponse): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  
  if (response.details && Array.isArray(response.details)) {
    response.details.forEach((detail) => {
      const fieldName = detail.path[detail.path.length - 1] || 'unknown';
      fieldErrors[fieldName] = mapValidationErrorDetail(detail);
    });
  }
  
  return fieldErrors;
}

/**
 * Maps general API errors to user-friendly messages
 */
export function mapApiError(error: string): string {
  // Handle common HTTP error patterns
  if (error.includes('HTTP 400:')) {
    return 'Invalid request. Please check your input and try again.';
  }
  if (error.includes('HTTP 401:')) {
    return 'Authentication failed. Please log in again.';
  }
  if (error.includes('HTTP 403:')) {
    return 'Access denied. You don\'t have permission to perform this action.';
  }
  if (error.includes('HTTP 404:')) {
    return 'Resource not found.';
  }
  if (error.includes('HTTP 500:')) {
    return 'Server error. Please try again later.';
  }
  
  // Handle specific error messages
  if (error.includes('Email already registered')) {
    return 'This email is already registered. Please use a different email or try logging in.';
  }
  if (error.includes('Invalid email or password')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (error.includes('Network error') || error.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  // Return the original error if no mapping is found
  return error;
}

/**
 * Extracts field-specific errors from a validation error response
 */
export function getFieldError(fieldName: string, response: { details?: ValidationErrorDetail[] }): string | null {
  if (response?.details && Array.isArray(response.details)) {
    const fieldError = response.details.find(
      (detail: ValidationErrorDetail) => detail.path[detail.path.length - 1] === fieldName
    );
    return fieldError ? mapValidationErrorDetail(fieldError) : null;
  }
  return null;
}

/**
 * Checks if a response contains validation errors
 */
export function isValidationError(response: unknown): response is ValidationErrorResponse {
  return response?.success === false && 
         (response?.error === 'Validation error' || response?.error?.includes('Validation error')) && 
         Array.isArray(response?.details);
} 