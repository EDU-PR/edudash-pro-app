# SOA Organizational Structure

## Overview

Soil of Africa (SOA) is structured as a hierarchical organization with a **Main Structure** and three **Sub-Structures** (Wings):

1. **Main Structure** - Core organization leadership
2. **Youth Wing** - Members aged 18-35
3. **Women's League** - Female members support structure
4. **Veterans League** - Senior/retired members (future)

---

## 1. Organizational Hierarchy

### Main Structure Hierarchy

```
National President (national_admin)
├── Deputy President
├── Secretary General
├── Treasurer General
│
├── Regional Managers (×9 provinces)
│   ├── Provincial Staff (admin, staff)
│   ├── Facilitators (facilitator)
│   ├── Mentors (mentor)
│   └── Learners (learner)
│
├── Youth Wing President
│   └── [See Youth Wing Structure]
│
├── Women's League President
│   └── [See Women's League Structure]
│
└── Veterans League President
    └── [See Veterans Structure]
```

### Youth Wing Structure

```
Youth President (youth_president)
├── Youth Deputy President (youth_deputy)
├── Youth Secretary (youth_secretary)
├── Youth Treasurer (youth_treasurer)
│
└── Provincial Youth Coordinators (youth_coordinator) - ×9
    ├── Youth Facilitators (youth_facilitator)
    ├── Youth Mentors (youth_mentor)
    └── Youth Members (youth_member)
```

**Age Requirement:** 18-35 years old

### Women's League Structure

```
Women's President (women_president)
├── Women's Deputy (women_deputy)
├── Women's Secretary (women_secretary)
├── Women's Treasurer (women_treasurer)
│
└── Provincial Coordinators (women_coordinator) - ×9
    ├── Women's Facilitators (women_facilitator)
    ├── Women's Mentors (women_mentor)
    └── Women's Members (women_member)
```

### Veterans League Structure (Future)

```
Veterans President (veterans_president)
└── Provincial Coordinators (veterans_coordinator)
    └── Veterans Members (veterans_member)
```

---

## 2. Appointment Authority Matrix

| Role | Can Appoint |
|------|-------------|
| **National Admin** | ALL roles in ALL wings |
| **Regional Manager** | Facilitators, Mentors, Learners (own region, main structure) |
| **Youth President** | Youth Deputy, Secretary, Treasurer, Coordinators, Facilitators, Mentors, Members |
| **Youth Deputy** | Youth Coordinators, Facilitators, Mentors, Members |
| **Youth Coordinator** | Youth Facilitators, Mentors, Members (own province) |
| **Women's President** | Women's Deputy, Secretary, Treasurer, Coordinators, Facilitators, Mentors, Members |
| **Women's Deputy** | Women's Coordinators, Facilitators, Mentors, Members |
| **Women's Coordinator** | Women's Facilitators, Mentors, Members (own province) |
| **Veterans President** | Veterans Coordinators, Members |
| **Veterans Coordinator** | Veterans Members (own province) |

**Note:** Wing Presidents are appointed by the National President only.

---

## 3. Financial Structure

### Banking Account Hierarchy

```
SOA Main Operating Account (National)
├── Membership Fees Account
│   └── All membership payments deposited here
│
├── Programmes Account
│   └── SETA funding and programme income
│
├── Regional Float Accounts (×9)
│   └── Each province: R10,000 - R50,000 float
│
├── Youth Wing Account
│   └── Youth-specific activities and programmes
│
├── Women's League Account
│   └── Women's activities and programmes
│
└── Petty Cash Floats (Optional)
    └── Cash for small operational expenses
```

### Account Types

| Account Type | Purpose | Typical Float/Budget |
|-------------|---------|---------------------|
| `main_operating` | Primary operational expenses | N/A (main) |
| `membership_fees` | Collection of all fees | N/A (collection) |
| `programmes` | SETA and programme funding | As funded |
| `regional_float` | Provincial operations | R10,000 - R50,000 |
| `youth_wing` | Youth activities | Annual allocation |
| `women_league` | Women's activities | Annual allocation |
| `petty_cash` | Small cash expenses | R3,000 - R5,000 |

### Spending Limits

| Role | Single Transaction Limit |
|------|-------------------------|
| National Admin | R100,000 |
| Admin | R10,000 |
| Regional Manager | R5,000 |
| Youth President | R5,000 |
| Youth Deputy | R3,000 |
| Youth Treasurer | R2,000 |
| Youth Coordinator | R1,000 |
| Youth Facilitator | R500 |
| Women's President | R5,000 |
| Women's Deputy | R3,000 |
| Women's Treasurer | R2,000 |
| Women's Coordinator | R1,000 |
| Women's Facilitator | R500 |
| Veterans President | R3,000 |
| Veterans Coordinator | R1,000 |
| Staff | R2,000 |
| All others | R0 (no spending authority) |

### Transaction Approval Workflow

```
1. DRAFT      - Transaction created
2. PENDING    - Awaiting submission
3. SUBMITTED  - Submitted for approval
4. APPROVED   - Approved by authorized member
5. PAID       - Payment completed
6. RECONCILED - Reconciled with bank statement
```

**Rejection:** SUBMITTED → REJECTED (with reason)  
**Cancellation:** Any status → CANCELLED

---

## 4. Membership Fee Structure

### Standard Fees (Proposed)

| Fee Type | Main Structure | Youth Wing | Women's League |
|----------|---------------|------------|----------------|
| Annual Membership | R250 | R150 | R200 |
| Registration (once-off) | R100 | R75 | R75 |
| ID Card | R50 | R50 | R50 |
| Replacement Card | R100 | R100 | R100 |

### Fee Collection Flow

```
Member pays fee → Captured in member_fees table
                → Transaction created (type: membership_fee)
                → Deposited to Membership Fees Account
                → Monthly reconciliation
                → Allocation to operating budget
```

### Discounts

- **Early Bird:** 10% discount if paid 30+ days before due date
- **Pensioner Discount:** 20% for members over 65
- **Student Discount:** 15% for currently enrolled students (with proof)

---

## 5. Regional Structure

### South African Provinces

| Region Code | Province | Regional Manager | Youth Coordinator |
|-------------|----------|------------------|-------------------|
| WC | Western Cape | TBD | TBD |
| EC | Eastern Cape | TBD | TBD |
| NC | Northern Cape | TBD | TBD |
| FS | Free State | TBD | TBD |
| KZN | KwaZulu-Natal | TBD | TBD |
| GP | Gauteng | TBD | TBD |
| MP | Mpumalanga | TBD | TBD |
| LP | Limpopo | TBD | TBD |
| NW | North West | TBD | TBD |

---

## 6. Database Schema Reference

### Core Tables

| Table | Purpose |
|-------|---------|
| `organization_members` | All members with `wing` column |
| `organization_wings` | Wing definitions and leadership |
| `wing_regional_coordinators` | Provincial coordinators per wing |

### Financial Tables

| Table | Purpose |
|-------|---------|
| `organization_bank_accounts` | All bank accounts |
| `organization_transactions` | Income and expense tracking |
| `organization_budgets` | Budget allocations and tracking |
| `membership_fee_structure` | Fee definitions |
| `member_fees` | Individual member fee records |
| `organization_petty_cash` | Petty cash management |

### Key Relationships

```
organization
├── organization_wings (1:many)
│   └── wing_regional_coordinators (1:many)
├── organization_members (1:many)
│   └── member_fees (1:many)
├── organization_bank_accounts (1:many)
├── organization_transactions (1:many)
├── organization_budgets (1:many)
└── membership_fee_structure (1:many)
```

---

## 7. API Functions

### `get_appointable_roles(appointer_role, appointer_wing)`

Returns array of roles the appointer can appoint.

```sql
SELECT get_appointable_roles('youth_president', 'youth');
-- Returns: {youth_deputy, youth_secretary, youth_treasurer, youth_coordinator, ...}
```

### `get_spending_limit(member_role)`

Returns maximum single transaction amount for a role.

```sql
SELECT get_spending_limit('youth_coordinator');
-- Returns: 1000.00
```

### `can_approve_transaction(approver_member_id, amount, wing_id)`

Checks if member can approve a specific transaction.

```sql
SELECT can_approve_transaction('uuid-here', 2500.00, 'youth-wing-uuid');
-- Returns: true/false
```

---

## 8. Implementation Notes

### Youth Wing Age Verification

The system tracks:
- `birth_year` on `organization_members`
- `age_verified` boolean flag
- `age_verified_at` timestamp

Youth wing members must be verified as 18-35 years old.

### Financial Oversight

- **Youth Wing Treasurer** is accountable to **National Treasurer**
- **Women's League Treasurer** is accountable to **National Treasurer**
- All wing transactions require reporting to National Finance Committee

### Dual Membership

Members can belong to multiple wings (e.g., Main + Youth, Main + Women's).
The `wing` column indicates their PRIMARY wing for administrative purposes.

---

## 9. Governance Notes

### Wing Elections

- Wing Presidents elected by wing membership
- Appointments confirmed by National President
- Term: Aligned with main structure election cycle

### Financial Accountability

- Monthly financial reports to National Treasurer
- Quarterly audits of wing accounts
- Annual consolidated financial statement

### Amendment Process

Changes to this structure require:
1. Proposal from National Executive or Wing President
2. Review by governance committee
3. Approval by National Executive Committee
4. Implementation via database migration

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-30 | System | Initial structure documentation |
