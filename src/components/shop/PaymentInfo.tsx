'use client';

import CopyField from './CopyField';
import { formatBs, formatUsdt } from '@/lib/money';
import type { PaymentMethod, Settings } from '@/lib/types';

const plain = (n: number) => n.toFixed(2);

/** Datos para pagar con Binance o bolívares + monto exacto. */
export default function PaymentInfo({
  method,
  settings,
  totalUsdt,
  totalBs,
}: {
  method: PaymentMethod;
  settings: Settings;
  totalUsdt: number;
  totalBs: number;
}) {
  if (method === 'binance') {
    return (
      <div className="space-y-2">
        <CopyField label="Monto exacto a enviar (USDT)" value={plain(totalUsdt)} big />
        <CopyField label="Binance Pay ID" value={settings.binance_pay_id || ''} />
        <CopyField label="Correo Binance" value={settings.binance_email || ''} />
        {settings.binance_name && <p className="text-xs text-sand-400 px-1">A nombre de: {settings.binance_name}</p>}
        <p className="text-xs text-sand-400 px-1">
          Envía exactamente <b className="text-sand-200">{formatUsdt(totalUsdt)}</b> por Binance Pay y luego sube la captura o escribe el ID de la orden.
        </p>
      </div>
    );
  }
  if (method === 'bolivares') {
    return (
      <div className="space-y-2">
        <CopyField label="Monto exacto en bolívares" value={plain(totalBs)} big />
        {(settings.pago_movil_phone || settings.pago_movil_bank) && (
          <div className="rounded-xl border border-ink-700 p-3 space-y-2">
            <p className="text-sm font-semibold text-gold-300">Pago móvil</p>
            <CopyField label="Banco" value={settings.pago_movil_bank || ''} />
            <CopyField label="Teléfono" value={settings.pago_movil_phone || ''} />
            <CopyField label="Cédula / RIF" value={settings.pago_movil_id || ''} />
          </div>
        )}
        {settings.transfer_account && (
          <div className="rounded-xl border border-ink-700 p-3 space-y-2">
            <p className="text-sm font-semibold text-gold-300">Transferencia</p>
            <CopyField label="Banco" value={settings.transfer_bank || ''} />
            <CopyField label="Cuenta" value={settings.transfer_account || ''} />
            <CopyField label="Titular" value={settings.transfer_holder || ''} />
            <CopyField label="Cédula / RIF" value={settings.transfer_id || ''} />
          </div>
        )}
        <p className="text-xs text-sand-400 px-1">
          Paga exactamente <b className="text-sand-200">{formatBs(totalBs)}</b> y luego sube la captura y escribe la referencia.
        </p>
      </div>
    );
  }
  return null;
}
