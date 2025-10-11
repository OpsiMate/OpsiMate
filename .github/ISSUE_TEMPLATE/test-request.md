---
name: Test Request
about: Create or improve tests
title: "[TEST] "
labels: Test
assignees: ''

---

### Describe the task
Explain what needs to be tested and the goal of this test.  
For example: “Add an automated test to validate the [feature/module] behavior under different input conditions.”

---

### Test scenarios to include

- Expected success case  
- Handle invalid or missing input  
- Verify permissions and access control  
- Validate output structure, status codes, or UI states  
- Check edge cases and error handling

---

### Expected behavior
The test should confirm that:
- Valid cases behave as expected  
- Invalid or unauthorized requests are handled correctly  
- Data, logs, or UI reflect the correct state after execution  
- All assertions pass within the defined thresholds

---

### Additional context
- Use the existing testing framework (e.g., Jest, Cypress, Playwright, etc.)  
- Place the test in the correct directory (e.g., `/apps/server/tests/`, `/apps/client/tests/`, etc.)  
- Ensure meaningful coverage improvement and proper CI integration
