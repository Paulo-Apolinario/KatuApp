import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import { useAuth } from "./AuthContext";
import {
  cachedInbox,
  loadInbox,
  onInboxChanged,
} from "../services/inboxService";
const InboxContext = createContext({
  unread: 0,
  updateUnread: (_value: number) => {},
});
export function InboxProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;
  const [unread, setUnread] = useState(0);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await loadInbox(userId);
      if (currentUser.current === userId) setUnread(data.unreadCount);
    } catch {
      /* Avisos já obtidos permanecem disponíveis sem conexão. */
    }
  }, [userId]);
  useEffect(() => {
    let alive = true;
    setUnread(0);
    if (!userId) return;
    void cachedInbox(userId)
      .then((data) => {
        if (alive && data) setUnread(data.unreadCount);
      })
      .then(() => {
        if (alive) void refresh();
      });
    const update = () => {
      if (
        alive &&
        AppState.currentState !== "background" &&
        AppState.currentState !== "inactive"
      )
        void refresh();
    };
    const timer = setInterval(update, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    const off = onInboxChanged(update);
    return () => {
      alive = false;
      clearInterval(timer);
      subscription.remove();
      off();
    };
  }, [refresh, userId]);
  return (
    <InboxContext.Provider value={{ unread, updateUnread: setUnread }}>
      {children}
    </InboxContext.Provider>
  );
}
export const useInbox = () => useContext(InboxContext);
