import { createContext, useContext, useState } from 'react'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [userId, setUserId] = useState(() => {
    const stored = localStorage.getItem('ironman_user_id')
    return stored ? parseInt(stored, 10) : null
  })
  const [username, setUsername] = useState(() => localStorage.getItem('ironman_username') || null)

  const login = (id, name) => {
    localStorage.setItem('ironman_user_id', String(id))
    localStorage.setItem('ironman_username', name)
    setUserId(id)
    setUsername(name)
  }

  const logout = () => {
    localStorage.removeItem('ironman_user_id')
    localStorage.removeItem('ironman_username')
    setUserId(null)
    setUsername(null)
  }

  return (
    <UserContext.Provider value={{ userId, username, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
