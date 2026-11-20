/**
 * Phase 0 Security Rules Verification Matrix for Ryan's Shoes Collection.
 * Verifies the "Dirty Dozen" adversarial payloads against DRAFT_firestore.rules / firestore.rules.
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const dirtyDozenSecurityCases: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Privilege Escalation on Signup',
    operation: 'create',
    path: '/customers/attacker_1',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'attacker_1', role: 'admin', email: 'attacker@example.com', fullName: 'Attacker' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    name: 'Role Mutation on Profile Update',
    operation: 'update',
    path: '/customers/cust_1',
    auth: { uid: 'cust_1', email: 'cust@example.com', email_verified: true },
    payload: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    name: 'Unauthenticated Product Creation',
    operation: 'create',
    path: '/products/shoe_x',
    auth: null,
    payload: { id: 'shoe_x', name: 'Fake Shoe', price: 100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    name: 'Customer Modifying Product Stock',
    operation: 'update',
    path: '/products/shoe_1',
    auth: { uid: 'cust_1', email: 'cust@example.com', email_verified: true },
    payload: { stock: 999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Cross-User PII Read',
    operation: 'get',
    path: '/customers/victim_1',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Cross-User Order Scraping (List without owner match)',
    operation: 'list',
    path: '/orders',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'Order Identity Spoofing',
    operation: 'create',
    path: '/orders/order_1',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    payload: { id: 'order_1', customerId: 'victim_1', orderStatus: 'Pending' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    name: 'Order Status Shortcut on Create',
    operation: 'create',
    path: '/orders/order_2',
    auth: { uid: 'cust_1', email: 'cust@example.com', email_verified: true },
    payload: { id: 'order_2', customerId: 'cust_1', orderStatus: 'Delivered', paymentStatus: 'Verified & Paid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    name: 'Shadow Field Injection on Order',
    operation: 'create',
    path: '/orders/order_3',
    auth: { uid: 'cust_1', email: 'cust@example.com', email_verified: true },
    payload: { id: 'order_3', customerId: 'cust_1', isFreeVip: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'ID Poisoning (>128 chars)',
    operation: 'create',
    path: `/orders/${'a'.repeat(200)}`,
    auth: { uid: 'cust_1', email: 'cust@example.com', email_verified: true },
    payload: { id: 'a'.repeat(200), customerId: 'cust_1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Unverified Email Spoofing as Admin',
    operation: 'create',
    path: '/products/shoe_spoof',
    auth: { uid: 'spoof_1', email: 'clonekey7@gmail.com', email_verified: false },
    payload: { id: 'shoe_spoof', name: 'Spoof' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Order Deletion Attempt',
    operation: 'delete',
    path: '/orders/order_1',
    auth: { uid: 'cust_1', email: 'cust@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
