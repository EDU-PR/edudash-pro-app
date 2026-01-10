/**
 * Utility functions for member registration
 */

/**
 * Generate a secure temporary password
 * Format: Word-Number-Symbol (e.g., Tiger2024!)
 */
export function generateTemporaryPassword(): string {
  const words = [
    'Tiger', 'Lion', 'Eagle', 'Falcon', 'Phoenix',
    'Dragon', 'Panther', 'Leopard', 'Cheetah', 'Hawk',
    'Wolf', 'Bear', 'Shark', 'Cobra', 'Jaguar'
  ];
  
  const symbols = ['!', '@', '#', '$', '%', '*'];
  
  const word = words[Math.floor(Math.random() * words.length)];
  const year = new Date().getFullYear();
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  
  return `${word}${year}${symbol}`;
}

/**
 * Generate unique member number
 * Format: SOA-{REGION_CODE}-{YEAR}-{SEQUENCE}
 */
export function generateMemberNumber(regionCode: string): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const sequence = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
  return `SOA-${regionCode}-${year}-${sequence}`;
}

/**
 * Determine the correct dashboard route based on member type and role
 */
export function getDashboardRoute(memberType: string | null, role: string | null): string {
  // Super Admin (highest priority)
  if (role === 'super_admin' || role === 'superadmin' || role === 'platform_admin') {
    return '/screens/super-admin-dashboard';
  }

  // Organization/Member Type based routing
  switch (memberType) {
    // National Executive Roles
    case 'president':
    case 'national_president':
      return '/screens/membership/national-president-dashboard';
    
    case 'deputy_president':
    case 'national_deputy':
      return '/screens/membership/deputy-president-dashboard';
    
    case 'secretary_general':
      return '/screens/membership/secretary-general-dashboard';
    
    case 'treasurer':
    case 'national_treasurer':
      return '/screens/membership/treasurer-dashboard';
    
    // Youth Wing
    case 'youth_president':
      return '/screens/membership/youth-president-dashboard';
    
    case 'youth_deputy':
      return '/screens/membership/youth-deputy-dashboard';
    
    case 'youth_secretary':
      return '/screens/membership/youth-secretary-dashboard';
    
    case 'youth_treasurer':
      return '/screens/membership/youth-treasurer-dashboard';
    
    // Women's League
    case 'women_president':
      return '/screens/membership/women-president-dashboard';
    
    case 'women_deputy':
      return '/screens/membership/women-deputy-dashboard';
    
    case 'women_secretary':
      return '/screens/membership/women-secretary-dashboard';
    
    case 'women_treasurer':
      return '/screens/membership/women-treasurer-dashboard';
    
    // Veterans League
    case 'veterans_president':
      return '/screens/membership/veterans-president-dashboard';
    
    // Regional/Provincial Management
    case 'regional_manager':
    case 'regional_coordinator':
      return '/screens/membership/regional-manager-dashboard';
    
    case 'provincial_manager':
    case 'provincial_coordinator':
      return '/screens/membership/provincial-manager-dashboard';
    
    case 'branch_manager':
      return '/screens/membership/branch-manager-dashboard';
    
    // Administrative Roles
    case 'national_coordinator':
    case 'national_admin':
    case 'executive':
      return '/screens/membership/executive-dashboard';
    
    // Operational Roles
    case 'facilitator':
    case 'mentor':
    case 'youth_facilitator':
    case 'youth_mentor':
      return '/screens/membership/facilitator-dashboard';
    
    // Base member roles
    case 'learner':
    case 'youth_member':
    case 'member':
      return '/screens/membership/member-dashboard';
    
    default:
      break;
  }

  // Role-based fallback
  switch (role) {
    case 'admin':
    case 'principal':
    case 'principal_admin':
      return '/screens/principal-dashboard';
    
    case 'teacher':
      return '/screens/teacher-dashboard';
    
    case 'parent':
      return '/screens/parent-dashboard';
    
    case 'student':
      return '/screens/student-dashboard';
    
    default:
      // Final fallback to member dashboard
      return '/screens/membership/member-dashboard';
  }
}

/**
 * Get display name for member type
 */
export function getMemberTypeDisplayName(memberType: string): string {
  const displayNames: Record<string, string> = {
    // National Executive
    'president': 'National President',
    'deputy_president': 'Deputy President',
    'secretary_general': 'Secretary General',
    'treasurer': 'National Treasurer',
    
    // Youth Wing
    'youth_president': 'Youth President',
    'youth_deputy': 'Youth Deputy President',
    'youth_secretary': 'Youth Secretary',
    'youth_treasurer': 'Youth Treasurer',
    'youth_member': 'Youth Member',
    'youth_facilitator': 'Youth Facilitator',
    'youth_mentor': 'Youth Mentor',
    
    // Women's League
    'women_president': "Women's President",
    'women_deputy': "Women's Deputy President",
    'women_secretary': "Women's Secretary",
    'women_treasurer': "Women's Treasurer",
    
    // Veterans League
    'veterans_president': 'Veterans President',
    
    // Management
    'regional_manager': 'Regional Manager',
    'provincial_manager': 'Provincial Manager',
    'branch_manager': 'Branch Manager',
    'national_coordinator': 'National Coordinator',
    'national_admin': 'National Administrator',
    
    // Operational
    'facilitator': 'Facilitator',
    'mentor': 'Mentor',
    'executive': 'Executive Member',
    'learner': 'Learner',
    'member': 'Member',
  };
  
  return displayNames[memberType] || memberType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate South African phone number
 */
export function isValidSAPhoneNumber(phone: string): boolean {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // SA numbers should be 10 digits (0XX XXX XXXX) or 11 with country code (27XXXXXXXXX)
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('27'));
}

/**
 * Format phone number to SA format
 */
export function formatSAPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    // Format as: 0XX XXX XXXX
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('27')) {
    // Format as: +27 XX XXX XXXX
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  
  return phone; // Return as-is if format doesn't match
}
