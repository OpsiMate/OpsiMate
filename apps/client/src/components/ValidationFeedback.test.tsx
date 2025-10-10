import React, { useState } from "react";
import { ValidationFeedback, validationRules } from "./ValidationFeedback";

// Test component to demonstrate validation feedback
export const ValidationFeedbackDemo: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  return (
    <div className="p-8 max-w-md mx-auto space-y-6">
      <h2 className="text-2xl font-bold mb-6">Validation Feedback Demo</h2>

      <div>
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Enter email"
        />
        <ValidationFeedback
          value={email}
          rules={validationRules.email}
          showValid={email.length > 0}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Enter password"
        />
        <ValidationFeedback
          value={password}
          rules={validationRules.password}
          showValid={password.length > 0}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Full Name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Enter full name"
        />
        <ValidationFeedback
          value={fullName}
          rules={validationRules.fullName}
          showValid={fullName.length > 0}
        />
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Current Values:</h3>
        <p>Email: "{email}"</p>
        <p>Password: "{password}"</p>
        <p>Full Name: "{fullName}"</p>
      </div>
    </div>
  );
};
