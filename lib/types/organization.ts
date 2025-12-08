/**
 * Organization Type System
 * 
 * Provides a flexible, type-safe system for supporting multiple organization types
 * beyond just preschools (universities, corporate, K-12, sports clubs, etc.)
 * 
 * Part of Phase 3A: Organization Generalization Refactor
 */

/**
 * Supported organization types
 * Focused on early childhood, aftercare, and K-12 education
 * REMOVED: university, corporate, sports_club, community_org (not ECD/K-12 focused)
 */
export enum OrganizationType {
  PRESCHOOL = 'preschool',
  K12_SCHOOL = 'k12_school',
  TRAINING_CENTER = 'training_center',
  TUTORING_CENTER = 'tutoring_center',
  SKILLS_DEVELOPMENT = 'skills_development',
}

/**
 * Role definition for dynamic role systems
 * Allows each organization type to define its own roles
 */
export interface RoleDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  hierarchy_level: number; // 0 = lowest (member), higher = more authority
  capabilities: string[];
}

/**
 * Terminology mapping for organization-specific language
 * Maps generic terms to organization-specific terms
 */
export interface TerminologyMap {
  // Primary entity terminology
  member: string;           // e.g., "student", "employee", "athlete", "member"
  memberPlural: string;     // e.g., "students", "employees", "athletes"
  leader: string;           // e.g., "teacher", "manager", "coach", "instructor"
  leaderPlural: string;     // e.g., "teachers", "managers", "coaches"
  admin: string;            // e.g., "principal", "director", "club_admin"
  adminPlural: string;      // e.g., "principals", "directors", "admins"
  
  // Group terminology
  group: string;            // e.g., "class", "team", "department", "cohort"
  groupPlural: string;      // e.g., "classes", "teams", "departments"
  
  // Parent/Guardian terminology
  guardian: string;         // e.g., "parent", "sponsor", "manager"
  guardianPlural: string;   // e.g., "parents", "sponsors", "managers"
  
  // Activity terminology
  activity: string;         // e.g., "lesson", "training", "practice", "session"
  activityPlural: string;   // e.g., "lessons", "trainings", "practices"
  
  // Assessment terminology
  assessment: string;       // e.g., "grade", "evaluation", "performance_review"
  assessmentPlural: string; // e.g., "grades", "evaluations", "reviews"
  
  // Curriculum/Program terminology
  curriculum: string;       // e.g., "curriculum", "program", "training_plan"
  
  // Organization terminology
  organization: string;     // e.g., "school", "company", "club"
}

/**
 * AI personality configuration per organization type
 * Defines how Dash should behave and speak for each org type
 */
export interface AIPersonalityConfig {
  greeting: string;
  tone: 'formal' | 'casual' | 'professional' | 'friendly' | 'encouraging';
  expertiseAreas: string[];
  proactiveBehaviors: string[];
  taskCategories: string[];
}

/**
 * Organization configuration
 * Complete configuration for an organization type including terminology, roles, and AI behavior
 */
export interface OrganizationConfig {
  type: OrganizationType;
  displayName: string;
  description: string;
  
  // Terminology mapping
  terminology: TerminologyMap;
  
  // Role definitions
  roles: RoleDefinition[];
  
  // AI personality per role
  aiPersonalities: {
    [roleId: string]: AIPersonalityConfig;
  };
  
  // Feature flags
  features: {
    hasAttendance: boolean;
    hasGrading: boolean;
    hasScheduling: boolean;
    hasMessaging: boolean;
    hasReporting: boolean;
    hasCalendar: boolean;
    hasPayments: boolean;
    hasDocuments: boolean;
  };
  
  // UI customization
  ui: {
    primaryColor?: string;
    icon?: string;
    dashboardLayout: 'education' | 'corporate' | 'sports' | 'default';
  };
}

/**
 * Predefined organization configurations
 * Default configurations for each supported organization type
 */
export const ORGANIZATION_CONFIGS: Record<OrganizationType, OrganizationConfig> = {
  [OrganizationType.PRESCHOOL]: {
    type: OrganizationType.PRESCHOOL,
    displayName: 'Preschool',
    description: 'Early childhood education center',
    terminology: {
      member: 'student',
      memberPlural: 'students',
      leader: 'teacher',
      leaderPlural: 'teachers',
      admin: 'principal',
      adminPlural: 'principals',
      group: 'class',
      groupPlural: 'classes',
      guardian: 'parent',
      guardianPlural: 'parents',
      activity: 'lesson',
      activityPlural: 'lessons',
      assessment: 'grade',
      assessmentPlural: 'grades',
      curriculum: 'curriculum',
      organization: 'preschool',
    },
    roles: [
      {
        id: 'student',
        name: 'student',
        displayName: 'Student',
        description: 'Preschool student',
        permissions: ['view_own_profile', 'view_lessons'],
        hierarchy_level: 0,
        capabilities: ['learning', 'activities'],
      },
      {
        id: 'parent',
        name: 'parent',
        displayName: 'Parent',
        description: 'Parent or guardian',
        permissions: ['view_child_profile', 'message_teachers', 'view_reports'],
        hierarchy_level: 1,
        capabilities: ['messaging', 'monitoring'],
      },
      {
        id: 'teacher',
        name: 'teacher',
        displayName: 'Teacher',
        description: 'Classroom teacher',
        permissions: ['manage_class', 'grade_students', 'message_parents', 'create_lessons'],
        hierarchy_level: 2,
        capabilities: ['teaching', 'grading', 'planning', 'communication'],
      },
      {
        id: 'principal',
        name: 'principal',
        displayName: 'Principal',
        description: 'School principal',
        permissions: ['manage_school', 'view_all', 'manage_staff', 'reports'],
        hierarchy_level: 3,
        capabilities: ['management', 'analytics', 'administration'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      teacher: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'encouraging',
        expertiseAreas: ['education', 'lesson planning', 'classroom management', 'student assessment'],
        proactiveBehaviors: ['suggest_improvements', 'remind_deadlines', 'flag_concerns'],
        taskCategories: ['content', 'planning', 'communication'],
      },
      principal: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['school administration', 'staff management', 'analytics', 'policy'],
        proactiveBehaviors: ['monitor_metrics', 'suggest_strategies', 'track_goals'],
        taskCategories: ['management', 'strategic', 'operational'],
      },
      parent: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'friendly',
        expertiseAreas: ['parent communication', 'student progress', 'homework help'],
        proactiveBehaviors: ['remind_deadlines', 'suggest_activities', 'flag_updates'],
        taskCategories: ['organization', 'communication', 'personal'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#4A90E2',
      icon: 'school',
      dashboardLayout: 'education',
    },
  },
  
  // REMOVED: University, Corporate, Sports Club, Community Org configurations
  // EduDash Pro focuses exclusively on preschool, aftercare, and K-12 education
  
  [OrganizationType.K12_SCHOOL]: {
    type: OrganizationType.K12_SCHOOL,
    displayName: 'K-12 School',
    description: 'Primary and secondary education',
    terminology: {
      member: 'student',
      memberPlural: 'students',
      leader: 'teacher',
      leaderPlural: 'teachers',
      admin: 'principal',
      adminPlural: 'principals',
      group: 'class',
      groupPlural: 'classes',
      guardian: 'parent',
      guardianPlural: 'parents',
      activity: 'lesson',
      activityPlural: 'lessons',
      assessment: 'grade',
      assessmentPlural: 'grades',
      curriculum: 'curriculum',
      organization: 'school',
    },
    roles: [
      {
        id: 'student',
        name: 'student',
        displayName: 'Student',
        description: 'K-12 student',
        permissions: ['view_own_profile', 'view_lessons', 'submit_assignments'],
        hierarchy_level: 0,
        capabilities: ['learning', 'studying'],
      },
      {
        id: 'parent',
        name: 'parent',
        displayName: 'Parent',
        description: 'Parent or guardian',
        permissions: ['view_child_profile', 'message_teachers', 'view_reports'],
        hierarchy_level: 1,
        capabilities: ['messaging', 'monitoring'],
      },
      {
        id: 'teacher',
        name: 'teacher',
        displayName: 'Teacher',
        description: 'Classroom teacher',
        permissions: ['manage_class', 'grade_students', 'message_parents', 'create_lessons'],
        hierarchy_level: 2,
        capabilities: ['teaching', 'grading', 'planning', 'communication'],
      },
      {
        id: 'principal',
        name: 'principal',
        displayName: 'Principal',
        description: 'School principal',
        permissions: ['manage_school', 'view_all', 'manage_staff', 'reports'],
        hierarchy_level: 3,
        capabilities: ['management', 'analytics', 'administration'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      teacher: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'friendly',
        expertiseAreas: ['K-12 education', 'lesson planning', 'student assessment', 'curriculum'],
        proactiveBehaviors: ['suggest_improvements', 'remind_deadlines', 'recommend_resources'],
        taskCategories: ['teaching', 'planning', 'grading'],
      },
      principal: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['school administration', 'staff management', 'analytics', 'compliance'],
        proactiveBehaviors: ['monitor_metrics', 'suggest_strategies', 'track_goals'],
        taskCategories: ['management', 'strategic', 'operational'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#1976D2',
      icon: 'school',
      dashboardLayout: 'education',
    },
  },
  
  // TRAINING_CENTER, TUTORING_CENTER, and SKILLS_DEVELOPMENT kept for after-school/supplementary education support
  
  [OrganizationType.TRAINING_CENTER]: {
    type: OrganizationType.TRAINING_CENTER,
    displayName: 'Training Center',
    description: 'Professional training and certification center',
    terminology: {
      member: 'trainee',
      memberPlural: 'trainees',
      leader: 'instructor',
      leaderPlural: 'instructors',
      admin: 'center_admin',
      adminPlural: 'center_admins',
      group: 'cohort',
      groupPlural: 'cohorts',
      guardian: 'sponsor',
      guardianPlural: 'sponsors',
      activity: 'training',
      activityPlural: 'trainings',
      assessment: 'certification',
      assessmentPlural: 'certifications',
      curriculum: 'training_program',
      organization: 'center',
    },
    roles: [
      {
        id: 'trainee',
        name: 'trainee',
        displayName: 'Trainee',
        description: 'Training participant',
        permissions: ['view_own_profile', 'view_trainings', 'complete_certifications'],
        hierarchy_level: 0,
        capabilities: ['learning', 'certification'],
      },
      {
        id: 'instructor',
        name: 'instructor',
        displayName: 'Instructor',
        description: 'Training instructor',
        permissions: ['manage_cohorts', 'evaluate_trainees', 'issue_certificates'],
        hierarchy_level: 2,
        capabilities: ['teaching', 'evaluation', 'certification'],
      },
      {
        id: 'center_admin',
        name: 'center_admin',
        displayName: 'Center Admin',
        description: 'Center administrator',
        permissions: ['manage_center', 'view_all', 'manage_instructors'],
        hierarchy_level: 3,
        capabilities: ['management', 'operations'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      instructor: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['professional training', 'skill development', 'certification'],
        proactiveBehaviors: ['suggest_courses', 'track_progress', 'recommend_certifications'],
        taskCategories: ['training', 'assessment', 'certification'],
      },
      center_admin: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['center management', 'program scheduling', 'certification tracking'],
        proactiveBehaviors: ['monitor_enrollments', 'track_completions', 'suggest_programs'],
        taskCategories: ['management', 'operations', 'scheduling'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#F57C00',
      icon: 'school',
      dashboardLayout: 'education',
    },
  },
  
  [OrganizationType.TUTORING_CENTER]: {
    type: OrganizationType.TUTORING_CENTER,
    displayName: 'Tutoring Center',
    description: 'Academic tutoring and support center',
    terminology: {
      member: 'student',
      memberPlural: 'students',
      leader: 'tutor',
      leaderPlural: 'tutors',
      admin: 'center_director',
      adminPlural: 'center_directors',
      group: 'group',
      groupPlural: 'groups',
      guardian: 'parent',
      guardianPlural: 'parents',
      activity: 'session',
      activityPlural: 'sessions',
      assessment: 'progress_report',
      assessmentPlural: 'progress_reports',
      curriculum: 'learning_plan',
      organization: 'center',
    },
    roles: [
      {
        id: 'student',
        name: 'student',
        displayName: 'Student',
        description: 'Tutoring student',
        permissions: ['view_own_profile', 'view_sessions', 'track_progress'],
        hierarchy_level: 0,
        capabilities: ['learning', 'homework'],
      },
      {
        id: 'parent',
        name: 'parent',
        displayName: 'Parent',
        description: 'Student parent',
        permissions: ['view_child_profile', 'message_tutors', 'view_progress'],
        hierarchy_level: 1,
        capabilities: ['monitoring', 'communication'],
      },
      {
        id: 'tutor',
        name: 'tutor',
        displayName: 'Tutor',
        description: 'Subject tutor',
        permissions: ['manage_sessions', 'track_progress', 'message_parents'],
        hierarchy_level: 2,
        capabilities: ['tutoring', 'assessment', 'planning'],
      },
      {
        id: 'center_director',
        name: 'center_director',
        displayName: 'Center Director',
        description: 'Center director',
        permissions: ['manage_center', 'view_all', 'manage_tutors'],
        hierarchy_level: 3,
        capabilities: ['management', 'operations', 'scheduling'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      tutor: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'encouraging',
        expertiseAreas: ['academic tutoring', 'homework help', 'study skills', 'progress tracking'],
        proactiveBehaviors: ['suggest_topics', 'track_progress', 'remind_sessions'],
        taskCategories: ['tutoring', 'assessment', 'planning'],
      },
      center_director: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['center management', 'tutor scheduling', 'student progress'],
        proactiveBehaviors: ['monitor_attendance', 'track_progress', 'suggest_improvements'],
        taskCategories: ['management', 'operations', 'analytics'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: false,
    },
    ui: {
      primaryColor: '#00897B',
      icon: 'school',
      dashboardLayout: 'education',
    },
  },
  
  [OrganizationType.SKILLS_DEVELOPMENT]: {
    type: OrganizationType.SKILLS_DEVELOPMENT,
    displayName: 'Skills Development Centre',
    description: 'Skills development and vocational training for adults (18+)',
    terminology: {
      member: 'learner',
      memberPlural: 'learners',
      leader: 'facilitator',
      leaderPlural: 'facilitators',
      admin: 'centre_director',
      adminPlural: 'centre_directors',
      group: 'programme',
      groupPlural: 'programmes',
      guardian: 'sponsor',
      guardianPlural: 'sponsors',
      activity: 'workshop',
      activityPlural: 'workshops',
      assessment: 'competency_assessment',
      assessmentPlural: 'competency_assessments',
      curriculum: 'skills_programme',
      organization: 'skills_centre',
    },
    roles: [
      {
        id: 'learner',
        name: 'learner',
        displayName: 'Learner',
        description: 'Adult learner (18+ years) enrolled in skills programmes',
        permissions: ['view_own_profile', 'view_programmes', 'submit_assessments', 'track_progress', 'view_certificates'],
        hierarchy_level: 0,
        capabilities: ['learning', 'skills_development', 'portfolio_building', 'certification'],
      },
      {
        id: 'facilitator',
        name: 'facilitator',
        displayName: 'Facilitator',
        description: 'Skills programme facilitator or trainer',
        permissions: ['manage_programmes', 'assess_learners', 'issue_certificates', 'message_learners', 'track_attendance'],
        hierarchy_level: 2,
        capabilities: ['facilitation', 'assessment', 'mentoring', 'skills_transfer'],
      },
      {
        id: 'department_head',
        name: 'department_head',
        displayName: 'Department Head',
        description: 'Head of a skills department or category',
        permissions: ['manage_department', 'view_department_reports', 'manage_facilitators', 'approve_certificates'],
        hierarchy_level: 2,
        capabilities: ['department_management', 'quality_assurance', 'curriculum_oversight'],
      },
      {
        id: 'centre_director',
        name: 'centre_director',
        displayName: 'Centre Director',
        description: 'Skills development centre director/administrator',
        permissions: ['manage_centre', 'view_all', 'manage_staff', 'manage_accreditation', 'financial_reports'],
        hierarchy_level: 3,
        capabilities: ['centre_management', 'strategic_planning', 'accreditation', 'quality_management'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      learner: {
        greeting: "Hello I am Dash. How can I assist you with your skills development journey today?",
        tone: 'encouraging',
        expertiseAreas: ['career guidance', 'skills assessment', 'job readiness', 'portfolio development'],
        proactiveBehaviors: ['suggest_courses', 'track_progress', 'recommend_certifications', 'career_tips'],
        taskCategories: ['learning', 'career', 'certification'],
      },
      facilitator: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['adult learning', 'skills facilitation', 'competency assessment', 'workplace readiness'],
        proactiveBehaviors: ['suggest_activities', 'track_learner_progress', 'identify_gaps', 'recommend_interventions'],
        taskCategories: ['facilitation', 'assessment', 'mentoring'],
      },
      centre_director: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['SETA compliance', 'skills development', 'accreditation', 'centre management', 'quality assurance'],
        proactiveBehaviors: ['monitor_completion_rates', 'track_accreditation', 'suggest_improvements', 'forecast_demand'],
        taskCategories: ['management', 'compliance', 'strategic', 'quality'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#5C6BC0',
      icon: 'work',
      dashboardLayout: 'education',
    },
  },
};

/**
 * Helper function to get organization config by type
 */
export function getOrganizationConfig(type: OrganizationType): OrganizationConfig {
  return ORGANIZATION_CONFIGS[type];
}

/**
 * Helper function to get terminology for an organization
 */
export function getTerminology(type: OrganizationType): TerminologyMap {
  return ORGANIZATION_CONFIGS[type].terminology;
}

/**
 * Helper function to get roles for an organization type
 */
export function getRoles(type: OrganizationType): RoleDefinition[] {
  return ORGANIZATION_CONFIGS[type].roles;
}

/**
 * Helper function to get AI personality for a specific role in an organization
 */
export function getAIPersonality(
  type: OrganizationType,
  roleId: string
): AIPersonalityConfig | undefined {
  return ORGANIZATION_CONFIGS[type].aiPersonalities[roleId];
}

/**
 * Helper function to translate a generic term to organization-specific term
 */
export function translateTerm(
  type: OrganizationType,
  genericTerm: keyof TerminologyMap
): string {
  return ORGANIZATION_CONFIGS[type].terminology[genericTerm];
}
