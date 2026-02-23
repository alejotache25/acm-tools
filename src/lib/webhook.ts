import { supabase } from './supabase';

export interface WebhookPayload {
  tabla: string;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  datos: Record<string, unknown>;
}

async function getWebhookUrl(): Promise<string | null> {
  const { data } = await supabase.from('config').select('webhook_url').single();
  return data?.webhook_url || null;
}

export async function sendWebhook(payload: WebhookPayload): Promise<boolean> {
  try {
    const url = await getWebhookUrl();
    if (!url) return false;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Retry any records with sync_pending=true for a given table */
export async function retrySyncPending(table: string, fuenteTabla: string): Promise<void> {
  const { data } = await supabase
    .from(table)
    .select('*')
    .eq('sync_pending', true)
    .limit(20);

  if (!data || data.length === 0) return;

  for (const row of data) {
    const ok = await sendWebhook({ tabla: fuenteTabla, accion: 'INSERT', datos: row });
    if (ok) {
      await supabase.from(table).update({ sync_pending: false }).eq('id', row.id);
    }
  }
}
