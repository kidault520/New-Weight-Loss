export interface OrderServiceStatusLike {
  payment_status: string;
  order_status?: string | null;
}

export function isOrderInService(order: OrderServiceStatusLike, orderEnded: boolean): boolean {
  if (orderEnded) return false;
  return order.payment_status === 'paid' && order.order_status === 'processing';
}

