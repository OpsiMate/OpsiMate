import React, { useState } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { apiRequest, API_BASE_URL } from '../lib/api';
import { useFormErrors } from '../hooks/useFormErrors';
import { ErrorAlert } from '../components/ErrorAlert';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { errors, generalError, clearErrors, handleApiResponse } = useFormErrors();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearErrors();
    // Validate password doesn't contain spaces
    if (/\s/.test(password)) {
      handleApiResponse({
        success: false,
        error: 'Password must not contain spaces',
      });
      setLoading(false);
      return;
    }

    try {
      const res = await apiRequest<{
        token: string;
        data: { user: { id: string; email: string; name: string } };
        error?: string;
      }>('/users/register', 'POST', { email, fullName, password });

      if (res.success) {
        const token = (res.data && res.data.token) || res.token;
        if (token) {
          localStorage.setItem('jwt', token);
          window.location.href = '/';
        } else {
          // This shouldn't happen in normal flow, but handle it gracefully
          console.error('Registration successful but no token received');
        }
      } else {
        handleApiResponse(res);
      }
    } catch (err) {
      handleApiResponse({
        success: false,
        error: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-background'>
      <form
        onSubmit={handleSubmit}
        className='bg-card text-card-foreground border border-border p-8 rounded shadow-md w-80 min-w-[350px]'
      >
        <h2 className='text-2xl font-bold mb-6 text-center text-foreground'>
          Create First Admin User
        </h2>
        <p className='text-sm text-muted-foreground mb-6 text-center'>
          This will be the first user in the system with admin privileges.
        </p>
        <div className='mb-4'>
          <Input
            type='email'
            placeholder='Email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          {errors.email && <ErrorAlert message={errors.email} className='mt-6' />}
        </div>
        <div className='mb-4'>
          <Input
            type='text'
            placeholder='Full Name'
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
          />
          {errors.fullName && <ErrorAlert message={errors.fullName} className='mt-6' />}
        </div>
        <div className='mb-4'>
          <Input
            type='password'
            placeholder='Password'
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {errors.password && <ErrorAlert message={errors.password} className='mt-6' />}
        </div>
        {generalError && <ErrorAlert message={generalError} className='mb-4' />}
        <Button type='submit' className='w-full' disabled={loading}>
          {loading ? 'Creating Admin User...' : 'Create Admin User'}
        </Button>
      </form>
    </div>
  );
};

export default Register;
