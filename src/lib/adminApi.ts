import { paymentApiPath } from './paymentApi';

type AdminSessionResponse = {
  success: boolean;
  message?: string;
};

export async function verifyAdminSession(idToken: string): Promise<void> {
  const response = await fetch(paymentApiPath('/admin/session'), {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const body = (await response.json().catch(() => null)) as AdminSessionResponse | null;
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || 'Your administrator session could not be verified.');
  }
}
