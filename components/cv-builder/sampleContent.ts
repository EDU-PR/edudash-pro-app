/**
 * Sample CV Content Templates
 * Pre-filled content for different career types
 */
import { CVSection } from './types';

export type ContentTemplate = 'blank' | 'student' | 'professional' | 'creative' | 'technical' | 'teacher';

export interface ContentTemplateConfig {
  id: ContentTemplate;
  name: string;
  description: string;
  icon: string;
  sections: CVSection[];
}

export const CONTENT_TEMPLATES: Record<ContentTemplate, ContentTemplateConfig> = {
  blank: {
    id: 'blank',
    name: 'Start Fresh',
    description: 'Empty template to build from scratch',
    icon: 'document-outline',
    sections: [
      { id: '1', type: 'personal', title: 'Personal Information', data: {} },
    ],
  },
  
  student: {
    id: 'student',
    name: 'Student / Graduate',
    description: 'Perfect for learners and recent graduates',
    icon: 'school-outline',
    sections: [
      {
        id: '1',
        type: 'personal',
        title: 'Personal Information',
        data: {
          fullName: '',
          jobTitle: 'Student / Recent Graduate',
          email: '',
          phone: '',
          address: '',
          summary: 'Motivated and eager learner with a passion for growth and development. Currently pursuing studies with a focus on practical skills and real-world application. Strong team player with excellent communication abilities.',
        },
      },
      {
        id: '2',
        type: 'education',
        title: 'Education',
        data: {
          items: [
            {
              institution: 'Your School/University Name',
              degree: 'Your Qualification',
              field: 'Field of Study',
              startDate: '2022',
              endDate: '2025',
              gpa: '',
              achievements: 'Key achievements, awards, or relevant coursework',
            },
          ],
        },
      },
      {
        id: '3',
        type: 'skills',
        title: 'Skills',
        data: {
          skills: [
            { name: 'Communication', level: 4, category: 'Soft Skills' },
            { name: 'Teamwork', level: 4, category: 'Soft Skills' },
            { name: 'Problem Solving', level: 3, category: 'Soft Skills' },
            { name: 'Microsoft Office', level: 4, category: 'Technical' },
            { name: 'Time Management', level: 4, category: 'Soft Skills' },
          ],
        },
      },
      {
        id: '4',
        type: 'achievements',
        title: 'Achievements & Activities',
        data: {
          items: [
            {
              title: 'Academic Achievement',
              description: 'Describe any awards, honors, or recognition received',
              date: '2024',
            },
            {
              title: 'Extracurricular Activity',
              description: 'Sports, clubs, community involvement, or leadership roles',
              date: '2023-2024',
            },
          ],
        },
      },
      {
        id: '5',
        type: 'volunteer',
        title: 'Volunteer Experience',
        data: {
          items: [
            {
              role: 'Volunteer Position',
              organization: 'Organization Name',
              description: 'Describe your volunteer work and impact',
              startDate: '2023',
              endDate: 'Present',
            },
          ],
        },
      },
      {
        id: '6',
        type: 'references',
        title: 'References',
        data: {
          items: [
            {
              name: 'Teacher/Mentor Name',
              position: 'Title',
              company: 'School/Organization',
              email: 'email@example.com',
              phone: '',
            },
          ],
        },
      },
    ],
  },

  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'For experienced professionals',
    icon: 'briefcase-outline',
    sections: [
      {
        id: '1',
        type: 'personal',
        title: 'Personal Information',
        data: {
          fullName: '',
          jobTitle: 'Professional Title',
          email: '',
          phone: '',
          address: '',
          linkedin: '',
          summary: 'Results-driven professional with X+ years of experience in [industry]. Proven track record of delivering impactful solutions and driving business growth. Strong leadership abilities with expertise in team management and strategic planning.',
        },
      },
      {
        id: '2',
        type: 'experience',
        title: 'Work Experience',
        data: {
          items: [
            {
              position: 'Senior Position Title',
              company: 'Company Name',
              startDate: '2021',
              endDate: 'Present',
              current: true,
              description: 'Brief overview of your role and responsibilities',
              achievements: [
                'Led team of X members to achieve Y% improvement in Z',
                'Implemented new processes resulting in cost savings of R X',
                'Managed projects worth R X million',
              ],
            },
            {
              position: 'Previous Position',
              company: 'Previous Company',
              startDate: '2018',
              endDate: '2021',
              description: 'Overview of previous role',
              achievements: [
                'Key achievement demonstrating your impact',
                'Another significant accomplishment',
              ],
            },
          ],
        },
      },
      {
        id: '3',
        type: 'education',
        title: 'Education',
        data: {
          items: [
            {
              institution: 'University Name',
              degree: 'Degree Type',
              field: 'Field of Study',
              startDate: '2014',
              endDate: '2018',
            },
          ],
        },
      },
      {
        id: '4',
        type: 'skills',
        title: 'Skills',
        data: {
          skills: [
            { name: 'Leadership', level: 5, category: 'Management' },
            { name: 'Strategic Planning', level: 4, category: 'Management' },
            { name: 'Project Management', level: 5, category: 'Management' },
            { name: 'Budget Management', level: 4, category: 'Finance' },
            { name: 'Team Building', level: 5, category: 'Leadership' },
            { name: 'Stakeholder Management', level: 4, category: 'Communication' },
          ],
        },
      },
      {
        id: '5',
        type: 'certifications',
        title: 'Certifications',
        data: {
          items: [
            {
              name: 'Professional Certification',
              issuer: 'Certifying Body',
              date: '2022',
              credentialId: '',
            },
          ],
        },
      },
      {
        id: '6',
        type: 'references',
        title: 'References',
        data: {
          items: [
            {
              name: 'Reference Name',
              position: 'Title',
              company: 'Company',
              email: 'email@company.com',
              phone: '',
            },
          ],
        },
      },
    ],
  },

  creative: {
    id: 'creative',
    name: 'Creative',
    description: 'For designers, artists, and creatives',
    icon: 'color-palette-outline',
    sections: [
      {
        id: '1',
        type: 'personal',
        title: 'Personal Information',
        data: {
          fullName: '',
          jobTitle: 'Creative Professional',
          email: '',
          phone: '',
          website: '',
          summary: 'Innovative creative professional with a passion for visual storytelling and brand development. Combining artistic vision with strategic thinking to create impactful designs that resonate with audiences.',
        },
      },
      {
        id: '2',
        type: 'experience',
        title: 'Creative Experience',
        data: {
          items: [
            {
              position: 'Creative Role',
              company: 'Agency/Company Name',
              startDate: '2020',
              endDate: 'Present',
              current: true,
              description: 'Led creative direction for major brand campaigns',
              achievements: [
                'Designed award-winning campaign reaching X million viewers',
                'Increased client engagement by X% through innovative designs',
                'Managed creative projects from concept to completion',
              ],
            },
          ],
        },
      },
      {
        id: '3',
        type: 'projects',
        title: 'Portfolio Projects',
        data: {
          items: [
            {
              name: 'Featured Project Name',
              description: 'Description of the project, your role, and the impact',
              technologies: ['Design Tool', 'Another Tool'],
              link: 'portfolio-link.com',
            },
            {
              name: 'Another Project',
              description: 'Brief description of another significant project',
              technologies: ['Relevant Tools'],
              link: '',
            },
          ],
        },
      },
      {
        id: '4',
        type: 'skills',
        title: 'Creative Skills',
        data: {
          skills: [
            { name: 'Adobe Creative Suite', level: 5, category: 'Design Tools' },
            { name: 'UI/UX Design', level: 4, category: 'Design' },
            { name: 'Brand Identity', level: 5, category: 'Design' },
            { name: 'Typography', level: 4, category: 'Design' },
            { name: 'Motion Graphics', level: 3, category: 'Animation' },
            { name: 'Photography', level: 4, category: 'Visual Arts' },
          ],
        },
      },
      {
        id: '5',
        type: 'education',
        title: 'Education',
        data: {
          items: [
            {
              institution: 'Design School/University',
              degree: 'Degree in Design/Arts',
              field: 'Graphic Design / Fine Arts',
              startDate: '2016',
              endDate: '2020',
            },
          ],
        },
      },
      {
        id: '6',
        type: 'achievements',
        title: 'Awards & Recognition',
        data: {
          items: [
            {
              title: 'Design Award',
              description: 'Recognition for outstanding creative work',
              date: '2023',
            },
          ],
        },
      },
    ],
  },

  technical: {
    id: 'technical',
    name: 'Technical / IT',
    description: 'For developers, engineers, and tech professionals',
    icon: 'code-slash-outline',
    sections: [
      {
        id: '1',
        type: 'personal',
        title: 'Personal Information',
        data: {
          fullName: '',
          jobTitle: 'Software Developer / Engineer',
          email: '',
          phone: '',
          linkedin: '',
          website: 'github.com/username',
          summary: 'Passionate software developer with expertise in building scalable applications. Strong problem-solving skills with experience in full-stack development. Committed to writing clean, maintainable code and continuous learning.',
        },
      },
      {
        id: '2',
        type: 'experience',
        title: 'Work Experience',
        data: {
          items: [
            {
              position: 'Software Developer',
              company: 'Tech Company',
              startDate: '2021',
              endDate: 'Present',
              current: true,
              description: 'Full-stack development of web and mobile applications',
              achievements: [
                'Developed features used by X+ users daily',
                'Reduced application load time by X%',
                'Implemented CI/CD pipeline improving deployment efficiency',
              ],
            },
          ],
        },
      },
      {
        id: '3',
        type: 'skills',
        title: 'Technical Skills',
        data: {
          skills: [
            { name: 'JavaScript/TypeScript', level: 5, category: 'Languages' },
            { name: 'React / React Native', level: 5, category: 'Frameworks' },
            { name: 'Node.js', level: 4, category: 'Backend' },
            { name: 'Python', level: 4, category: 'Languages' },
            { name: 'SQL / PostgreSQL', level: 4, category: 'Database' },
            { name: 'Git', level: 5, category: 'Tools' },
            { name: 'AWS / Cloud', level: 3, category: 'Infrastructure' },
            { name: 'Docker', level: 3, category: 'DevOps' },
          ],
        },
      },
      {
        id: '4',
        type: 'projects',
        title: 'Projects',
        data: {
          items: [
            {
              name: 'Project Name',
              description: 'Description of the project and your contributions',
              technologies: ['React', 'Node.js', 'PostgreSQL'],
              link: 'github.com/project',
            },
            {
              name: 'Open Source Contribution',
              description: 'Contributions to open source projects',
              technologies: ['Technology Used'],
              link: '',
            },
          ],
        },
      },
      {
        id: '5',
        type: 'education',
        title: 'Education',
        data: {
          items: [
            {
              institution: 'University / Bootcamp',
              degree: 'Degree / Certificate',
              field: 'Computer Science / Software Engineering',
              startDate: '2017',
              endDate: '2021',
            },
          ],
        },
      },
      {
        id: '6',
        type: 'certifications',
        title: 'Certifications',
        data: {
          items: [
            {
              name: 'AWS Certified Developer',
              issuer: 'Amazon Web Services',
              date: '2023',
              credentialId: '',
            },
          ],
        },
      },
    ],
  },

  teacher: {
    id: 'teacher',
    name: 'Educator / Teacher',
    description: 'For teachers and educational professionals',
    icon: 'school-outline',
    sections: [
      {
        id: '1',
        type: 'personal',
        title: 'Personal Information',
        data: {
          fullName: '',
          jobTitle: 'Educator / Teacher',
          email: '',
          phone: '',
          address: '',
          summary: 'Dedicated educator with a passion for student development and innovative teaching methods. Experienced in creating engaging learning environments and adapting curriculum to meet diverse student needs. Committed to fostering critical thinking and lifelong learning.',
        },
      },
      {
        id: '2',
        type: 'experience',
        title: 'Teaching Experience',
        data: {
          items: [
            {
              position: 'Teacher / Educator',
              company: 'School Name',
              startDate: '2019',
              endDate: 'Present',
              current: true,
              description: 'Teaching [Subject/Grade Level] to classes of X students',
              achievements: [
                'Improved student pass rates by X%',
                'Developed new curriculum materials adopted school-wide',
                'Mentored X student teachers',
                'Led extracurricular activities and clubs',
              ],
            },
          ],
        },
      },
      {
        id: '3',
        type: 'education',
        title: 'Education & Qualifications',
        data: {
          items: [
            {
              institution: 'University Name',
              degree: 'Bachelor of Education / PGCE',
              field: 'Education / Subject Specialization',
              startDate: '2015',
              endDate: '2019',
            },
          ],
        },
      },
      {
        id: '4',
        type: 'certifications',
        title: 'Teaching Certifications',
        data: {
          items: [
            {
              name: 'SACE Registration',
              issuer: 'South African Council for Educators',
              date: '2019',
              credentialId: '',
            },
            {
              name: 'First Aid Certificate',
              issuer: 'Red Cross / St John',
              date: '2023',
              credentialId: '',
            },
          ],
        },
      },
      {
        id: '5',
        type: 'skills',
        title: 'Teaching Skills',
        data: {
          skills: [
            { name: 'Curriculum Development', level: 5, category: 'Teaching' },
            { name: 'Classroom Management', level: 5, category: 'Teaching' },
            { name: 'Student Assessment', level: 4, category: 'Teaching' },
            { name: 'Educational Technology', level: 4, category: 'Technology' },
            { name: 'Differentiated Instruction', level: 4, category: 'Teaching' },
            { name: 'Parent Communication', level: 5, category: 'Communication' },
          ],
        },
      },
      {
        id: '6',
        type: 'achievements',
        title: 'Professional Development',
        data: {
          items: [
            {
              title: 'Workshop / Training',
              description: 'Professional development courses completed',
              date: '2023',
            },
            {
              title: 'Teaching Award',
              description: 'Recognition for teaching excellence',
              date: '2022',
            },
          ],
        },
      },
      {
        id: '7',
        type: 'references',
        title: 'References',
        data: {
          items: [
            {
              name: 'Principal / HOD Name',
              position: 'Principal / Head of Department',
              company: 'School Name',
              email: 'email@school.edu',
              phone: '',
            },
          ],
        },
      },
    ],
  },
};

export function getContentTemplate(templateId: ContentTemplate): CVSection[] {
  return JSON.parse(JSON.stringify(CONTENT_TEMPLATES[templateId].sections));
}
