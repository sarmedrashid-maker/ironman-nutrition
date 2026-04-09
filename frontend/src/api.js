const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(method, path, body = null, isFormData = false) {
  const config = {
    method,
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
  }
  if (body !== null) {
    config.body = isFormData ? body : JSON.stringify(body)
  }
  const res = await fetch(`${BASE_URL}${path}`, config)
  if (!res.ok) {
    let detail = 'Request failed'
    try { const e = await res.json(); detail = e.detail || detail } catch {}
    throw new Error(detail)
  }
  return res.json()
}

const get      = (path)       => request('GET',    path)
const post     = (path, body) => request('POST',   path, body)
const put      = (path, body) => request('PUT',    path, body)
const del      = (path)       => request('DELETE', path)
const postForm = (path, fd)   => request('POST',   path, fd, true)

export const api = {
  users: {
    get: (id) => get(`/users/${id}`),
    getByUsername: (username) => get(`/users/by-username/${username}`),
    register: (username) => post('/users/register', { username }),
    update: (id, data) => put(`/users/${id}`, data),
  },

  meals: {
    list: (userId) => get(`/meals/?user_id=${userId}`),
    create: (data) => post('/meals/', data),
    update: (id, data) => put(`/meals/${id}`, data),
    delete: (id) => del(`/meals/${id}`),
  },

  foodLog: {
    get: (date, userId) => get(`/food-log/${date}?user_id=${userId}`),
    updateTSS: (date, tss, userId) =>
      put(`/food-log/${date}/tss?user_id=${userId}`, { tss }),
    updateInstructions: (date, instructions, userId) =>
      put(`/food-log/${date}/instructions?user_id=${userId}`, { instructions }),
    updateTrainingNotes: (date, notes, userId) =>
      put(`/food-log/${date}/training-notes?user_id=${userId}`, { notes }),
    parse: (text, userId) => post('/food-log/parse', { text, user_id: userId }),
    addEntry: (data) => post('/food-log/entry', data),
    updateServings: (id, servings) => put(`/food-log/entry/${id}/servings`, { servings }),
    deleteEntry: (id) => del(`/food-log/entry/${id}`),
    addMealToLog: (mealId, date, category, userId) =>
      post(`/food-log/add-meal/${mealId}?log_date=${date}&meal_category=${category}&user_id=${userId}`),
    restaurantEstimate: (data) => post('/food-log/restaurant-estimate', data),
  },

  training: {
    upload: (formData) => postForm('/training/upload', formData),
    estimateTSS: (notes) => post('/training/estimate-tss', { notes }),
  },

  progress: {
    list: (userId) => get(`/progress/?user_id=${userId}`),
    add: (data) => post('/progress/', data),
    delete: (id) => del(`/progress/${id}`),
  },
}
