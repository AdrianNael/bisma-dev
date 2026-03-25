import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";

interface RoleContextType {
  id: string | null;
  username: string | null;
  name: string | null;
  role: string | null;
  setId: (id: string | null) => void;
  setUsername: (username: string | null) => void;
  setName: (name: string | null) => void;
  setRole: (role: string | null) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [id, setId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = localStorage.getItem("userId");
      const storedUsername = localStorage.getItem("username");
      const storedName = localStorage.getItem("name");
      const storedRole = localStorage.getItem("role");

      if (storedId) setId(storedId);
      if (storedUsername) setUsername(storedUsername);
      if (storedName) setName(storedName);
      if (storedRole) setRole(storedRole);
    }
  }, []);

  const setIdWithStorage = (newId: string | null) => {
    setId(newId);
    if (typeof window !== "undefined") {
      if (newId) {
        localStorage.setItem("userId", newId);
      } else {
        localStorage.removeItem("userId");
      }
    }
  };

  const setUsernameWithStorage = (newUsername: string | null) => {
    setUsername(newUsername);
    if (typeof window !== "undefined") {
      if (newUsername) {
        localStorage.setItem("username", newUsername);
      } else {
        localStorage.removeItem("username");
      }
    }
  };

  const setNameWithStorage = (newName: string | null) => {
    setName(newName);
    if (typeof window !== "undefined") {
      if (newName) {
        localStorage.setItem("name", newName);
      } else {
        localStorage.removeItem("name");
      }
    }
  };

  const setRoleWithStorage = (newRole: string | null) => {
    setRole(newRole);
    if (typeof window !== "undefined") {
      if (newRole) {
        localStorage.setItem("role", newRole);
      } else {
        localStorage.removeItem("role");
      }
    }
  };

  return (
    <RoleContext.Provider
      value={{
        id,
        username,
        name,
        role,
        setId: setIdWithStorage,
        setUsername: setUsernameWithStorage,
        setName: setNameWithStorage,
        setRole: setRoleWithStorage,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
