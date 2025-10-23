import { encryptPassword, decryptPassword } from '../src/utils/encryption';

describe('Password Encryption', () => {
    test('should encrypt and decrypt password correctly', () => {
        const originalPassword = 'mySecretPassword123!';
        
        // Encrypt the password
        const encrypted = encryptPassword(originalPassword);
        expect(encrypted).toBeDefined();
        expect(encrypted).not.toBe(originalPassword);
        expect(encrypted).not.toContain(originalPassword);
        
        // Decrypt the password
        const decrypted = decryptPassword(encrypted);
        expect(decrypted).toBe(originalPassword);
    });

    test('should handle undefined passwords', () => {
        expect(encryptPassword(undefined)).toBeUndefined();
        expect(decryptPassword(undefined)).toBeUndefined();
    });

    test('should handle empty passwords', () => {
        expect(encryptPassword('')).toBe('');
        expect(decryptPassword('')).toBe('');
    });

    test('should produce different encrypted values for same password', () => {
        const password = 'testPassword';
        const encrypted1 = encryptPassword(password);
        const encrypted2 = encryptPassword(password);
        
        expect(encrypted1).not.toBe(encrypted2);
        expect(decryptPassword(encrypted1)).toBe(password);
        expect(decryptPassword(encrypted2)).toBe(password);
    });

    test('should handle decryption failure gracefully', () => {
        const invalidEncrypted = 'invalidBase64String';
        const result = decryptPassword(invalidEncrypted);
        // Should return the original value if decryption fails
        expect(result).toBe(invalidEncrypted);
    });
});
