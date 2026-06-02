import { useEffect, useState } from 'react';
import { Wallet, Gift, ShoppingBag, Clock, CheckCircle, XCircle, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';
import { getEarnings, requestPayout, formatSom, EarningsSummary } from '../api/earningsApi';

export function EarningsDashboard() {
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const load = async () => {
    try {
      setData(await getEarnings());
    } catch {
      /* silently ignore — section just won't show numbers */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRequestPayout = async () => {
    if (!data || data.balance <= 0) return;
    const input = prompt(`How much would you like to withdraw? (available: ${formatSom(data.balance)})`, String(data.balance));
    if (input === null) return;
    const amount = Math.round(Number(input) || 0);
    if (amount <= 0) { toast.error('Enter a valid amount'); return; }
    setRequesting(true);
    try {
      await requestPayout(amount);
      toast.success('Payout requested. You will be paid manually — check status here.');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  if (loading || !data) return null;

  const statusPill = (status: string) => {
    const map: Record<string, { label: string; cls: string; icon: JSX.Element }> = {
      requested: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" /> },
      paid: { label: 'Paid', cls: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" /> },
      rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle className="w-3 h-3" /> },
    };
    const s = map[status] || map.requested;
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>{s.icon}{s.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Balance card */}
      <div
        className="rounded-[28px] p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg, #4A7C7E, #5A9FA3)', boxShadow: '0 10px 30px rgba(74,124,126,0.25)' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <Wallet className="w-4 h-4" /> Available balance
            </div>
            <div className="text-4xl font-extrabold text-white">{formatSom(data.balance)}</div>
            <div className="text-white/70 text-xs mt-2">
              Earned {formatSom(data.totalEarned)} · Paid out {formatSom(data.totalPaidOut)}
              {data.pending > 0 && ` · Pending ${formatSom(data.pending)}`}
            </div>
          </div>
          <button
            onClick={handleRequestPayout}
            disabled={requesting || data.balance <= 0}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-primary font-semibold shadow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownToLine className="w-4 h-4" />
            {requesting ? 'Requesting…' : 'Request payout'}
          </button>
        </div>
        <p className="text-white/60 text-[11px] mt-4">
          Payouts are sent manually. After you request, the admin transfers the money and marks it paid.
        </p>
      </div>

      {/* Earnings history */}
      <div className="rounded-[28px] bg-white border border-primary/10 overflow-hidden">
        <div className="p-5 border-b border-primary/10">
          <h3 className="font-semibold text-gray-900">Earnings</h3>
        </div>
        {data.earnings.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 text-center">No earnings yet. Tips and paid-recipe sales will appear here.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.earnings.map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-primary/8" style={{ background: 'rgba(74,124,126,0.08)' }}>
                  {e.type === 'tip' ? <Gift className="w-4 h-4 text-secondary" /> : <ShoppingBag className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {e.type === 'tip' ? 'Tip' : 'Recipe sale'}{e.recipeTitle ? ` · ${e.recipeTitle}` : ''}
                  </p>
                  <p className="text-xs text-gray-400">from {e.from} · {new Date(e.date).toLocaleDateString()}</p>
                </div>
                <span className="font-semibold text-green-600 text-sm">+{formatSom(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Payout history */}
      {data.payouts.length > 0 && (
        <div className="rounded-[28px] bg-white border border-primary/10 overflow-hidden">
          <div className="p-5 border-b border-primary/10">
            <h3 className="font-semibold text-gray-900">Payout requests</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {data.payouts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{formatSom(p.amount)}</p>
                  <p className="text-xs text-gray-400">Requested {new Date(p.requestedAt).toLocaleDateString()}</p>
                </div>
                {statusPill(p.status)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
