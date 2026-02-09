/**
 * Student Fees hook orchestrator.
 * Composes useStudentFeeData + useStudentFeeActions into a single API.
 */

export { useStudentFeeData } from './useStudentFeeData';
export { useStudentFeeActions } from './useStudentFeeActions';
export type { StudentFeeDataReturn } from './useStudentFeeData';
export type { StudentFeeActionsReturn } from './useStudentFeeActions';
export type { Student, StudentFee, ClassOption, ModalType, AlertState, ParentProfileRow } from './types';
export { isRegistrationFeeEntry } from './types';
export { formatCurrency, formatDate, getEnrollmentMonthStart } from './feeHelpers';
export type { FeeSetupStatus } from './feeHelpers';
