const DASHBOARD_BY_ROLE = {
  patient: '/app',
  doctor: '/app',
  admin: '/app',
  hospital: '/app',
};

function getDashboardPathByRole(role) {
  return DASHBOARD_BY_ROLE[role] || '/app';
}

module.exports = {
  DASHBOARD_BY_ROLE,
  getDashboardPathByRole,
};
