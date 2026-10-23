import { KeyRound, LoaderCircle } from 'lucide-react';
import { FormEvent, useEffect, useId, useState } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { verifyAdminSession } from '../lib/adminApi';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AdminOrders } from './AdminOrders';
import { InventoryManagement } from './InventoryManagement';

type AdminPortalProps = { onExit: () => void };

export function AdminPortal({ onExit }: AdminPortalProps) {
  const id = useId();
  const { status, user, signIn, signOut } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverAccess, setServerAccess] = useState<'idle' | 'checking' | 'allowed' | 'denied'>('idle');
  const [adminPage, setAdminPage] = useState<'orders' | 'inventory'>('orders');

  useEffect(() => {
    if (status !== 'authorized' || !user) {
      setServerAccess('idle');
      return;
    }

    let active = true;
    setServerAccess('checking');
    user
      .getIdToken()
      .then(verifyAdminSession)
      .then(() => {
        if (active) setServerAccess('allowed');
      })
      .catch(async (sessionError: unknown) => {
        if (!active) return;
        setError(sessionError instanceof Error ? sessionError.message : 'Your administrator session could not be verified.');
        setServerAccess('denied');
        await signOut();
      });

    return () => {
      active = false;
    };
  }, [status, user, signOut]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password, remember);
      setPassword('');
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    await signOut();
  };

  if (status === 'loading' || (status === 'authorized' && serverAccess === 'checking')) {
    return <AdminLoading />;
  }

  if (status === 'authorized' && serverAccess === 'allowed' && user) {
    return adminPage === 'inventory'
      ? <InventoryManagement adminEmail={user.email} onSignOut={handleSignOut} onExit={onExit} onOpenOrders={() => setAdminPage('orders')} />
      : <AdminOrders adminEmail={user.email} onSignOut={handleSignOut} onExit={onExit} onOpenInventory={() => setAdminPage('inventory')} />;
  }

  if (status === 'unauthorized') {
    return (
      <main className="relative z-[1] grid min-h-screen place-items-center px-5 py-10">
        <section className="w-full max-w-md border border-metal-mid bg-white p-7 shadow-metal sm:p-8" aria-labelledby="access-denied-title">
          <div className="mb-6 flex size-11 items-center justify-center rounded-full border border-metal-mid" aria-hidden="true">
            <KeyRound size={20} />
          </div>
          <h1 id="access-denied-title" className="font-display text-2xl font-bold">Administrator access required</h1>
          <p className="mt-3 leading-6 text-metal-dark">
            This account is authenticated but does not have the required administrator role.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button type="button" onClick={handleSignOut}>Sign out</Button>
            <Button type="button" variant="outline" onClick={onExit}>Return to storefront</Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative z-[1] min-h-screen" aria-label="Administrator sign in">
      <Dialog open onOpenChange={(open) => !open && onExit()}>
        <DialogContent aria-describedby={`${id}-description`}>
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-metal-mid" aria-hidden="true">
              <KeyRound size={20} />
            </div>
            <DialogHeader>
              <DialogTitle>Welcome back</DialogTitle>
              <DialogDescription id={`${id}-description`}>
                Sign in with your administrator email and password.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id}-email`}>Email</Label>
                <Input
                  id={`${id}-email`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="hi@yourcompany.com"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-password`}>Password</Label>
                <Input
                  id={`${id}-password`}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id={`${id}-remember`}
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
                disabled={submitting}
              />
              <Label htmlFor={`${id}-remember`} className="font-normal text-metal-dark">Remember me on this device</Label>
            </div>

            {error && <p id={`${id}-error`} role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <LoaderCircle className="mr-2 animate-spin" size={16} aria-hidden="true" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function AdminLoading() {
  return (
    <main className="relative z-[1] grid min-h-screen place-items-center" aria-live="polite">
      <div className="flex items-center gap-3 rounded-lg border border-metal-mid bg-white px-5 py-4 shadow-metal">
        <LoaderCircle className="animate-spin" size={20} aria-hidden="true" />
        <span className="text-sm font-medium">Checking administrator access…</span>
      </div>
    </main>
  );
}
