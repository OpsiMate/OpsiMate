import { describe, test, expect, vi } from 'vitest';
import { AlertController } from '../src/api/v1/alerts/controller';
import { AlertBL } from '../src/bl/alerts/alert.bl';

describe('normalizeDate', () => {
	// Create a mock AlertBL (we only need normalizeDate, so we can use an empty mock)
	const mockAlertBL = {} as AlertBL;
	const controller = new AlertController(mockAlertBL);

	test('should normalize date formats from GCP, UptimeKuma, and Datadog', () => {
		// GCP date formats (from GCP Monitoring API docs)
		// GCP sends started_at as Unix timestamp in seconds
		const gcpEpochSeconds = 1763324240; // Numeric epoch seconds
		const gcpEpochSecondsString = '1763324240'; // String epoch seconds
		const gcpISOString = '2025-11-17T18:03:39.000Z'; // ISO 8601 string

		// Datadog date formats (from Datadog webhook docs)
		// Datadog sends date and last_updated as Unix timestamp in milliseconds
		const datadogEpochMillis = 1764869846000; // Numeric epoch milliseconds
		const datadogEpochMillisString = '1764869846000'; // String epoch milliseconds
		const datadogISOString = '2025-12-04T17:37:26.000Z'; // ISO 8601 string

		// UptimeKuma date format (from UptimeKuma webhook docs)
		// UptimeKuma sends time as ISO 8601 string
		const uptimeKumaISOString = '2025-12-09T18:35:23.718Z'; // ISO 8601 string

		// Test GCP: numeric epoch seconds
		const gcpNumericResult = controller.normalizeDate(gcpEpochSeconds);
		expect(gcpNumericResult).toBe(new Date(gcpEpochSeconds * 1000).toISOString());
		expect(new Date(gcpNumericResult).getTime()).toBe(gcpEpochSeconds * 1000);

		// Test GCP: string epoch seconds
		const gcpStringResult = controller.normalizeDate(gcpEpochSecondsString);
		expect(gcpStringResult).toBe(new Date(gcpEpochSeconds * 1000).toISOString());
		expect(new Date(gcpStringResult).getTime()).toBe(gcpEpochSeconds * 1000);

		// Test GCP: ISO string (should pass through unchanged)
		const gcpISOResult = controller.normalizeDate(gcpISOString);
		expect(gcpISOResult).toBe(gcpISOString);

		// Test Datadog: numeric epoch milliseconds
		const datadogNumericResult = controller.normalizeDate(datadogEpochMillis);
		expect(datadogNumericResult).toBe(new Date(datadogEpochMillis).toISOString());
		expect(new Date(datadogNumericResult).getTime()).toBe(datadogEpochMillis);

		// Test Datadog: string epoch milliseconds
		const datadogStringResult = controller.normalizeDate(datadogEpochMillisString);
		expect(datadogStringResult).toBe(new Date(datadogEpochMillis).toISOString());
		expect(new Date(datadogStringResult).getTime()).toBe(datadogEpochMillis);

		// Test Datadog: ISO string (should pass through unchanged)
		const datadogISOResult = controller.normalizeDate(datadogISOString);
		expect(datadogISOResult).toBe(datadogISOString);

		// Test UptimeKuma: ISO string (should pass through unchanged)
		const uptimeKumaResult = controller.normalizeDate(uptimeKumaISOString);
		expect(uptimeKumaResult).toBe(uptimeKumaISOString);

		// Verify all results are valid ISO 8601 strings
		const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
		expect(gcpNumericResult).toMatch(isoRegex);
		expect(gcpStringResult).toMatch(isoRegex);
		expect(gcpISOResult).toMatch(isoRegex);
		expect(datadogNumericResult).toMatch(isoRegex);
		expect(datadogStringResult).toMatch(isoRegex);
		expect(datadogISOResult).toMatch(isoRegex);
		expect(uptimeKumaResult).toMatch(isoRegex);
	});
});

