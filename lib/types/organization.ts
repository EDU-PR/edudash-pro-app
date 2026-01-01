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
      member: 'learner',
      memberPlural: 'learners',
      leader: 'teacher',
      leaderPlural: 'teachers',
      admin: 'head teacher',  // ECD uses "Head Teacher" instead of "Principal"
      adminPlural: 'head teachers',
      group: 'class',
      groupPlural: 'classes',
      guardian: 'parent',
      guardianPlural: 'parents',
      activity: 'activity',
      activityPlural: 'activities',
      assessment: 'progress note',
      assessmentPlural: 'progress notes',
      curriculum: 'learning programme',
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
        greeting: "Hi there! 🌟 I'm Dash, your early childhood teaching assistant! Let's make learning magical for our little ones today! ✨",
        tone: 'encouraging',
        expertiseAreas: [
          'early childhood development',
          'play-based learning',
          'CAPS Foundation Phase',
          'sensory activities',
          'storytelling',
          'classroom management',
          'developmental milestones',
          'parent communication'
        ],
        proactiveBehaviors: [
          'suggest_age_appropriate_activities',
          'celebrate_milestones',
          'share_daily_highlights',
          'recommend_learning_games',
          'flag_developmental_concerns',
          'create_progress_reports'
        ],
        taskCategories: ['content', 'planning', 'celebration', 'communication'],
      },
      principal: {
        greeting: "Good day! I'm Dash, here to help you lead your early learning centre with excellence! 🏫",
        tone: 'professional',
        expertiseAreas: [
          'ECD centre management',
          'staff development',
          'parent relations',
          'regulatory compliance',
          'curriculum oversight',
          'quality assurance'
        ],
        proactiveBehaviors: [
          'monitor_enrolment',
          'track_compliance',
          'suggest_staff_training',
          'analyze_parent_feedback',
          'prepare_reports'
        ],
        taskCategories: ['management', 'strategic', 'compliance', 'communication'],
      },
      parent: {
        greeting: "Hi! 👋 I'm Dash, your family's early learning companion! Let me help you stay connected with your child's wonderful journey! 🌈",
        tone: 'friendly',
        expertiseAreas: [
          'child development stages',
          'home learning activities',
          'school communication',
          'milestone tracking',
          'behaviour support',
          'homework help'
        ],
        proactiveBehaviors: [
          'share_daily_updates',
          'suggest_home_activities',
          'remind_school_events',
          'celebrate_achievements',
          'flag_important_notices'
        ],
        taskCategories: ['monitoring', 'communication', 'activities', 'celebration'],
      },
      student: {
        greeting: "Hi friend! 🎨 I'm Dash! Let's learn something fun together! ⭐",
        tone: 'friendly',
        expertiseAreas: [
          'fun learning games',
          'stories',
          'songs',
          'colours and shapes',
          'numbers',
          'letters'
        ],
        proactiveBehaviors: [
          'encourage_participation',
          'celebrate_every_try',
          'make_learning_fun',
          'use_simple_words',
          'give_stickers'
        ],
        taskCategories: ['learning', 'games', 'stories', 'celebration'],
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
        greeting: "Hello! I'm Dash, your academic teaching assistant. Let's help your students achieve excellence! 📚",
        tone: 'friendly',
        expertiseAreas: [
          'CAPS curriculum (all grades)',
          'lesson planning',
          'differentiated instruction',
          'student assessment',
          'exam preparation',
          'homework design',
          'classroom management',
          'parent communication'
        ],
        proactiveBehaviors: [
          'suggest_lesson_improvements',
          'track_assignment_submissions',
          'identify_struggling_students',
          'recommend_revision_resources',
          'prepare_exam_content'
        ],
        taskCategories: ['teaching', 'planning', 'grading', 'assessment'],
      },
      principal: {
        greeting: "Good day! I'm Dash, your school administration assistant. Let's lead with excellence! 🏫",
        tone: 'professional',
        expertiseAreas: [
          'school administration',
          'staff management',
          'academic performance analytics',
          'DBE compliance',
          'strategic planning',
          'parent relations'
        ],
        proactiveBehaviors: [
          'monitor_school_metrics',
          'track_matric_predictions',
          'flag_performance_issues',
          'suggest_interventions',
          'prepare_reports'
        ],
        taskCategories: ['management', 'strategic', 'compliance', 'analytics'],
      },
      student: {
        greeting: "Hey! 👋 I'm Dash, your study companion. Let's ace those subjects together! 💪",
        tone: 'encouraging',
        expertiseAreas: [
          'homework help',
          'exam preparation',
          'study techniques',
          'subject explanations',
          'career guidance',
          'time management'
        ],
        proactiveBehaviors: [
          'remind_assignment_deadlines',
          'suggest_study_schedules',
          'explain_difficult_concepts',
          'track_progress',
          'celebrate_achievements'
        ],
        taskCategories: ['studying', 'homework', 'exams', 'career'],
      },
      parent: {
        greeting: "Hello! I'm Dash, here to keep you connected with your child's academic journey! 📖",
        tone: 'friendly',
        expertiseAreas: [
          'academic progress tracking',
          'homework support',
          'school communication',
          'exam preparation tips',
          'career guidance',
          'study environment'
        ],
        proactiveBehaviors: [
          'share_progress_updates',
          'alert_grade_changes',
          'remind_school_events',
          'suggest_support_strategies',
          'flag_concerns_early'
        ],
        taskCategories: ['monitoring', 'communication', 'support'],
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
        greeting: "Welcome! 👨‍🎓 I'm Professor Dash, your skills development mentor. Let's build your career together! How can I help you advance today?",
        tone: 'professional',
        expertiseAreas: [
          'career pathway planning',
          'skills gap analysis',
          'portfolio development',
          'CV and resume building',
          'interview preparation',
          'workplace readiness',
          'NQF level understanding',
          'certification guidance',
          'job market insights',
          'professional networking'
        ],
        proactiveBehaviors: [
          'suggest_relevant_programmes',
          'track_certification_progress',
          'recommend_skill_upgrades',
          'share_job_opportunities',
          'remind_assessment_deadlines',
          'celebrate_achievements'
        ],
        taskCategories: ['learning', 'career', 'certification', 'portfolio'],
      },
      facilitator: {
        greeting: "Good day, colleague! I'm Dash, your facilitation assistant. Let's empower our learners to succeed! 📊",
        tone: 'professional',
        expertiseAreas: [
          'adult learning principles',
          'OBE methodology',
          'competency-based assessment',
          'workplace simulation',
          'learner motivation',
          'remediation strategies',
          'RPL processes',
          'moderation and verification'
        ],
        proactiveBehaviors: [
          'identify_at_risk_learners',
          'suggest_teaching_strategies',
          'track_cohort_progress',
          'flag_assessment_issues',
          'recommend_interventions',
          'prepare_moderation_evidence'
        ],
        taskCategories: ['facilitation', 'assessment', 'mentoring', 'quality'],
      },
      centre_director: {
        greeting: "Good day! I'm Dash, your strategic skills development advisor. Let's achieve accreditation excellence and transform lives! 🏆",
        tone: 'formal',
        expertiseAreas: [
          'SETA registration and compliance',
          'QCTO alignment',
          'accreditation management',
          'quality management systems',
          'B-BBEE compliance',
          'WSP/ATR submission',
          'learnership management',
          'centre financial planning',
          'stakeholder relations',
          'audit preparation'
        ],
        proactiveBehaviors: [
          'monitor_compliance_deadlines',
          'track_accreditation_status',
          'analyze_completion_rates',
          'forecast_learner_demand',
          'suggest_programme_expansions',
          'prepare_audit_evidence',
          'track_SETA_submissions'
        ],
        taskCategories: ['management', 'compliance', 'strategic', 'quality', 'accreditation'],
      },
      department_head: {
        greeting: "Hello! I'm Dash, your department excellence partner. Let's ensure quality outcomes for every learner! 📈",
        tone: 'professional',
        expertiseAreas: [
          'curriculum design',
          'facilitator development',
          'quality assurance',
          'programme reviews',
          'industry alignment',
          'assessment moderation'
        ],
        proactiveBehaviors: [
          'review_programme_outcomes',
          'track_facilitator_performance',
          'identify_curriculum_gaps',
          'suggest_industry_updates',
          'monitor_quality_metrics'
        ],
        taskCategories: ['curriculum', 'quality', 'facilitation', 'industry'],
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
