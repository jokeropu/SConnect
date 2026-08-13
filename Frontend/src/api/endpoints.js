import axiosClient from './axiosClient';

const unwrap = (promise) => promise.then((res) => res.data);

export const authApi = {
  register: (payload) => unwrap(axiosClient.post('/auth/register', payload)),
  login: (payload) => unwrap(axiosClient.post('/auth/login', payload)),
  google: (credential) => unwrap(axiosClient.post('/auth/google', { credential })),
  refresh: () => unwrap(axiosClient.post('/auth/refresh')),
  logout: () => unwrap(axiosClient.post('/auth/logout')),
  me: () => unwrap(axiosClient.get('/auth/me')),
  forgotPassword: (payload) => unwrap(axiosClient.post('/auth/forgot-password', payload)),
  resetPassword: (token, payload) => unwrap(axiosClient.post(`/auth/reset-password/${token}`, payload)),
  changePassword: (payload) => unwrap(axiosClient.post('/auth/change-password', payload)),
};

export const userApi = {
  list: (params) => unwrap(axiosClient.get('/users', { params })),
  byId: (id) => unwrap(axiosClient.get(`/users/${id}`)),
  create: (payload) => unwrap(axiosClient.post('/users', payload)),
  update: (id, payload) => unwrap(axiosClient.put(`/users/${id}`, payload)),
  remove: (id) => unwrap(axiosClient.delete(`/users/${id}`)),
  setStatus: (id, status) => unwrap(axiosClient.patch(`/users/${id}/status`, { status })),
  pending: () => unwrap(axiosClient.get('/users/pending')),
  updateProfile: (payload) => unwrap(axiosClient.patch('/users/profile', payload)),
  updateAvatar: (formData) => unwrap(axiosClient.patch('/users/avatar', formData)),
  bulkImport: (payload) => unwrap(axiosClient.post('/users/bulk-import', payload)),
  linkParent: (payload) => unwrap(axiosClient.post('/users/link-parent', payload)),
};

export const classApi = {
  list: (params) => unwrap(axiosClient.get('/classes', { params })),
  byId: (id) => unwrap(axiosClient.get(`/classes/${id}`)),
  create: (payload) => unwrap(axiosClient.post('/classes', payload)),
  update: (id, payload) => unwrap(axiosClient.put(`/classes/${id}`, payload)),
  remove: (id) => unwrap(axiosClient.delete(`/classes/${id}`)),
  enroll: (id, studentIds) => unwrap(axiosClient.post(`/classes/${id}/enroll`, { studentIds })),
};

export const subjectApi = {
  list: (params) => unwrap(axiosClient.get('/subjects', { params })),
  create: (payload) => unwrap(axiosClient.post('/subjects', payload)),
  update: (id, payload) => unwrap(axiosClient.put(`/subjects/${id}`, payload)),
  remove: (id) => unwrap(axiosClient.delete(`/subjects/${id}`)),
};

export const lessonApi = {
  list: (params) => unwrap(axiosClient.get('/lessons', { params })),
  timetable: (params) => unwrap(axiosClient.get('/lessons/timetable', { params })),
  create: (payload) => unwrap(axiosClient.post('/lessons', payload)),
  update: (id, payload) => unwrap(axiosClient.put(`/lessons/${id}`, payload)),
  remove: (id) => unwrap(axiosClient.delete(`/lessons/${id}`)),
};

export const assignmentApi = {
  list: (params) => unwrap(axiosClient.get('/assignments', { params })),
  byId: (id) => unwrap(axiosClient.get(`/assignments/${id}`)),
  create: (formData) => unwrap(axiosClient.post('/assignments', formData)),
  update: (id, formData) => unwrap(axiosClient.put(`/assignments/${id}`, formData)),
  remove: (id) => unwrap(axiosClient.delete(`/assignments/${id}`)),
  submit: (id, formData) => unwrap(axiosClient.post(`/assignments/${id}/submit`, formData)),
  mySubmissions: (params) => unwrap(axiosClient.get('/assignments/submissions/mine', { params })),
  grade: (submissionId, payload) => unwrap(axiosClient.put(`/submissions/${submissionId}/grade`, payload)),
};

export const examApi = {
  list: (params) => unwrap(axiosClient.get('/exams', { params })),
  create: (payload) => unwrap(axiosClient.post('/exams', payload)),
  update: (id, payload) => unwrap(axiosClient.put(`/exams/${id}`, payload)),
  remove: (id) => unwrap(axiosClient.delete(`/exams/${id}`)),
  enterResults: (id, entries) => unwrap(axiosClient.post(`/exams/${id}/results`, { entries })),
  publish: (id) => unwrap(axiosClient.post(`/exams/${id}/publish`)),
};

export const quizApi = {
  list: (params) => unwrap(axiosClient.get('/quizzes', { params })),
  byId: (id) => unwrap(axiosClient.get(`/quizzes/${id}`)),
  create: (payload) => unwrap(axiosClient.post('/quizzes', payload)),
  update: (id, payload) => unwrap(axiosClient.put(`/quizzes/${id}`, payload)),
  remove: (id) => unwrap(axiosClient.delete(`/quizzes/${id}`)),
  setStatus: (id, status) => unwrap(axiosClient.patch(`/quizzes/${id}/status`, { status })),
  start: (id) => unwrap(axiosClient.post(`/quizzes/${id}/start`)),
  submit: (id, responses) => unwrap(axiosClient.post(`/quizzes/${id}/submit`, { responses })),
  myAttempts: (params) => unwrap(axiosClient.get('/quizzes/attempts/mine', { params })),
  review: (id, studentId) =>
    unwrap(axiosClient.get(`/quizzes/${id}/review`, { params: studentId ? { studentId } : undefined })),
  results: (id) => unwrap(axiosClient.get(`/quizzes/${id}/results`)),
};

export const resultApi = {
  list: (params) => unwrap(axiosClient.get('/results', { params })),
  reportCard: (studentId) =>
    unwrap(axiosClient.get(studentId ? `/results/report-card/${studentId}` : '/results/report-card')),
};

export const attendanceApi = {
  list: (params) => unwrap(axiosClient.get('/attendance', { params })),
  sheet: (params) => unwrap(axiosClient.get('/attendance/sheet', { params })),
  mark: (payload) => unwrap(axiosClient.post('/attendance', payload)),
  student: (studentId) =>
    unwrap(axiosClient.get(studentId ? `/attendance/student/${studentId}` : '/attendance/student')),
  trend: (params) => unwrap(axiosClient.get('/attendance/trend', { params })),
};

export const announcementApi = {
  list: (params) => unwrap(axiosClient.get('/announcements', { params })),
  create: (payload) => unwrap(axiosClient.post('/announcements', payload)),
  update: (id, payload) => unwrap(axiosClient.put(`/announcements/${id}`, payload)),
  remove: (id) => unwrap(axiosClient.delete(`/announcements/${id}`)),
};

export const eventApi = {
  list: (params) => unwrap(axiosClient.get('/events', { params })),
  create: (payload) => unwrap(axiosClient.post('/events', payload)),
  update: (id, payload) => unwrap(axiosClient.put(`/events/${id}`, payload)),
  remove: (id) => unwrap(axiosClient.delete(`/events/${id}`)),
};

export const messageApi = {
  conversations: () => unwrap(axiosClient.get('/conversations')),
  start: (userId) => unwrap(axiosClient.post('/conversations', { userId })),
  messages: (id, params) => unwrap(axiosClient.get(`/conversations/${id}/messages`, { params })),
  send: (id, payload) => unwrap(axiosClient.post(`/conversations/${id}/messages`, payload)),
  contacts: () => unwrap(axiosClient.get('/conversations/contacts')),
};

export const notificationApi = {
  list: (params) => unwrap(axiosClient.get('/notifications', { params })),
  markRead: (id) => unwrap(axiosClient.patch(`/notifications/${id}/read`)),
  markAllRead: () => unwrap(axiosClient.patch('/notifications/read-all')),
  clear: () => unwrap(axiosClient.delete('/notifications')),
};

export const materialApi = {
  list: (params) => unwrap(axiosClient.get('/materials', { params })),
  upload: (formData) => unwrap(axiosClient.post('/materials', formData)),
  remove: (id) => unwrap(axiosClient.delete(`/materials/${id}`)),
  download: (id) => unwrap(axiosClient.get(`/materials/${id}/download`)),
};

export const dashboardApi = {
  load: () => unwrap(axiosClient.get('/dashboard')),
  search: (q) => unwrap(axiosClient.get('/dashboard/search', { params: { q } })),
};
