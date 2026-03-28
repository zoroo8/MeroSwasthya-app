export const DASHBOARD_BY_ROLE = {
  patient: '/dashboard/patient',
  doctor: '/dashboard/doctor',
  admin: '/dashboard/admin',
};

function getDashboardPathByRole(role) {
  return DASHBOARD_BY_ROLE[role] || '/dashboard/patient';
}

export { getDashboardPathByRole };
