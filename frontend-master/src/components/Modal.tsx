import React, { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;

  return (
    // add padding on the overlay so the modal never touches the screen edges on small devices
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md md:max-w-2xl max-h-[85vh] overflow-y-auto shadow-lg">
        <div className="flex justify-between items-center px-3 py-2 md:px-4 md:py-3 border-b">
          <h3 className="text-base md:text-xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg md:text-2xl leading-none"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <div className="px-3 py-2 md:px-4 md:py-4 text-sm md:text-base">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
