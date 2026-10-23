export const BLOCK_GROUPS = [
  { label: 'BPC', options: ['BPC'] },
  { label: 'Numbered Blocks', options: ['1', '2', '3', '4', '5', '6'] },
  { label: 'Lettered Blocks', options: ['A', 'B', 'C', 'D', 'E', 'F'] },
  { label: 'Sekgoma', options: ['Sekgoma 1', 'Sekgoma 2', 'Sekgoma 3', 'Sekgoma 4'] },
  { label: 'Fengyue', options: ['Fengyue 1', 'Fengyue 2', 'Fengyue 3', 'Fengyue 4'] },
  { label: 'Main Halls', options: ['Old Main Boys', 'Old Main Girls', 'New Main Boys', 'New Main Girls'] },
  { label: 'Campus Facilities', options: ['Student Center', 'Admin', 'Engineering Block', 'Science Block', 'Primary', 'Refectory'] },
];
export const BLOCKS = BLOCK_GROUPS.flatMap((g) => g.options);
export const RESIDENTIAL_BLOCKS = BLOCK_GROUPS.filter((g) => g.label !== 'Campus Facilities').flatMap((g) => g.options);
export const FACILITIES_GROUP = BLOCK_GROUPS.find((g) => g.label === 'Campus Facilities');

export const CATEGORIES = [
  { id: 'electricity', label: 'Electricity', icon: '⚡' },
  { id: 'plumbing', label: 'Plumbing', icon: '💧' },
  { id: 'furniture', label: 'Carpentry', icon: '🔨' },
  { id: 'access', label: 'Access/Other', icon: '🔑' },
  { id: 'transport', label: 'Transport', icon: '🚌' },
  { id: 'wifi', label: 'WiFi', icon: '📶' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
];

export const SPECIALTIES = [
  { id: 'all', label: 'All categories' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'furniture', label: 'Carpentry' },
  { id: 'access', label: 'Access/Other' },
  { id: 'transport', label: 'Transport' },
  { id: 'wifi', label: 'WiFi' },
  { id: 'inventory', label: 'Inventory' },
];

export const STATUSES = [
  { id: 'pending', label: 'Pending', color: '#F2A93C' },
  { id: 'in_progress', label: 'In progress', color: '#5B9BD5' },
  { id: 'no_access', label: 'No access', color: '#E15554' },
  { id: 'done', label: 'Done', color: '#4FB477' },
];

export const ROLE_OPTIONS = [
  { id: 'student', label: 'Student' },
  { id: 'reporter', label: 'RA' },
  { id: 'maintainer', label: 'Maintainer' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'admin', label: 'Admin' },
];
export const ROLE_META = {
  admin: { label: 'Admin', color: '#F2A93C' },
  maintainer: { label: 'Maintainer', color: '#5B9BD5' },
  supervisor: { label: 'Supervisor', color: '#4FB477' },
  reporter: { label: 'RA', color: '#8B96AD' },
  student: { label: 'Student', color: '#A78BFA' },
};
// Everyone except students. Staff accounts are created by an admin; students sign themselves up.
export const STAFF_ROLES = ['admin', 'supervisor', 'maintainer', 'reporter'];
export const PASSWORD_MIN = 8;

export const ARCHIVE_MS = 7 * 24 * 60 * 60 * 1000;

// Academic semesters, oldest first. A semester runs from its `start` date until
// the next one's start (the last one is open-ended). The "current" semester is
// whichever one has started most recently — so when a new start date passes, the
// app rolls over on its own, and anything still open carries into it.
// When the real Semester 2 start date is known, change its `start` below.
export const SEMESTERS = [
  { id: '2026-27-S1', label: '2026/27 · Semester 1', short: 'S1 26/27', start: '2026-08-01' },
  { id: '2026-27-S2', label: '2026/27 · Semester 2', short: 'S2 26/27', start: '2027-02-01' },
];

// Quick-pick wording for common problems per category (electricity/plumbing/carpentry/inventory come from the
// legacy tracker's own lists). Tapping one fills the description; staff can still type anything.
export const COMMON_ISSUES = {
  "electricity": [
    "Main light not working",
    "Sockets not working",
    "Study lamp not working",
    "Fan not working",
    "No fan knob",
    "Faulty main light switch",
    "Faulty study lamp switch",
    "Damaged sockets"
  ],
  "plumbing": [
    "Blocked showers",
    "Low pressure in toilets",
    "Sink tap leaking",
    "Sink basin blocked",
    "Laundry room tap leaking",
    "Laundry room sink blocked"
  ],
  "furniture": [
    "Malfunctioning door lock",
    "Wardrobe door detached",
    "Study table door detached"
  ],
  "inventory": [
    "Chairs missing",
    "Table missing"
  ],
  "wifi": [
    "No internet in the room",
    "Router not working",
    "Very weak signal"
  ],
  "access": [
    "Door lock jammed",
    "Key not working",
    "Cannot get into the room"
  ],
  "transport": [
    "Shuttle late or not running",
    "Vehicle breakdown"
  ]
};

// For issues that aren't in a numbered room — fills the room field.
export const COMMON_AREAS = ['Kitchen', 'Laundry', 'Ablution', 'Passage', 'Outside'];

// Accent colour per category — shared by the filter chips, ticket cards and Summary charts.
export const CATEGORY_COLORS = {
  electricity: '#F2A93C',
  plumbing: '#5B9BD5',
  furniture: '#E8873A',
  access: '#8B96AD',
  transport: '#4FB477',
  wifi: '#A78BFA',
  inventory: '#F472B6',
};
