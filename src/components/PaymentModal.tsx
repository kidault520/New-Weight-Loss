import { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle2, Check, PenLine } from 'lucide-react';
import { CenterModal } from './common/CenterModal';
import {
  createPaymentOrder,
  checkOrderPaymentStatus,
  confirmSimulatedPaymentOnly,
} from '../services/paymentService';

export interface PaymentOrderInfo {
  id: string;
  order_number: string;
  product_name: string;
  total_amount: number;
  payment_method: string;
  /** 与「我的订单」一致：库表是否支持 confirm_status */
  agreementFieldsSupported?: boolean;
  /** 订单是否已在服务端标记协议已确认 */
  agreementConfirmedOnServer?: boolean;
}

interface PaymentModalProps {
  show: boolean;
  onClose: () => void;
  order: PaymentOrderInfo | null;
  onSuccess?: () => void | Promise<void>;
  /** 在发起支付前写入订单协议确认（与订单页「确认协议」一致） */
  onEnsureServerAgreement?: () => Promise<void>;
}

/** 支付方式选项：支付宝、微信支付、云闪付（无 Apple Pay） */
const PAYMENT_OPTIONS = [
  { id: '支付宝', label: '支付宝支付', iconBg: 'bg-blue-500', icon: '支' },
  { id: '微信支付', label: '微信支付', iconBg: 'bg-green-500', icon: '微' },
  { id: '银行卡', label: '云闪付', iconBg: 'bg-red-500', icon: '云' },
] as const;

/** 支付弹窗内展示的模拟协议摘要（与订单页逻辑位置对应，非电子签） */
const PAYMENT_AGREEMENT_SNIPPET = `《服务与支付说明》（模拟）

一、您将按订单应付金额完成支付，支付成功后服务方将按约定启动营养与健康相关服务。
二、请确认所购方案、金额与订单信息无误后再支付。
三、具体退款与争议处理以完整服务协议及客服说明为准。

以下为流程模拟：勾选「已阅读」并「模拟签字」后方可发起支付。`;

const formatAmount = (amount: number) => `¥${Number(amount).toFixed(2)}`;

function pickPaymentUrl(payment?: Record<string, unknown>): string {
  if (!payment) return '';
  const candidates = ['redirect_url', 'pay_url', 'payment_url', 'qr_code_url', 'url'];
  for (const key of candidates) {
    const val = payment[key];
    if (typeof val === 'string' && /^https?:\/\//i.test(val)) {
      return val;
    }
  }
  return '';
}

function isMockCheckout(provider?: string, payment?: Record<string, unknown>): boolean {
  if (provider === 'mock') return true;
  if (payment && payment.embedded_mock === true) return true;
  const url = pickPaymentUrl(payment);
  if (/mock-pay\.local/i.test(url)) return true;
  return false;
}

export function PaymentModal({
  show,
  onClose,
  order,
  onSuccess,
  onEnsureServerAgreement,
}: PaymentModalProps) {
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hintMsg, setHintMsg] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('微信支付');
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');

  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [signatureMocked, setSignatureMocked] = useState(false);

  const [nestedOpen, setNestedOpen] = useState(false);
  const [nestedKind, setNestedKind] = useState<'mock' | 'external' | null>(null);
  const [nestedError, setNestedError] = useState('');

  const resetAll = () => {
    setSuccess(false);
    setErrorMsg('');
    setHintMsg('');
    setSelectedMethod('微信支付');
    setPendingConfirm(false);
    setPaymentUrl('');
    setAgreementAccepted(false);
    setSignatureMocked(false);
    setNestedOpen(false);
    setNestedKind(null);
    setNestedError('');
  };

  useEffect(() => {
    if (!show) {
      resetAll();
      return;
    }
    if (!order) return;
    setSuccess(false);
    setErrorMsg('');
    setHintMsg('');
    setPendingConfirm(false);
    setPaymentUrl('');
    setNestedOpen(false);
    setNestedKind(null);
    setNestedError('');
    setAgreementAccepted(!!order.agreementConfirmedOnServer);
    setSignatureMocked(false);
  }, [show, order?.id]);

  const handleClose = () => {
    if (!paying) {
      resetAll();
      onClose();
    }
  };

  const closeNested = () => {
    setNestedOpen(false);
    setNestedKind(null);
    setNestedError('');
  };

  const finishSuccess = async () => {
    setSuccess(true);
    setTimeout(async () => {
      await onSuccess?.();
      onClose();
    }, 1200);
  };

  const handleCreatePayment = async () => {
    if (!order || paying) return;

    if (!agreementAccepted || !signatureMocked) {
      setErrorMsg('请先阅读并同意说明，并完成模拟签字后再支付。');
      return;
    }

    setPaying(true);
    setErrorMsg('');
    setHintMsg('');

    try {
      if (order.agreementFieldsSupported && !order.agreementConfirmedOnServer) {
        if (onEnsureServerAgreement) {
          await onEnsureServerAgreement();
        }
      }

      const result = await createPaymentOrder(order.id, selectedMethod);
      if (!result.success) {
        setErrorMsg(result.error || '支付失败，请重试');
        return;
      }

      const url = pickPaymentUrl(result.payment);
      const provider = result.provider;
      setPaymentUrl(url);

      if (isMockCheckout(provider, result.payment)) {
        setNestedKind('mock');
        setNestedOpen(true);
        setPendingConfirm(false);
        setHintMsg('请在弹窗内完成模拟支付（不会打开新窗口）。');
        return;
      }

      if (url) {
        setNestedKind('external');
        setNestedOpen(true);
        setPendingConfirm(true);
        setHintMsg('请在子收银台内打开第三方支付页面；支付完成后返回本页刷新状态。');
        return;
      }

      setPendingConfirm(true);
      setHintMsg('支付单已创建；若渠道未返回跳转链接，请完成支付后点击「刷新支付状态」。');
    } catch {
      setErrorMsg('支付请求异常，请重试');
    } finally {
      setPaying(false);
    }
  };

  const handleMockPaySuccess = async () => {
    if (!order || paying) return;
    setPaying(true);
    setNestedError('');
    try {
      const r = await confirmSimulatedPaymentOnly(order.id);
      if (!r.success) {
        setNestedError(r.error || '模拟支付失败');
        return;
      }
      closeNested();
      await finishSuccess();
    } finally {
      setPaying(false);
    }
  };

  const handleRefreshPaymentStatus = async () => {
    if (!order || paying) return;
    setPaying(true);
    setErrorMsg('');
    const statusResult = await checkOrderPaymentStatus(order.id);
    setPaying(false);
    if (!statusResult.success) {
      setErrorMsg(statusResult.error || '查询支付状态失败，请稍后重试');
      return;
    }
    if (!statusResult.paid) {
      setErrorMsg('尚未收到支付成功结果。若为本机联调，可使用下方「模拟支付成功」。');
      return;
    }
    await finishSuccess();
  };

  const handleDevForcePaid = async () => {
    if (!order || paying) return;
    setPaying(true);
    setErrorMsg('');
    try {
      const r = await confirmSimulatedPaymentOnly(order.id);
      if (!r.success) {
        setErrorMsg(r.error || '模拟支付失败');
        return;
      }
      await finishSuccess();
    } finally {
      setPaying(false);
    }
  };

  const openExternalPay = () => {
    if (!paymentUrl) return;
    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
  };

  if (!order) return null;

  return (
    <>
      <CenterModal show={show} onClose={handleClose} title="支付收银台" maxWidth="max-w-md" zIndex={80}>
        <div className="px-6 py-4 max-h-[min(85vh,720px)] overflow-y-auto">
          {success ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <p className="text-lg font-medium text-gray-800">支付成功</p>
              <p className="text-sm text-gray-500">感谢您的购买</p>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">商品</span>
                  <span className="font-medium text-gray-800">{order.product_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">订单号</span>
                  <span className="text-gray-700">{order.order_number}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-semibold pt-2 border-t border-gray-200">
                  <span className="text-gray-700">应付金额</span>
                  <span className="text-red-600">{formatAmount(order.total_amount)}</span>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">选择支付方式</p>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedMethod(opt.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div
                        className={`w-10 h-10 rounded-lg ${opt.iconBg} flex items-center justify-center text-white font-bold text-sm`}
                      >
                        {opt.icon}
                      </div>
                      <span className="flex-1 text-left text-gray-800">{opt.label}</span>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedMethod === opt.id
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedMethod === opt.id && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  本弹窗为聚合收银台；选择渠道后将在小弹窗内继续（模拟环境不跳转假外链）。
                </p>
              </div>

              <div className="mb-4 rounded-xl border border-gray-200 bg-amber-50/40 p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-800">协议与签字（模拟）</p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-28 overflow-y-auto bg-white/80 rounded-lg p-2 border border-amber-100">
                  {PAYMENT_AGREEMENT_SNIPPET}
                </pre>
                <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-gray-300"
                    checked={agreementAccepted}
                    disabled={!!order.agreementConfirmedOnServer}
                    onChange={(e) => setAgreementAccepted(e.target.checked)}
                  />
                  <span>
                    我已阅读并同意上述说明（模拟）
                    {order.agreementConfirmedOnServer ? (
                      <span className="block text-xs text-green-700 mt-0.5">订单页已同步协议确认</span>
                    ) : null}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setSignatureMocked(true)}
                  className={`w-full py-2 rounded-xl text-sm font-medium border-2 flex items-center justify-center gap-2 transition-colors ${
                    signatureMocked
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : 'border-dashed border-gray-300 text-gray-700 hover:bg-white'
                  }`}
                >
                  <PenLine className="w-4 h-4" />
                  {signatureMocked ? '✓ 已模拟签字' : '点击模拟签字'}
                </button>
              </div>

              {errorMsg && <p className="text-sm text-red-600 mb-3">{errorMsg}</p>}

              {hintMsg && !errorMsg && <p className="text-sm text-blue-800 mb-3">{hintMsg}</p>}

              {!pendingConfirm ? (
                <button
                  onClick={handleCreatePayment}
                  disabled={paying || !agreementAccepted || !signatureMocked}
                  className="w-full py-3 rounded-xl bg-yellow-400 text-gray-900 font-semibold flex items-center justify-center gap-2 hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      确认支付
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleRefreshPaymentStatus}
                    disabled={paying}
                    className="w-full py-3 rounded-xl bg-yellow-400 text-gray-900 font-semibold flex items-center justify-center gap-2 hover:bg-yellow-500 transition-colors disabled:opacity-70"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        我已完成支付，刷新状态
                      </>
                    )}
                  </button>
                  {import.meta.env.DEV && (
                    <button
                      type="button"
                      onClick={handleDevForcePaid}
                      disabled={paying}
                      className="w-full mt-2 py-2 rounded-xl border border-dashed border-amber-600 text-amber-900 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
                    >
                      开发联调：模拟支付成功（写库）
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </CenterModal>

      <CenterModal
        show={nestedOpen && nestedKind === 'mock'}
        onClose={() => !paying && closeNested()}
        title={`${selectedMethod} · 模拟收银台`}
        maxWidth="max-w-sm"
        zIndex={100}
      >
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            当前为联调/模拟环境，不会打开外部链接。点击下方按钮即可将订单标记为已支付（走服务端 confirm-payment）。
          </p>
          <div className="flex justify-between text-base font-semibold text-gray-900">
            <span>应付</span>
            <span className="text-red-600">{formatAmount(order.total_amount)}</span>
          </div>
          {nestedError && <p className="text-sm text-red-600">{nestedError}</p>}
          <button
            type="button"
            onClick={handleMockPaySuccess}
            disabled={paying}
            className="w-full py-3 rounded-xl bg-yellow-400 text-gray-900 font-semibold hover:bg-yellow-500 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            模拟支付成功
          </button>
          <button
            type="button"
            onClick={() => !paying && closeNested()}
            disabled={paying}
            className="w-full py-2 rounded-xl border border-gray-300 text-gray-700 text-sm"
          >
            取消
          </button>
        </div>
      </CenterModal>

      <CenterModal
        show={nestedOpen && nestedKind === 'external'}
        onClose={() => !paying && closeNested()}
        title={`${selectedMethod} · 渠道收银台`}
        maxWidth="max-w-sm"
        zIndex={100}
      >
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            将打开第三方支付页面（新窗口）。支付完成后请关闭该窗口并返回，点击外层「我已完成支付，刷新状态」。
          </p>
          <button
            type="button"
            onClick={openExternalPay}
            className="w-full py-3 rounded-xl bg-yellow-400 text-gray-900 font-semibold hover:bg-yellow-500"
          >
            打开第三方支付页面
          </button>
          <button
            type="button"
            onClick={() => !paying && closeNested()}
            className="w-full py-2 rounded-xl border border-gray-300 text-gray-700 text-sm"
          >
            稍后支付
          </button>
        </div>
      </CenterModal>
    </>
  );
}
