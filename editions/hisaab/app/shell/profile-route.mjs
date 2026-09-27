/** Public reading, account settings and personal artifacts remain accessible before play. */
export function publicProfileRoute(name, view) {
  return ['home', 'start', 'rules', 'settings', 'receipts', 'ledger', 'not-found'].includes(name) || name === 'me';
}
