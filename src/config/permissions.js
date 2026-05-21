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
    'notifications',
    'webhooks',
    'analytics',
    'homeCollections',
    'samples'
  ],
  pathologist: [
    'results',
    'reports',
    'patients',
    'notifications'
  ],
  technician: [
    'results',
    'samples',
    'patients'
  ],
  receptionist: [
    'patients',
    'visits',
    'billing'
  ],
  doctor: [
    'reports',
    'patients',
    'doctors'
  ],
  patient: [
    'reports',
    'patients',
    'billing'
  ],
  phlebotomist: [
    'homeCollections',
    'patients',
    'samples'
  ],
  collectionCenter: [
    'patients',
    'visits',
    'samples',
    'reports',
    'billing'
  ]
};

export default PERMISSIONS;
