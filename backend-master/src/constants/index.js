/**
 * Shared constants for the application
 * Centralized status codes, limits, and other constants used across services
 */

// ============================================================================
// STATUS CODES
// ============================================================================

/**
 * Timesheet status codes (tmst_status_timesheet)
 */
export const TIMESHEET_STATUS = {
    APPROVED: 1,
    REJECTED: 2,
    REVISION_REQUIRED: 3,
    WAITING_FOR_APPROVAL: 4,
    REVISED: 5,
    COMPLETED: 6,
    // Alias for backward compatibility - IN_PROCESS is same as WAITING_FOR_APPROVAL
    IN_PROCESS: 4,
};

/**
 * Payment status codes (tmst_status_pembayaran)
 */
export const PAYMENT_STATUS = {
    WAITING_APPROVAL: 1,
    COMPLETE: 2,
    APPROVED: 3,
    ON_REVISION: 4,
    REVISED: 5,
};

/**
 * Master Project status codes (tmst_status_master_project)
 */
export const MASTER_PROJECT_STATUS = {
    DRAFT: 1,
    OPEN: 2,
    WAITING_TIMESHEET_APPROVAL: 3,
    WAITING_PROJECT_APPROVAL: 4,
    PROJECT_APPROVED: 5,
    COMPLETED: 6,
    NEED_REVISION: 7,
};

/**
 * Project status strings (used in tmst_project.status column)  
 * These match the 'status' column in tmst_status_master_project table
 */
export const PROJECT_STATUS = {
    DRAFT: "Draft",
    OPEN: "Open",
    WAITING_TIMESHEET_APPROVAL: "Waiting Timesheet Approval",
    WAITING_PROJECT_APPROVAL: "Waiting Project Approval",
    PROJECT_APPROVED: "Project Approved",
    COMPLETED: "Completed",
    NEED_REVISION: "Need Revision",
};

/**
 * Tran Project status codes (tmst_status_project)
 * Note: Currently not actively used - tran_project.id_status is always 1
 */
export const TRAN_PROJECT_STATUS = {
    DRAFT: 1,
    SUBMITTED: 2,
    NEED_REVISION: 3,
    PAID: 4,
};

/**
 * Student Timesheet status (tmst_status_student_timesheet)
 */
export const STUDENT_TIMESHEET_STATUS = {
    APPROVED: 1,
    REVISION: 2,
    SUBMITTED: 3,
    REVISED: 4,
    NOT_SUBMITTED: 5,
};

/**
 * Combined STATUS object for backward compatibility
 */
export const STATUS = {
    TIMESHEET: TIMESHEET_STATUS,
    PAYMENT: PAYMENT_STATUS,
    MASTER_PROJECT: MASTER_PROJECT_STATUS,
    PROJECT: PROJECT_STATUS,
    TRAN_PROJECT: TRAN_PROJECT_STATUS,
    STUDENT_TIMESHEET: STUDENT_TIMESHEET_STATUS,
};

/**
 * Master Project Status ID to string mapping (tmst_status_master_project)
 */
export const MASTER_PROJECT_STATUS_MAP = {
    1: "Draft",
    2: "Open",
    3: "Waiting Timesheet Approval",
    4: "Waiting Project Approval",
    5: "Project Approved",
    6: "Completed",
    7: "Need Revision",
};

/**
 * Tran Project Status ID to string mapping (tmst_status_project)
 */
export const TRAN_PROJECT_STATUS_MAP = {
    1: "Draft",
    2: "Submitted",
    3: "Need Revision",
    4: "Paid",
};

// Legacy alias for backward compatibility
export const STATUS_MAP = TRAN_PROJECT_STATUS_MAP;

// ============================================================================
// LIMITS
// ============================================================================

/**
 * Time limits for timesheet entries (in hours)
 */
export const LIMITS = {
    DAILY_HOURS: 4,
    WEEKLY_HOURS: 15,
    MONTHLY_HOURS: 40,
};

// ============================================================================
// SATUAN (Unit Types)
// ============================================================================

/**
 * Insentif unit types (tmst_satuan_insentif)
 */
export const SATUAN = {
    WAKTU: 1,    // Time-based (per minute)
    KARYA: 2,    // Piece-based (per work/output)
};


export default {
    STATUS,
    TIMESHEET_STATUS,
    PAYMENT_STATUS,
    MASTER_PROJECT_STATUS,
    MASTER_PROJECT_STATUS_MAP,
    PROJECT_STATUS,
    TRAN_PROJECT_STATUS,
    TRAN_PROJECT_STATUS_MAP,
    STUDENT_TIMESHEET_STATUS,
    STATUS_MAP,
    LIMITS,
    SATUAN,
};
