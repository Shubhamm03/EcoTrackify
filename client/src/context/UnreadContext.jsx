import { createContext, useContext } from 'react';

// Unread notification count, kept up to date by Layout and shown on the bell
export const UnreadContext = createContext({ unread: 0, setUnread: () => {}, refreshUnread: () => {} });
export const useUnread = () => useContext(UnreadContext);
