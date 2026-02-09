// Types and constants for student-enrollment screen

export interface Grade {
  id: string;
  name: string;
  capacity: number;
  enrolled: number;
  available: number;
  fees: {
    admission: number;
    tuition: number;
    books: number;
    uniform: number;
    activities: number;
  };
}

export interface StudentInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | '';
  idNumber: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  parentFirstName: string;
  parentLastName: string;
  parentPhone: string;
  parentEmail: string;
  parentIdNumber: string;
  relationship: 'mother' | 'father' | 'guardian' | '';
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  allergies: string;
  medicalConditions: string;
  medications: string;
  doctorName: string;
  doctorPhone: string;
  previousSchool: string;
  previousGrade: string;
  reasonForLeaving: string;
  specialRequirements: string;
  transportNeeds: 'none' | 'school_bus' | 'private' | '';
}

export type EnrollmentStep = 'basic' | 'contact' | 'parent' | 'medical' | 'documents' | 'fees' | 'review';

export const initialStudentInfo: StudentInfo = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  idNumber: '',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  email: '',
  parentFirstName: '',
  parentLastName: '',
  parentPhone: '',
  parentEmail: '',
  parentIdNumber: '',
  relationship: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  allergies: '',
  medicalConditions: '',
  medications: '',
  doctorName: '',
  doctorPhone: '',
  previousSchool: '',
  previousGrade: '',
  reasonForLeaving: '',
  specialRequirements: '',
  transportNeeds: '',
};

export const PRESCHOOL_GRADES: Grade[] = [
  {
    id: 'baby-class', name: 'Baby Class (6-12 months)', capacity: 8, enrolled: 6, available: 2,
    fees: { admission: 300, tuition: 1800, books: 150, uniform: 200, activities: 100 },
  },
  {
    id: 'toddler-class', name: 'Toddler Class (1-2 years)', capacity: 12, enrolled: 10, available: 2,
    fees: { admission: 350, tuition: 2000, books: 200, uniform: 220, activities: 120 },
  },
  {
    id: 'pre-k', name: 'Pre-K (3-4 years)', capacity: 15, enrolled: 14, available: 1,
    fees: { admission: 400, tuition: 2200, books: 250, uniform: 250, activities: 150 },
  },
  {
    id: 'kindergarten', name: 'Kindergarten (4-5 years)', capacity: 18, enrolled: 16, available: 2,
    fees: { admission: 450, tuition: 2400, books: 300, uniform: 280, activities: 170 },
  },
];

export const K12_GRADES: Grade[] = [
  { id: 'grade-r', name: 'Grade R (5-6 years)', capacity: 30, enrolled: 28, available: 2, fees: { admission: 500, tuition: 2800, books: 450, uniform: 300, activities: 200 } },
  { id: 'grade-1', name: 'Grade 1', capacity: 30, enrolled: 25, available: 5, fees: { admission: 500, tuition: 3200, books: 520, uniform: 350, activities: 250 } },
  { id: 'grade-2', name: 'Grade 2', capacity: 30, enrolled: 30, available: 0, fees: { admission: 500, tuition: 3200, books: 520, uniform: 350, activities: 250 } },
  { id: 'grade-3', name: 'Grade 3', capacity: 30, enrolled: 27, available: 3, fees: { admission: 500, tuition: 3500, books: 580, uniform: 380, activities: 300 } },
  { id: 'grade-4', name: 'Grade 4', capacity: 30, enrolled: 24, available: 6, fees: { admission: 500, tuition: 3500, books: 580, uniform: 380, activities: 300 } },
  { id: 'grade-5', name: 'Grade 5', capacity: 30, enrolled: 29, available: 1, fees: { admission: 500, tuition: 3800, books: 620, uniform: 400, activities: 350 } },
  { id: 'grade-6', name: 'Grade 6', capacity: 30, enrolled: 26, available: 4, fees: { admission: 500, tuition: 3800, books: 620, uniform: 400, activities: 350 } },
  { id: 'grade-7', name: 'Grade 7', capacity: 30, enrolled: 23, available: 7, fees: { admission: 500, tuition: 4200, books: 720, uniform: 450, activities: 400 } },
  { id: 'grade-8', name: 'Grade 8', capacity: 30, enrolled: 28, available: 2, fees: { admission: 500, tuition: 4200, books: 720, uniform: 450, activities: 400 } },
  { id: 'grade-9', name: 'Grade 9', capacity: 30, enrolled: 25, available: 5, fees: { admission: 600, tuition: 4500, books: 800, uniform: 500, activities: 450 } },
  { id: 'grade-10', name: 'Grade 10', capacity: 30, enrolled: 27, available: 3, fees: { admission: 600, tuition: 4500, books: 800, uniform: 500, activities: 450 } },
  { id: 'grade-11', name: 'Grade 11', capacity: 30, enrolled: 22, available: 8, fees: { admission: 600, tuition: 4800, books: 850, uniform: 520, activities: 480 } },
  { id: 'grade-12', name: 'Grade 12', capacity: 30, enrolled: 24, available: 6, fees: { admission: 600, tuition: 4800, books: 850, uniform: 520, activities: 480 } },
];

export const STEP_ORDER: EnrollmentStep[] = ['basic', 'contact', 'parent', 'medical', 'documents', 'fees', 'review'];
