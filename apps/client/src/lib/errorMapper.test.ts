import {
  mapValidationErrors,
  mapApiError,
  isValidationError,
  getFieldError,
} from "./errorMapper";

// Test validation error response
const testValidationError = {
  success: false as const,
  error: "Validation error",
  details: [
    {
      code: "too_small",
      minimum: 6,
      type: "string",
      inclusive: true,
      exact: false,
      message: "String must contain at least 6 character(s)",
      path: ["password"],
    },
    {
      code: "invalid_string",
      type: "string",
      message: "Invalid email",
      path: ["email"],
    },
    {
      code: "too_small",
      minimum: 1,
      type: "string",
      inclusive: true,
      exact: false,
      message: "String must contain at least 1 character(s)",
      path: ["fullName"],
    },
  ],
};

// Test general API error
const testApiError = "HTTP 400: Email already registered";

// Test the error mapper functions
console.log("=== Error Mapper Tests ===\n");

console.log("1. Testing isValidationError:");
console.log("Is validation error:", isValidationError(testValidationError)); // Should be true
console.log(
  "Is validation error:",
  isValidationError({ success: false, error: "Other error" }),
); // Should be false
console.log();

console.log("2. Testing mapValidationErrors:");
const fieldErrors = mapValidationErrors(testValidationError);
console.log("Field errors:", fieldErrors);
console.log(
  'Expected: { password: "Password must be at least 6 characters long", email: "Please enter a valid email address", fullName: "Full name is required" }',
);
console.log();

console.log("3. Testing mapApiError:");
const mappedError = mapApiError(testApiError);
console.log("Mapped error:", mappedError);
console.log(
  'Expected: "This email is already registered. Please use a different email or try logging in."',
);
console.log();

console.log("4. Testing getFieldError:");
const passwordError = getFieldError("password", testValidationError);
const emailError = getFieldError("email", testValidationError);
const nonExistentError = getFieldError("nonexistent", testValidationError);
console.log("Password error:", passwordError);
console.log("Email error:", emailError);
console.log("Non-existent error:", nonExistentError);
console.log();

console.log("5. Testing edge cases:");
const emptyValidationError = {
  success: false as const,
  error: "Validation error",
  details: [],
};
console.log(
  "Empty validation error:",
  mapValidationErrors(emptyValidationError),
);

const malformedError = {
  success: false,
  error: "Some other error",
};
console.log(
  "Malformed error (not validation):",
  isValidationError(malformedError),
);
console.log();

console.log("=== Test Complete ===");
