export const CATEGORY_META = {
  // Carbon sources use shades of red: carbon is harmful
  transport: { label: 'Transport', icon: 'car', color: '#8e1b1b' },
  energy: { label: 'Energy', icon: 'bolt', color: '#d93a32' },
  waste: { label: 'Waste', icon: 'trash', color: '#f08a7e' },
  overall: { label: 'Overall', icon: 'globe', color: '#c62828' },
  food: { label: 'Food', icon: 'salad', color: '#3f8a50' },
  water: { label: 'Water', icon: 'droplet', color: '#3b7dd8' },
  lifestyle: { label: 'Lifestyle', icon: 'sprout', color: '#3f8a50' },
};

export const kg = (n, digits = 1) =>
  `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })} kg`;

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return shortDate(d);
};

// yyyy-mm-dd in local time, for <input type="date">
export const toInputDate = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const CARBON_RED = '#c62828';

// ---- Profile options (second item is an Icon name) (must match server/models/User.js OPTIONS) ----
export const INTERESTS = [
  ['carbon', 'leaf', 'Reduce carbon footprint'],
  ['living', 'home', 'Sustainable living'],
  ['energy', 'bolt', 'Green energy'],
  ['transport', 'car', 'Eco-friendly transport'],
  ['waste', 'trash', 'Waste management'],
  ['water', 'droplet', 'Water conservation'],
  ['community', 'users', 'Community activities'],
  ['education', 'book', 'Climate education'],
  ['food', 'salad', 'Sustainable food'],
];
export const INITIAL_GOALS = [
  ['reduce', 'sprout', 'Reduce my carbon footprint', 'Track and lower my daily emissions'],
  ['lifestyle', 'chart', 'Adopt a greener lifestyle', 'Make more sustainable choices daily'],
  ['community', 'users', 'Get involved in the community', 'Share tips and learn from others'],
];
export const FOCUS_AREAS = [
  ['energy', 'bolt', 'Energy efficiency'],
  ['waste', 'trash', 'Waste reduction'],
  ['transport', 'car', 'Sustainable transport'],
  ['supply', 'link', 'Green supply chain'],
  ['employees', 'users', 'Employee engagement'],
  ['reporting', 'chart', 'Carbon reporting'],
  ['resources', 'recycle', 'Resource conservation'],
  ['other', 'plus', 'Other'],
];
export const ORG_TYPES = ['Company', 'College / University', 'School', 'NGO / Non-profit', 'Residential society', 'City / Government body', 'Other'];
// A business's communities take the type of the organisation (set at registration)
const ORG_TO_COMMUNITY = { 'Company': 'company', 'College / University': 'college', 'School': 'college', 'NGO / Non-profit': 'ngo', 'Residential society': 'society', 'City / Government body': 'city', 'Other': 'company' };
export const communityTypeFor = (orgType) => ORG_TO_COMMUNITY[orgType] || 'company';
export const INDUSTRIES = ['IT / Software', 'Manufacturing', 'Education', 'Healthcare', 'Retail', 'Finance', 'Hospitality', 'Logistics', 'Construction', 'NGO / Non-profit', 'Government', 'Other'];
export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
export const COUNTRIES = ['India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'United Arab Emirates', 'United Kingdom', 'United States', 'Other'];

export const COMMUNITY_TYPES = { company: 'Company', college: 'College', city: 'City', interest: 'Interest', society: 'Residential society', ngo: 'NGO' };

// Name other people see: company name for business accounts
export const displayName = (u) => (!u ? '' : u.displayName || (u.role === 'business' ? u.companyName || u.name : u.name));
export const isBusiness = (u) => u?.role === 'business';

export const LEVEL = {
  high: { label: 'Above average', short: 'High', cls: 'pill-red', insight: '' },
  average: { label: 'Around average', short: 'Average', cls: 'pill-warn', insight: 'mid' },
  low: { label: 'Below average', short: 'Low', cls: 'pill-ok', insight: 'good' },
  unknown: { label: 'No data yet', short: 'No data', cls: '', insight: 'mid' },
};

// Absolute URL for uploaded files (avatars) when the API is on another origin
export const fileUrl = (path) => (path ? `${import.meta.env.VITE_API_URL || ''}${path}` : '');

// Where each account type lands after login
export const homeFor = (user) => (user?.role === 'admin' ? '/admin' : user?.role === 'business' ? '/business' : '/dashboard');

export const GENDERS = [['female', 'Female'], ['male', 'Male'], ['other', 'Other'], ['prefer_not', 'Prefer not to say']];
