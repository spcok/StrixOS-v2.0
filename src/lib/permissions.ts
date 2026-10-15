export interface PermissionDefinition {
  key: string;
  module: string;
  label: string;
  description: string;
}

export const APP_PERMISSIONS = {
  // 1. Husbandry & Welfare (Item-by-item granular controls)
  'husbandry:logs_view': {
    module: 'Husbandry & Welfare',
    label: 'View Daily Care Logs',
    description: 'Browse daily care logs and biological records across enclosures',
  },
  'husbandry:logs_write': {
    module: 'Husbandry & Welfare',
    label: 'Create & Edit Daily Care Logs',
    description: 'Submit, update, and sign off daily care logs and feeds',
  },
  'husbandry:rounds_view': {
    module: 'Husbandry & Welfare',
    label: 'View Daily Rounds',
    description: 'Access the daily care checklist and rounds schedule',
  },
  'husbandry:rounds_log': {
    module: 'Husbandry & Welfare',
    label: 'Complete Daily Care Rounds',
    description: 'Tick off checklists and submit morning/evening care rounds',
  },
  'husbandry:feeding_view': {
    module: 'Husbandry & Welfare',
    label: 'View Feeding Schedule',
    description: 'Browse scheduled diet plans, feeding times, and food allocations',
  },
  'husbandry:feeding_manage': {
    module: 'Husbandry & Welfare',
    label: 'Manage Feeding Schedules',
    description: 'Configure and update feeding routines and base diets',
  },
  'husbandry:compliance_view': {
    module: 'Husbandry & Welfare',
    label: 'View Compliance & Missing Records',
    description: 'Audit missing daily logs and monitor husbandry compliance gaps',
  },
  'husbandry:import': {
    module: 'Husbandry & Welfare',
    label: 'Import Historical Logs',
    description: 'Access and execute batch CSV/Excel import tools for daily logs',
  },

  // 2. Animal Collection & Specimens
  'animals:view': {
    module: 'Animal Collection',
    label: 'View Animal Directory & Profiles',
    description: 'Browse collection rosters, bird profiles, and mob cards',
  },
  'animals:edit': {
    module: 'Animal Collection',
    label: 'Edit Specimen Details',
    description: 'Update ring numbers, target weights, morphs, and mob assignments',
  },
  'animals:manage': {
    module: 'Animal Collection',
    label: 'Decommission & Disposition Records',
    description: 'Archive specimens, decommission profiles, and record institutional dispositions',
  },
  'documents:view': {
    module: 'Animal Collection',
    label: 'View Statutory Deeds & Documents',
    description: 'Access Article 10, CITES certificates, and statutory paperwork',
  },
  'documents:manage': {
    module: 'Animal Collection',
    label: 'Manage Statutory Documents',
    description: 'Upload and delete legal certificates and veterinary documents',
  },

  // 3. Clinical & Veterinary Care
  'clinical:records_view': {
    module: 'Clinical & Veterinary',
    label: 'View Medical Records',
    description: 'Browse clinical history, vet consultations, and diagnostics',
  },
  'clinical:records_write': {
    module: 'Clinical & Veterinary',
    label: 'Log Observations & Treatments',
    description: 'Create clinical entries and record routine keeper observations',
  },
  'clinical:mar_view': {
    module: 'Clinical & Veterinary',
    label: 'View Digital MAR',
    description: 'Access active medication rounds and the Medication Administration Record',
  },
  'clinical:mar_sign': {
    module: 'Clinical & Veterinary',
    label: 'Sign Off Medication Doses',
    description: 'Record dose administrations and sign off scheduled MAR entries',
  },
  'clinical:isolation_view': {
    module: 'Clinical & Veterinary',
    label: 'View Isolation Ward',
    description: 'Access quarantine rosters and isolation ward health parameters',
  },
  'clinical:isolation_manage': {
    module: 'Clinical & Veterinary',
    label: 'Manage Quarantine Entries',
    description: 'Admit and discharge specimens from medical isolation',
  },
  'clinical:mortality_view': {
    module: 'Clinical & Veterinary',
    label: 'View Mortality Ledger',
    description: 'Browse post-mortem findings and the permanent mortality register',
  },
  'clinical:mortality_write': {
    module: 'Clinical & Veterinary',
    label: 'Record Mortality & Necropsy',
    description: 'Log specimen deaths, post-mortem findings, and disposal records',
  },
  'clinical:prescribe': {
    module: 'Clinical & Veterinary',
    label: 'Prescribe Treatments',
    description: 'Authorise, alter, and prescribe prescription medication courses',
  },

  // 4. Operations, Logistics & Calendar (3-Tier Groundwork)
  'calendar:view_schedule': {
    module: 'Operations & Logistics',
    label: 'View Calendar Grid & Slots (Tier 3)',
    description: 'See scheduled flight blocks and operational event slots without client PII',
  },
  'calendar:view_assigned': {
    module: 'Operations & Logistics',
    label: 'View Assigned Event Details (Tier 2)',
    description: 'View bird rosters, flight times, and team notes for events assigned to the user',
  },
  'events:manage': {
    module: 'Operations & Logistics',
    label: 'Full Event Booking Manager (Tier 1)',
    description: 'Create/edit bookings, see full client contact PII, contracts, and finances',
  },
  'vouchers:view': {
    module: 'Operations & Logistics',
    label: 'View Experience Vouchers',
    description: 'Browse voucher directory and check ticket validity',
  },
  'vouchers:scan': {
    module: 'Operations & Logistics',
    label: 'Scan & Redeem Vouchers',
    description: 'Verify and redeem experience vouchers and QR codes at the gate',
  },
  'vouchers:manage': {
    module: 'Operations & Logistics',
    label: 'Manage Vouchers Directory',
    description: 'Issue new vouchers, manual status overrides, and process extensions',
  },
  'transfers:internal': {
    module: 'Operations & Logistics',
    label: 'Log Internal Enclosure Moves',
    description: 'Record internal movements between aviaries and blocks',
  },
  'transfers:external': {
    module: 'Operations & Logistics',
    label: 'Execute Institutional Transfers',
    description: 'Authorize and execute external institutional dispositions and transfers',
  },

  // 5. Safety & Facilities
  'safety:drills_view': {
    module: 'Safety & Facilities',
    label: 'View Safety Drills',
    description: 'Access safety drill schedules and drill completion logs',
  },
  'safety:drills_log': {
    module: 'Safety & Facilities',
    label: 'Submit Safety Drills',
    description: 'Record and submit fire, escape, and emergency drill logs',
  },
  'safety:incidents_view': {
    module: 'Safety & Facilities',
    label: 'View Incident Reports',
    description: 'Browse safety incident reports and safety audit registers',
  },
  'safety:incidents_log': {
    module: 'Safety & Facilities',
    label: 'Submit Incident Reports',
    description: 'Log bird escapes, staff injuries, or near-miss safety incidents',
  },
  'safety:incidents_manage': {
    module: 'Safety & Facilities',
    label: 'Manage & Resolve Incidents',
    description: 'Investigate, authorize corrective actions, and close incident tickets',
  },
  'safety:firstaid_view': {
    module: 'Safety & Facilities',
    label: 'View First Aid Records',
    description: 'Browse visitor and staff first aid treatment registers',
  },
  'safety:firstaid_log': {
    module: 'Safety & Facilities',
    label: 'Record First Aid Interventions',
    description: 'Log first aid interventions and treatments administered on site',
  },
  'safety:maintenance_view': {
    module: 'Safety & Facilities',
    label: 'View Maintenance Tickets',
    description: 'Browse facility work orders and maintenance registers',
  },
  'safety:maintenance_manage': {
    module: 'Safety & Facilities',
    label: 'Log & Resolve Maintenance',
    description: 'Submit, assign, and sign off site maintenance work orders',
  },

  // 6. Staff Hub & Timesheets
  'rota:view': {
    module: 'Staff Hub',
    label: 'View Master Staff Rota',
    description: 'Access the master weekly staff duty roster',
  },
  'rota:manage': {
    module: 'Staff Hub',
    label: 'Manage Master Rota',
    description: 'Configure shift allocations, rota templates, and duty assignments',
  },
  'shifts:view_self': {
    module: 'Staff Hub',
    label: 'View Personal Shifts',
    description: 'View own scheduled shifts and duty allocations',
  },
  'timesheet:self': {
    module: 'Staff Hub',
    label: 'Submit Personal Timesheets',
    description: 'Log and submit personal timesheet hours and daily punch logs',
  },
  'timesheet:manage': {
    module: 'Staff Hub',
    label: 'Approve Staff Timesheets',
    description: 'Review, modify, and authorize keeper timesheets and logged overtime',
  },
  'leave:view': {
    module: 'Staff Hub',
    label: 'View Leave Calendar',
    description: 'Access the team holiday and time-off calendar',
  },
  'leave:approve': {
    module: 'Staff Hub',
    label: 'Authorize Leave Requests',
    description: 'Review and approve/reject staff holiday and leave submissions',
  },

  // 7. System Governance & Administration
  'rbac:manage': {
    module: 'System Governance',
    label: 'Manage RBAC Matrix & Overrides',
    description: 'Configure role baseline permissions and assign individual user overrides',
  },
  'admin:users': {
    module: 'System Governance',
    label: 'Manage Staff Directory',
    description: 'Invite new staff, update accounts, and assign base roles',
  },
  'admin:settings': {
    module: 'System Governance',
    label: 'Modify Institution Settings',
    description: 'Edit center profile, ZLA license parameters, and global taxa lists',
  },
  'reports:view': {
    module: 'System Governance',
    label: 'Access Reports & Ledgers',
    description: 'View commercial reports, audit ledgers, and export data sheets',
  },
} as const;

export type PermissionKey = keyof typeof APP_PERMISSIONS;

// Module Grouping Helper for UI Rendering
export const PERMISSIONS_BY_MODULE = Object.entries(APP_PERMISSIONS).reduce(
  (acc, [key, def]) => {
    if (!acc[def.module]) {
      acc[def.module] = [];
    }
    acc[def.module].push({ ...def, key: key as PermissionKey });
    return acc;
  },
  {} as Record<string, (PermissionDefinition & { key: PermissionKey })[]>
);