import React, { createContext, useContext, useState, ReactNode } from "react";

interface SignatureContextType {
  studentSignature: string | null;
  setStudentSignature: (sig: string | null) => void;
  lecturerSignature: string | null;
  setLecturerSignature: (sig: string | null) => void;
}

const SignatureContext = createContext<SignatureContextType | undefined>(
  undefined,
);

export const SignatureProvider = ({ children }: { children: ReactNode }) => {
  const [studentSignature, setStudentSignature] = useState<string | null>(null);
  const [lecturerSignature, setLecturerSignature] = useState<string | null>(
    null,
  );

  return (
    <SignatureContext.Provider
      value={{
        studentSignature,
        setStudentSignature,
        lecturerSignature,
        setLecturerSignature,
      }}
    >
      {children}
    </SignatureContext.Provider>
  );
};

export const useSignature = () => {
  const context = useContext(SignatureContext);
  if (!context)
    throw new Error("useSignature must be used within SignatureProvider");
  return context;
};
