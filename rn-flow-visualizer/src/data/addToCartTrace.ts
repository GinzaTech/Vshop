import type { FlowTrace } from '../types/trace';

const traceId = 'trace_add_to_cart';

export const addToCartTrace: FlowTrace = {
  id: traceId,
  name: 'Add To Cart Flow',
  description: 'ProductCard dispatches an add item action, cart state changes, badge updates, and a toast confirms success.',
  platform: 'android',
  framework: 'react-native',
  stateManager: 'redux',
  createdAt: '2026-07-06T00:00:00.000Z',
  events: [
    { id: 'cart-e1', traceId, order: 1, type: 'UI_EVENT', label: 'User presses Add to Cart', timestamp: 0, durationMs: 9, status: 'success', source: { file: 'ProductCard.tsx', componentName: 'ProductCard', functionName: 'onPress' }, input: { productId: 'p_001' }, tool: 'Reactotron' },
    { id: 'cart-e2', traceId, order: 2, type: 'FUNCTION_CALL', label: 'ProductCard.handleAddToCart()', timestamp: 60, durationMs: 26, status: 'success', source: { file: 'ProductCard.tsx', functionName: 'handleAddToCart' }, tool: 'Manual' },
    { id: 'cart-e3', traceId, order: 3, type: 'STATE_ACTION', label: 'dispatch(cart/addItem)', timestamp: 110, durationMs: 18, status: 'success', input: { type: 'cart/addItem', payload: { productId: 'p_001', quantity: 1 } }, tool: 'Redux DevTools' },
    { id: 'cart-e4', traceId, order: 4, type: 'STATE_UPDATE', label: 'cart.items updated', timestamp: 160, durationMs: 32, status: 'success', stateBefore: { cart: { items: [] } }, stateAfter: { cart: { items: [{ productId: 'p_001', quantity: 1 }] } }, tool: 'Redux DevTools' },
    { id: 'cart-e5', traceId, order: 5, type: 'COMPONENT_RENDER', label: 'Cart badge renders quantity 1', timestamp: 240, durationMs: 24, status: 'success', source: { file: 'CartBadge.tsx', componentName: 'CartBadge' }, output: { count: 1 }, tool: 'React Native DevTools' },
    { id: 'cart-e6', traceId, order: 6, type: 'COMPONENT_RENDER', label: 'Toast shows success message', timestamp: 300, durationMs: 20, status: 'success', source: { file: 'ToastHost.tsx', componentName: 'ToastHost' }, output: { message: 'Added to cart' }, tool: 'Reactotron' },
  ],
};
