import { api } from './client'

export const dashboardApi = {
  getOverview: role => api.get(`/api/dashboard/overview?role=${role}`),
}
