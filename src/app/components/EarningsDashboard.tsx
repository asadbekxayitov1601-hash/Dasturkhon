import { useEffect, useState } from 'react';
import { Wallet, Gift, ShoppingBag, Clock, CheckCircle, XCircle, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { getEarnings, requestPayout, formatSom, EarningsSummary } from '../api/earningsApi';

export function EarningsDashboard() {
  const { t } = useTranslation();
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

  // Send the payout request directly for the full available balance — no popups.
  const handleRequestPayout = async () => {
    if (!data || data.balance <= 0) { toast.error(t('earnings.no_balance')); return; }
    setRequesting(true);
    try {
      await requestPayout(data.balance);
      toast.success(t('earnings.payout_requested'));
      await load();
    } catch (e: any) {
      toast.error(e.message || t('earnings.payout_failed'));
    } finally {
      setRequesting(false);
    }
  };

  if (loading || !data) return null;

  const statusPill = (status: string) => {
    const map: Record<string, { key: string; cls: string; icon: JSX.Element }> = {
      requested: { key: 'earnings.status_requested', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" /> },
      paid: { key: 'earnings.status_paid', cls: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" /> },
      rejected: { key: 'earnings.status_rejected', cls: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle className="w-3 h-3" /> },
    };
    const s = map[status] || map.requested;
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>{s.icon}{t(s.key)}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-[28px] p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg, #4A7C7E, #5A9FA3)', boxShadow: '0 10px 30px rgba(74,124,126,0.25)' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <Wallet className="w-4 h-4" /> {t('earnings.available_balance')}
            </div>
            <div className="text-4xl font-extrabold text-white">{formatSom(data.balance)}</div>
            <div className="text-white/70 text-xs mt-2">
              {t('earnings.earned')} {formatSom(data.totalEarned)} · {t('earnings.paid_out')} {formatSom(data.totalPaidOut)}
              {data.pending > 0 && ` · ${t('earnings.pending')} ${formatSom(data.pending)}`}
            </div>
          </div>
          <button
            onClick={handleRequestPayout}
            disabled={requesting || data.balance <= 0}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-primary font-semibold shadow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownToLine className="w-4 h-4" />
            {requesting ? t('earnings.requesting') : t('earnings.request_payout')}
          </button>
        </div>
        <p className="text-white/60 text-[11px] mt-4">{t('earnings.payout_note')}</p>
      </motion.div>

      {/* Earnings history */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-[28px] bg-white border border-primary/10 overflow-hidden"
      >
        <div className="p-5 border-b border-primary/10">
          <h3 className="font-semibold text-gray-900">{t('earnings.title')}</h3>
        </div>
        {data.earnings.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 text-center">{t('earnings.no_earnings')}</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.earnings.map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(74,124,126,0.08)' }}>
                  {e.type === 'tip' ? <Gift className="w-4 h-4 text-secondary" /> : <ShoppingBag className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {e.type === 'tip' ? t('earnings.tip') : t('earnings.recipe_sale')}{e.recipeTitle ? ` · ${e.recipeTitle}` : ''}
                  </p>
                  <p className="text-xs text-gray-400">{t('earnings.from', { name: e.from })} · {new Date(e.date).toLocaleDateString()}</p>
                </div>
                <span className="font-semibold text-green-600 text-sm">+{formatSom(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      {/* Payout history */}
      {data.payouts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[28px] bg-white border border-primary/10 overflow-hidden"
        >
          <div className="p-5 border-b border-primary/10">
            <h3 className="font-semibold text-gray-900">{t('earnings.payout_requests')}</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {data.payouts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{formatSom(p.amount)}</p>
                  <p className="text-xs text-gray-400">{new Date(p.requestedAt).toLocaleDateString()}</p>
                </div>
                {statusPill(p.status)}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
