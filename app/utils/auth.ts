export const getUserId = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userId');
};

export const setUserId = (id: string) => {
  localStorage.setItem('userId', id);
};

export const logout = () => {
  localStorage.removeItem('userId');
};

export const hasRegistered = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('hasRegistered') === 'true';
};

export const markRegistered = () => {
  localStorage.setItem('hasRegistered', 'true');
};
