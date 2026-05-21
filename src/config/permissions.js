export const PERMISSIONS = {
  superAdmin: ['*'],
  owner: [
    'patients',
    'visits',
    'results',
    'reports',
    'billing',
    'inventory',
    'doctors',
    'staff',
    'analytics',
    'settings'
  ],
  pathologist: ['patients', 'results', 'reports'],
  technician: ['patients', 'results', 'samples'],
  receptionist: ['patients', 'visits', 'billing', 'invoices', 'payments'],
  doctor: ['patients', 'reports', 'commissions'],
  patient: ['reports', 'payments', 'vault'],
  phlebotomist: ['patients', 'collections', 'samples'],
  collectionCenter: ['patients', 'visits', 'samples', 'reports', 'invoices']
};
