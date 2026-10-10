export type StaffRole = 'admin' | 'operador' | 'repartidor';
export type OrderStatus =
  | 'nuevo'
  | 'aceptado'
  | 'en_preparacion'
  | 'listo'
  | 'en_camino'
  | 'entregado'
  | 'cancelado';
export type PaymentStatus = 'pendiente' | 'por_verificar' | 'verificado' | 'rechazado' | 'cobrar_en_entrega';
export type PaymentMethod = 'binance' | 'bolivares' | 'efectivo';
export type DeliveryType = 'pickup' | 'delivery';
export type CashCurrency = 'COP' | 'USD' | 'BS';
export type DisplayCurrency = 'COP' | 'USDT' | 'BS';

export interface Settings {
  id: number;
  business_name: string;
  tagline: string | null;
  logo_url: string | null;
  whatsapp_phone: string;
  instagram: string | null;
  address: string | null;
  city: string | null;
  store_lat: number | null;
  store_lng: number | null;
  timezone: string;
  min_order_cop: number;
  prep_time_min: number;
  delivery_time_min: number;
  open_override: 'auto' | 'open' | 'closed';
  allow_scheduled: boolean;
  allow_scheduled_when_closed: boolean;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  delivery_mode: 'flat' | 'zones';
  delivery_fee_cop: number;
  cop_rounding: number;
  rate_stale_hours: number;
  binance_pay_id: string | null;
  binance_email: string | null;
  binance_name: string | null;
  pago_movil_bank: string | null;
  pago_movil_phone: string | null;
  pago_movil_id: string | null;
  transfer_bank: string | null;
  transfer_account: string | null;
  transfer_holder: string | null;
  transfer_id: string | null;
  cash_currencies: CashCurrency[];
  accept_binance: boolean;
  accept_bolivares: boolean;
  accept_cash: boolean;
  rate_limit_phone: number;
  rate_limit_ip: number;
  rate_limit_window_min: number;
  updated_at: string;
}

export interface ExchangeRate {
  id: number;
  cop_per_usdt: number;
  bs_per_usdt: number;
  source: 'manual' | 'binance';
  created_by: string | null;
  created_at: string;
}

export interface Rates {
  cop_per_usdt: number;
  bs_per_usdt: number;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee_cop: number;
  active: boolean;
  sort: number;
}

export interface BusinessHour {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort: number;
  active: boolean;
}

export interface ModifierOption {
  id: string;
  group_id: string;
  name: string;
  price_cop: number;
  available: boolean;
  sort: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  internal_name: string | null;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_select: number;
  max_select: number;
  sort: number;
  options: ModifierOption[];
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price_cop: number;
  image_url: string | null;
  tags: string[];
  available: boolean;
  active: boolean;
  is_combo: boolean;
  sort: number;
}

export interface MenuProduct extends Product {
  groups: ModifierGroup[];
  combo: { product_id: string; name: string; quantity: number; available: boolean }[];
}

export interface MenuCategory extends Category {
  products: MenuProduct[];
}

export interface MenuData {
  settings: Settings;
  rate: Rates | null;
  rateId: number | null;
  rateUpdatedAt: string | null;
  hours: BusinessHour[];
  zones: DeliveryZone[];
  categories: MenuCategory[];
  isOpen: boolean;
}

export interface OrderItemModifier {
  id?: string;
  option_id: string | null;
  group_name: string;
  option_name: string;
  price_cop: number;
}

export interface OrderItem {
  id?: string;
  product_id: string | null;
  product_name: string;
  base_price_cop?: number;
  unit_price_cop: number;
  quantity: number;
  line_total_cop: number;
  notes: string | null;
  modifiers: OrderItemModifier[];
}

export interface Order {
  id: string;
  number: number;
  code: string;
  tracking_token: string;
  source: 'web' | 'manual';
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_cedula: string | null;
  delivery_type: DeliveryType;
  address: string | null;
  address_reference: string | null;
  lat: number | null;
  lng: number | null;
  zone_id: string | null;
  zone_name: string | null;
  subtotal_cop: number;
  delivery_fee_cop: number;
  total_cop: number;
  total_usdt: number;
  total_bs: number;
  rate_cop_usdt: number;
  rate_bs_usdt: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  proof_path: string | null;
  payment_reject_reason: string | null;
  payment_verified_at: string | null;
  cash_currency: CashCurrency | null;
  cash_amount: number | null;
  status: OrderStatus;
  cancel_reason: string | null;
  notes: string | null;
  scheduled_for: string | null;
  driver_id: string | null;
  accepted_at: string | null;
  ready_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: (OrderItem & { order_item_modifiers?: OrderItemModifier[] })[];
}

export interface TrackingOrder {
  id: string;
  code: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  has_proof: boolean;
  payment_reject_reason: string | null;
  cancel_reason: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_type: DeliveryType;
  address: string | null;
  address_reference: string | null;
  lat: number | null;
  lng: number | null;
  zone_name: string | null;
  subtotal_cop: number;
  delivery_fee_cop: number;
  total_cop: number;
  total_usdt: number;
  total_bs: number;
  rate_cop_usdt: number;
  rate_bs_usdt: number;
  cash_currency: CashCurrency | null;
  cash_amount: number | null;
  scheduled_for: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  history: { status: string; note: string | null; created_at: string }[];
}

export interface StaffProfile {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  created_at: string;
}
